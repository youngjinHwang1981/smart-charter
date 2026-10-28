"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { z } from "zod";

// 배차 등록 입력 스키마
const createDispatchSchema = z.object({
  routeId: z.string().min(1, "노선을 선택해 주세요."),
  date: z.string().min(1, "배차 운행 일자를 입력해 주세요."),
  type: z.string().default("출근"),
  driverId: z.string().optional().nullable(),
  vehicleId: z.string().optional().nullable(),
  memo: z.string().optional().nullable(),
});

export type CreateDispatchInput = z.infer<typeof createDispatchSchema>;

export type ActionResponse<T = any> = {
  success: boolean;
  data?: T;
  error?: string;
};

// 기본 회사 ID 조회 헬퍼
async function getDefaultCompanyId(): Promise<string> {
  let company = await prisma.company.findFirst();
  if (!company) {
    company = await prisma.company.create({
      data: {
        name: "스마트투어 본사",
      },
    });
  }
  return company.id;
}

/**
 * 1. 활성화된 노선 마스터 목록 조회
 * - RouteMaster 테이블에서 isActive: true인 노선 목록(id, name, estimatedDistance, defaultTollFee) 반환
 */
export async function getActiveRoutes(): Promise<ActionResponse<any[]>> {
  try {
    const routes = await prisma.routeMaster.findMany({
      where: {
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        departure: true,
        destination: true,
        estimatedDistance: true,
        defaultTollFee: true,
      },
      orderBy: {
        name: "asc",
      },
    });

    return {
      success: true,
      data: routes,
    };
  } catch (err: any) {
    console.error("[getActiveRoutes Error]:", err);
    return {
      success: false,
      error: "노선 마스터 목록을 불러오는 중 오류가 발생했습니다.",
    };
  }
}

/**
 * 배차에 필요한 기사 및 가용 차량 목록 조회 헬퍼
 */
export async function getAvailableDriversAndVehicles(): Promise<
  ActionResponse<{ drivers: any[]; vehicles: any[] }>
> {
  try {
    const [drivers, vehicles] = await Promise.all([
      prisma.driver.findMany({
        select: {
          id: true,
          name: true,
          employmentType: true,
        },
        orderBy: { name: "asc" },
      }),
      prisma.vehicle.findMany({
        where: {
          status: {
            in: ["AVAILABLE", "IDLE"],
          },
        },
        select: {
          id: true,
          plateNumber: true,
          capacity: true,
          capacityType: true,
          modelName: true,
        },
        orderBy: { plateNumber: "asc" },
      }),
    ]);

    return {
      success: true,
      data: { drivers, vehicles },
    };
  } catch (err: any) {
    console.error("[getAvailableDriversAndVehicles Error]:", err);
    return {
      success: false,
      error: "기사 및 차량 정보를 불러오는 중 오류가 발생했습니다.",
    };
  }
}

/**
 * 2. 신규 배차 생성
 * - 선택된 노선이 'CUSTOM'이면 routeType: 'CUSTOM_CHARTER'
 * - 특정 노선이면 routeType: 'FIXED_ROUTE'로 분기하여 저장
 */
export async function createDispatch(rawInput: CreateDispatchInput): Promise<ActionResponse> {
  try {
    const parsed = createDispatchSchema.safeParse(rawInput);
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message || "입력값이 올바르지 않습니다.";
      return { success: false, error: firstError };
    }

    const { routeId, date, type, driverId, vehicleId } = parsed.data;
    const companyId = await getDefaultCompanyId();
    const targetDate = new Date(`${date}T00:00:00.000Z`);

    // 분기 처리: 일반 대절(CUSTOM) vs 고정 노선(FIXED_ROUTE)
    const isCustom = routeId === "CUSTOM";
    const routeType = isCustom ? "CUSTOM_CHARTER" : "FIXED_ROUTE";

    let actualRouteId: string;
    let routeMasterId: string | null = null;

    if (isCustom) {
      // 일반 대절(CUSTOM_CHARTER)용 표준 Route 조회 또는 자동 생성
      let customRoute = await prisma.route.findFirst({
        where: {
          companyId,
          name: "일반 대절 (수동 배차)",
        },
      });

      if (!customRoute) {
        customRoute = await prisma.route.create({
          data: {
            companyId,
            name: "일반 대절 (수동 배차)",
            clientName: "일반 대절 고객",
            billingPrice: 0,
            payoutPrice: 0,
          },
        });
      }

      actualRouteId = customRoute.id;
    } else {
      // 고정 노선(FIXED_ROUTE)인 경우 RouteMaster 조회
      const routeMaster = await prisma.routeMaster.findUnique({
        where: { id: routeId },
      });

      if (!routeMaster) {
        return {
          success: false,
          error: "선택한 노선 마스터 정보를 찾을 수 없습니다.",
        };
      }

      routeMasterId = routeMaster.id;

      // 해당 노선명에 대응하는 Route 매핑 (없으면 생성)
      let matchedRoute = await prisma.route.findFirst({
        where: {
          companyId,
          name: routeMaster.name,
        },
      });

      if (!matchedRoute) {
        matchedRoute = await prisma.route.create({
          data: {
            companyId,
            name: routeMaster.name,
            clientName: `${routeMaster.departure} ➔ ${routeMaster.destination}`,
            billingPrice: 0,
            payoutPrice: 0,
          },
        });
      }

      actualRouteId = matchedRoute.id;
    }

    // 배차 생성 및 기사/차량 할당
    const dispatch = await prisma.dispatch.create({
      data: {
        companyId,
        routeId: actualRouteId,
        routeMasterId,
        date: targetDate,
        type: type || "출근",
        routeType,
        assignments: {
          create: {
            driverId: driverId || null,
            vehicleId: vehicleId || null,
            status: driverId && vehicleId ? "ASSIGNED" : "PENDING",
          },
        },
      },
      include: {
        assignments: {
          include: {
            driver: true,
            vehicle: true,
          },
        },
      },
    });

    // 화면 캐시 무효화
    revalidatePath("/admin/dispatch/new");
    revalidatePath("/schedule");
    revalidatePath("/settlement");

    return {
      success: true,
      data: dispatch,
    };
  } catch (err: any) {
    console.error("[createDispatch Error]:", err);
    return {
      success: false,
      error: err.message || "배차 등록 처리 중 오류가 발생했습니다.",
    };
  }
}
