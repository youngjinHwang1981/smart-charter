"use server";

import { prisma } from "@/lib/prisma";

export type DispatchType = "FIXED" | "NORMAL";

export interface CreateDispatchInput {
  date: string;
  routeId: string;
  driverId: string;
  vehicleId: string;
  type?: DispatchType;
}

export interface CreateDispatchResponse {
  success: boolean;
  dispatchId?: string;
  message?: string;
  error?: string;
}

/**
 * 1. 신규 배차 등록 서버 액션:
 * 전달받은 date(날짜), routeId(노선 ID), driverId(기사 ID), vehicleId(차량 ID)를 기반으로
 * Prisma를 통해 Dispatch 레코드를 생성하고, 연이어 DispatchAssignment 레코드까지 연결 생성합니다.
 */
export async function createDispatch(
  input: FormData | CreateDispatchInput
): Promise<CreateDispatchResponse> {
  try {
    let dateStr: string;
    let routeId: string;
    let driverId: string;
    let vehicleId: string;
    let dispatchType: DispatchType = "FIXED";

    if (input instanceof FormData) {
      dateStr = (input.get("date") as string) || "";
      routeId = (input.get("routeId") as string) || "";
      driverId = (input.get("driverId") as string) || "";
      vehicleId = (input.get("vehicleId") as string) || "";
      if (input.get("type") === "NORMAL") dispatchType = "NORMAL";
    } else {
      dateStr = input.date;
      routeId = input.routeId;
      driverId = input.driverId;
      vehicleId = input.vehicleId;
      if (input.type === "NORMAL") dispatchType = "NORMAL";
    }

    if (!dateStr || !routeId) {
      return { success: false, error: "배차 일자와 노선은 필수 선택 항목입니다." };
    }

    // 대상 노선 및 소속 회사(Company) 확인
    const route = await prisma.route.findUnique({
      where: { id: routeId },
    });

    if (!route) {
      return { success: false, error: "선택한 노선 정보를 찾을 수 없습니다." };
    }

    // UTC 자정 기준 Date 객체 생성 (타임존 변환 오차 방지)
    const dispatchDate = new Date(`${dateStr}T00:00:00.000Z`);

    // 트랜잭션으로 Dispatch 및 DispatchAssignment 원자적 동시 생성
    const result = await prisma.$transaction(async (tx) => {
      const dispatch = await tx.dispatch.create({
        data: {
          companyId: route.companyId,
          routeId: route.id,
          date: dispatchDate,
          type: dispatchType,
        },
      });

      const assignment = await tx.dispatchAssignment.create({
        data: {
          dispatchId: dispatch.id,
          driverId: driverId ? driverId : null,
          vehicleId: vehicleId ? vehicleId : null,
          status: driverId && vehicleId ? "ASSIGNED" : "PENDING",
        },
      });

      return { dispatch, assignment };
    });

    return {
      success: true,
      dispatchId: result.dispatch.id,
      message: "신규 배차가 성공적으로 등록되었습니다.",
    };
  } catch (err: any) {
    console.error("[createDispatch 서버 에러]:", err);
    return {
      success: false,
      error: err.message || "배차 등록 처리 중 오류가 발생했습니다.",
    };
  }
}

/**
 * 2. 신규 배차 등록 모달용 마스터 데이터 (노선, 기사, 차량 목록) 조회
 */
export async function getScheduleMasterData() {
  const [routes, drivers, vehicles] = await Promise.all([
    prisma.route.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        clientName: true,
      },
    }),
    prisma.driver.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        employmentType: true,
      },
    }),
    prisma.vehicle.findMany({
      orderBy: { plateNumber: "asc" },
      select: {
        id: true,
        plateNumber: true,
        capacity: true,
      },
    }),
  ]);

  return { routes, drivers, vehicles };
}

/**
 * 3. FullCalendar 이벤트용 배차 목록 조회:
 * Dispatch 1건 = 캘린더 카드 1장으로 매핑할 수 있도록 평면화하여 반환합니다.
 */
export interface CalendarDispatch {
  id: string;
  date: string; // YYYY-MM-DD
  type: DispatchType;
  routeId: string;
  routeName: string;
  clientName: string;
  driverId: string | null;
  driverName: string | null;
  vehicleId: string | null;
  plateNumber: string | null;
  status: string;
}

export async function getCalendarDispatches(): Promise<CalendarDispatch[]> {
  const dispatches = await prisma.dispatch.findMany({
    orderBy: [{ date: "asc" }],
    select: {
      id: true,
      date: true,
      type: true,
      routeId: true,
      route: { select: { name: true, clientName: true } },
      assignments: {
        take: 1,
        select: {
          driverId: true,
          vehicleId: true,
          status: true,
          driver: { select: { name: true } },
          vehicle: { select: { plateNumber: true } },
        },
      },
    },
  });

  return dispatches.map((d) => {
    const a = d.assignments[0];
    return {
      id: d.id,
      date: d.date.toISOString().split("T")[0],
      type: d.type === "FIXED" ? "FIXED" : "NORMAL",
      routeId: d.routeId,
      routeName: d.route.name,
      clientName: d.route.clientName,
      driverId: a?.driverId ?? null,
      driverName: a?.driver?.name ?? null,
      vehicleId: a?.vehicleId ?? null,
      plateNumber: a?.vehicle?.plateNumber ?? null,
      status: a?.status ?? "PENDING",
    };
  });
}

/**
 * 4. 배차 상세 수정 (캘린더 카드 클릭 모달에서 호출)
 */
export interface UpdateDispatchInput {
  dispatchId: string;
  date: string;
  type: DispatchType;
  routeId: string;
  driverId: string;
  vehicleId: string;
}

export async function updateDispatchDetail(
  input: UpdateDispatchInput
): Promise<{ success: boolean; error?: string }> {
  try {
    const { dispatchId, date, type, routeId, driverId, vehicleId } = input;
    if (!dispatchId || !date || !routeId) {
      return { success: false, error: "배차 일자와 노선은 필수 항목입니다." };
    }

    const existing = await prisma.dispatch.findUnique({
      where: { id: dispatchId },
      include: { assignments: true },
    });
    if (!existing) return { success: false, error: "배차 정보를 찾을 수 없습니다." };

    const assignmentData = {
      driverId: driverId || null,
      vehicleId: vehicleId || null,
      status: driverId && vehicleId ? "ASSIGNED" : "PENDING",
    };

    await prisma.$transaction(async (tx) => {
      await tx.dispatch.update({
        where: { id: dispatchId },
        data: {
          date: new Date(`${date}T00:00:00.000Z`),
          type: type === "NORMAL" ? "NORMAL" : "FIXED",
          routeId,
        },
      });

      if (existing.assignments.length > 0) {
        await tx.dispatchAssignment.update({
          where: { id: existing.assignments[0].id },
          data: assignmentData,
        });
      } else {
        await tx.dispatchAssignment.create({
          data: { dispatchId, ...assignmentData },
        });
      }
    });

    return { success: true };
  } catch (err: any) {
    console.error("[updateDispatchDetail 서버 에러]:", err);
    return { success: false, error: err.message || "배차 수정 중 오류가 발생했습니다." };
  }
}

/**
 * 5. 배차 삭제 (하위 DispatchAssignment 포함)
 */
export async function deleteDispatch(
  dispatchId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await prisma.$transaction([
      prisma.dispatchAssignment.deleteMany({ where: { dispatchId } }),
      prisma.dispatch.delete({ where: { id: dispatchId } }),
    ]);
    return { success: true };
  } catch (err: any) {
    console.error("[deleteDispatch 서버 에러]:", err);
    return { success: false, error: err.message || "배차 삭제 중 오류가 발생했습니다." };
  }
}
