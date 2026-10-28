"use server";

import { prisma } from "@/lib/prisma";

export interface MonthlySettlementItem {
  routeId: string;
  clientName: string;
  name: string;
  operationCount: number;
  billingPrice: number;
  payoutPrice: number;
  totalBillingAmount: number;
  totalPayoutAmount: number;
  operatingMargin: number;
}

export interface MonthlySettlementSummary {
  totalOperations: number;
  totalBilling: number;
  totalPayout: number;
  totalMargin: number;
  marginRate: number; // 마진율 (%)
}

export interface MonthlySettlementResult {
  success: boolean;
  yearMonth: string;
  data: MonthlySettlementItem[];
  summary: MonthlySettlementSummary;
  error?: string;
}

/**
 * 특정 연-월(예: '2026-09')에 해당하는 배차 기록을 쿼리하여
 * 노선(Route) 및 발주처 단위로 집계된 월간 통합 정산 데이터를 반환합니다.
 */
export async function getMonthlySettlement(yearMonth: string): Promise<MonthlySettlementResult> {
  try {
    if (!yearMonth || !/^\d{4}-\d{2}$/.test(yearMonth)) {
      return {
        success: false,
        yearMonth,
        data: [],
        summary: { totalOperations: 0, totalBilling: 0, totalPayout: 0, totalMargin: 0, marginRate: 0 },
        error: "올바른 연-월 형식(YYYY-MM)을 입력해 주세요. (예: 2026-09)",
      };
    }

    const [yearStr, monthStr] = yearMonth.split("-");
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);

    // 해당 월의 시작일 (UTC 기준 1일 00:00:00)
    const startDate = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
    // 다음 달의 시작일 (UTC 기준 1일 00:00:00)
    const endDate = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));

    // 해당 월에 배차 기록이 있는 노선과 배차 목록 조회
    const routes = await prisma.route.findMany({
      include: {
        dispatches: {
          where: {
            date: {
              gte: startDate,
              lt: endDate,
            },
          },
          select: {
            id: true,
          },
        },
      },
      orderBy: [{ clientName: "asc" }, { name: "asc" }],
    });

    // 해당 월에 운행된 노선만 집계 (운행 횟수 > 0)
    const settlementData: MonthlySettlementItem[] = routes
      .filter((route) => route.dispatches.length > 0)
      .map((route) => {
        const operationCount = route.dispatches.length; // 총 운행 횟수
        const billingPrice = route.billingPrice; // 청구 단가
        const payoutPrice = route.payoutPrice; // 지급 단가
        const totalBillingAmount = operationCount * billingPrice; // 청구 금액 총액
        const totalPayoutAmount = operationCount * payoutPrice; // 지급 금액 총액
        const operatingMargin = totalBillingAmount - totalPayoutAmount; // 영업 마진

        return {
          routeId: route.id,
          clientName: route.clientName,
          name: route.name,
          operationCount,
          billingPrice,
          payoutPrice,
          totalBillingAmount,
          totalPayoutAmount,
          operatingMargin,
        };
      });

    // 전체 총계 집계
    const totalOperations = settlementData.reduce((acc, cur) => acc + cur.operationCount, 0);
    const totalBilling = settlementData.reduce((acc, cur) => acc + cur.totalBillingAmount, 0);
    const totalPayout = settlementData.reduce((acc, cur) => acc + cur.totalPayoutAmount, 0);
    const totalMargin = totalBilling - totalPayout;
    const marginRate = totalBilling > 0 ? Math.round((totalMargin / totalBilling) * 1000) / 10 : 0;

    return {
      success: true,
      yearMonth,
      data: settlementData,
      summary: {
        totalOperations,
        totalBilling,
        totalPayout,
        totalMargin,
        marginRate,
      },
    };
  } catch (error) {
    console.error(`[월간 정산 에러] yearMonth: ${yearMonth}`, error);
    return {
      success: false,
      yearMonth,
      data: [],
      summary: { totalOperations: 0, totalBilling: 0, totalPayout: 0, totalMargin: 0, marginRate: 0 },
      error: error instanceof Error ? error.message : "정산 데이터 조회 중 오류가 발생했습니다.",
    };
  }
}
