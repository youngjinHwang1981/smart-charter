"use server";

import { prisma } from "@/lib/prisma";

// 1. DB에서 배차 데이터를 읽어와 AG Grid용 평면(Flat) 객체로 변환
export async function getDispatchSchedule() {
  const routes = await prisma.route.findMany({
    select: {
      id: true,
      name: true,
      clientName: true,
      dispatches: {
        select: {
          date: true,
          assignments: {
            take: 1,
            select: {
              driver: { select: { name: true } },
              vehicle: { select: { plateNumber: true } },
            },
          },
        },
      },
    },
  });

  const rowData = routes.map((route) => {
    const row: any = {
      routeId: route.id,
      route: route.name,
      client: route.clientName,
    };

    // 날짜별 배차 기록을 가로 컬럼(키)으로 맵핑
    route.dispatches.forEach((dispatch) => {
      const dateStr = dispatch.date.toISOString().split("T")[0]; // "YYYY-MM-DD" 포맷
      const assignment = dispatch.assignments[0];
      if (assignment) {
        const driverName = assignment.driver?.name || "미배정";
        const plate = assignment.vehicle?.plateNumber || "미배정";
        row[dateStr] = `${driverName}(${plate})`;
      }
    });

    return row;
  });

  return rowData;
}

// 2. 셀 편집 시 호출되는 업데이트 함수
export async function updateDispatchRecord(routeId: string, dateField: string, newDriverName: string) {
  try {
    const targetDate = new Date(`${dateField}T00:00:00.000Z`);
    const nextDate = new Date(`${dateField}T23:59:59.999Z`);

    // 해당 노선과 일자의 Dispatch 조회
    let dispatch = await prisma.dispatch.findFirst({
      where: {
        routeId,
        date: {
          gte: targetDate,
          lte: nextDate,
        },
      },
      include: {
        assignments: true,
      },
    });

    // 입력값 파싱 (예: "오이섭(3590)" 또는 "박광열")
    const match = newDriverName.match(/^([^(]+)(?:\(([^)]+)\))?/);
    const driverName = match ? match[1].trim() : newDriverName.trim();
    const plateNumber = match && match[2] ? match[2].trim() : null;

    const [driver, vehicle] = await Promise.all([
      driverName ? prisma.driver.findFirst({ where: { name: driverName } }) : null,
      plateNumber ? prisma.vehicle.findFirst({ where: { plateNumber } }) : null,
    ]);

    if (!dispatch) {
      const route = await prisma.route.findUnique({ where: { id: routeId } });
      if (!route) return { success: false, message: "노선 정보를 찾을 수 없습니다." };
      dispatch = await prisma.dispatch.create({
        data: {
          companyId: route.companyId,
          routeId: route.id,
          date: targetDate,
          type: "FIXED",
        },
        include: { assignments: true },
      });
    }

    if (dispatch.assignments.length > 0) {
      await prisma.dispatchAssignment.update({
        where: { id: dispatch.assignments[0].id },
        data: {
          driverId: driver ? driver.id : null,
          vehicleId: vehicle ? vehicle.id : null,
          status: driver && vehicle ? "ASSIGNED" : "PENDING",
        },
      });
    } else {
      await prisma.dispatchAssignment.create({
        data: {
          dispatchId: dispatch.id,
          driverId: driver ? driver.id : null,
          vehicleId: vehicle ? vehicle.id : null,
          status: driver && vehicle ? "ASSIGNED" : "PENDING",
        },
      });
    }

    console.log(`[서버 로그] DB 배차 수정 완료 -> 노선: ${routeId}, 날짜: ${dateField}, 기사: ${driverName}`);
    return { success: true, message: "배차 수정 완료" };
  } catch (err: any) {
    console.error("[updateDispatchRecord 에러]:", err);
    return { success: false, message: err.message };
  }
}

export interface DailyTrendStat {
  date: string; // "MM/DD"
  fullDate: string; // "YYYY-MM-DD"
  totalBilling: number; // 청구액 (매출)
  totalPayout: number; // 지급액 (원가)
  operatingMargin: number; // 영업이익
  operationCount: number; // 운행 건수
}

export interface RoutePerformanceStat {
  routeId: string;
  routeName: string;
  clientName: string;
  count: number;
  totalBilling: number;
  totalPayout: number;
  operatingMargin: number;
}

export interface DashboardStatsResult {
  totalBilling: number; // 최근 30일 총매출(청구액)
  totalPayout: number; // 최근 30일 총원가(지급액)
  operatingMargin: number; // 최근 30일 영업이익
  totalOperations: number; // 최근 30일 총 운행 횟수
  marginRate: number; // 영업이익률 (%)
  activeRoutesCount: number; // 활성 운행 노선 수
  dailyTrends: DailyTrendStat[]; // 일자별 매출 및 원가 추이 데이터
  routeStats: RoutePerformanceStat[]; // 노선별 실적 요약
}

/**
 * 경영진 통합 대시보드 통계 집계:
 * 최근 30일간의 총매출(청구액), 총원가(지급액), 영업이익, 총 운행 횟수 및 일자별 추이를 집계합니다.
 */
export async function getDashboardStats(): Promise<DashboardStatsResult> {
  const now = new Date();
  // 최근 30일 범위 (데이터 기준일 여유 고려하여 35일 전부터 조회)
  const thirtyDaysAgo = new Date(now.getTime() - 35 * 24 * 60 * 60 * 1000);

  const selectFields = {
    id: true,
    date: true,
    route: {
      select: {
        id: true,
        name: true,
        clientName: true,
        billingPrice: true,
        payoutPrice: true,
      },
    },
  };

  // 최근 배차 데이터 쿼리 (date 인덱스 활용)
  let dispatches = await prisma.dispatch.findMany({
    where: {
      date: {
        gte: thirtyDaysAgo,
      },
    },
    select: selectFields,
    orderBy: {
      date: "asc",
    },
  });

  // DB에 30일 이내 데이터가 없으면 전체 등록된 배차 데이터 기준 집계 (폴백 안전장치)
  if (dispatches.length === 0) {
    dispatches = await prisma.dispatch.findMany({
      select: selectFields,
      orderBy: {
        date: "asc",
      },
    });
  }

  // 1. 전체 핵심 지표 집계
  const totalOperations = dispatches.length;
  const totalBilling = dispatches.reduce((acc, cur) => acc + (cur.route?.billingPrice || 0), 0);
  const totalPayout = dispatches.reduce((acc, cur) => acc + (cur.route?.payoutPrice || 0), 0);
  const operatingMargin = totalBilling - totalPayout;
  const marginRate = totalBilling > 0 ? Math.round((operatingMargin / totalBilling) * 1000) / 10 : 0;

  // 2. 일자별(Daily) 매출 및 원가 추이 데이터 그룹화
  const dailyMap = new Map<string, { billing: number; payout: number; count: number }>();

  dispatches.forEach((dispatch) => {
    const fullDate = dispatch.date.toISOString().split("T")[0]; // "YYYY-MM-DD"
    if (!dailyMap.has(fullDate)) {
      dailyMap.set(fullDate, { billing: 0, payout: 0, count: 0 });
    }
    const dayStat = dailyMap.get(fullDate)!;
    dayStat.billing += dispatch.route?.billingPrice || 0;
    dayStat.payout += dispatch.route?.payoutPrice || 0;
    dayStat.count += 1;
  });

  const dailyTrends: DailyTrendStat[] = Array.from(dailyMap.entries())
    .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
    .map(([fullDate, val]) => ({
      date: fullDate.substring(5).replace("-", "/"), // "09/26" 포맷
      fullDate,
      totalBilling: val.billing,
      totalPayout: val.payout,
      operatingMargin: val.billing - val.payout,
      operationCount: val.count,
    }));

  // 3. 노선별 실적 요약
  const routeMap = new Map<string, RoutePerformanceStat>();

  dispatches.forEach((dispatch) => {
    const route = dispatch.route;
    if (!route) return;

    if (!routeMap.has(route.id)) {
      routeMap.set(route.id, {
        routeId: route.id,
        routeName: route.name,
        clientName: route.clientName,
        count: 0,
        totalBilling: 0,
        totalPayout: 0,
        operatingMargin: 0,
      });
    }

    const stat = routeMap.get(route.id)!;
    stat.count += 1;
    stat.totalBilling += route.billingPrice;
    stat.totalPayout += route.payoutPrice;
    stat.operatingMargin = stat.totalBilling - stat.totalPayout;
  });

  const routeStats = Array.from(routeMap.values()).sort((a, b) => b.totalBilling - a.totalBilling);

  return {
    totalBilling,
    totalPayout,
    operatingMargin,
    totalOperations,
    marginRate,
    activeRoutesCount: routeMap.size,
    dailyTrends,
    routeStats,
  };
}