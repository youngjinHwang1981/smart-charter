"use server";

import { prisma } from "@/lib/prisma";
import { calculatePayroll } from "@/src/lib/payroll-calculator";

export interface DriverPayrollItem {
  driverId: string;
  driverName: string;
  employmentType: string; // 'OWN' | 'AFFILIATED' | 'OUTSOURCED'
  dependentsCount: number; // 부양가족 수
  operationCount: number; // 총 운행 횟수 (배정된 DispatchAssignment 카운트)
  totalPayoutAmount: number; // 총 지급 수당 (세전 총액)
  totalDeductionAmount: number; // 세금 공제액 (소득세 3.3% 등)
  netPayoutAmount: number; // 실지급액 (세후 차인지급액)
  incomeTax: number; // 소득세 (3%)
  localIncomeTax: number; // 지방소득세 (0.3%)
}

export interface MonthlyPayrollSummary {
  totalDrivers: number;
  totalOperations: number;
  totalPayrollAmount: number; // 세전 총 지급액
  totalDeductionAmount: number; // 총 공제액 (3.3%)
  totalNetAmount: number; // 총 실지급액
  averagePayout: number; // 기사당 평균 총지급액
  averageNetPayout: number; // 기사당 평균 실지급액
}

export interface MonthlyPayrollResult {
  success: boolean;
  yearMonth: string;
  data: DriverPayrollItem[];
  summary: MonthlyPayrollSummary;
  error?: string;
}

/**
 * 특정 연-월(예: '2026-09')의 DispatchAssignment 데이터를 쿼리하여
 * 기사(Driver) 단위로 그룹화한 월간 급여/수당 정산 데이터를 계산하여 반환합니다.
 */
export async function getMonthlyPayroll(yearMonth: string): Promise<MonthlyPayrollResult> {
  try {
    if (!yearMonth || !/^\d{4}-\d{2}$/.test(yearMonth)) {
      return {
        success: false,
        yearMonth,
        data: [],
        summary: {
          totalDrivers: 0,
          totalOperations: 0,
          totalPayrollAmount: 0,
          totalDeductionAmount: 0,
          totalNetAmount: 0,
          averagePayout: 0,
          averageNetPayout: 0,
        },
        error: "올바른 연-월 형식(YYYY-MM)을 입력해 주세요. (예: 2026-09)",
      };
    }

    const [yearStr, monthStr] = yearMonth.split("-");
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);

    // 해당 월의 1일 00:00:00 (UTC) ~ 다음 달 1일 00:00:00 (UTC)
    const startDate = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
    const endDate = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));

    // 기사가 배정된 해당 월의 DispatchAssignment 레코드 조회 (Driver, Dispatch 및 Route 포함)
    const assignments = await prisma.dispatchAssignment.findMany({
      where: {
        driverId: { not: null },
        dispatch: {
          date: {
            gte: startDate,
            lt: endDate,
          },
        },
      },
      select: {
        driver: {
          select: {
            id: true,
            name: true,
            employmentType: true,
            dependentsCount: true,
          },
        },
        dispatch: {
          select: {
            route: {
              select: {
                payoutPrice: true,
              },
            },
          },
        },
      },
    });

    // 기사(Driver) 단위로 그룹화
    const driverMap = new Map<
      string,
      {
        driverId: string;
        driverName: string;
        employmentType: string;
        dependentsCount: number;
        operationCount: number;
        totalPayoutAmount: number;
      }
    >();

    for (const item of assignments) {
      const driver = item.driver;
      const route = item.dispatch?.route;
      if (!driver || !route) continue;

      if (!driverMap.has(driver.id)) {
        driverMap.set(driver.id, {
          driverId: driver.id,
          driverName: driver.name,
          employmentType: driver.employmentType,
          dependentsCount: driver.dependentsCount ?? 1,
          operationCount: 0,
          totalPayoutAmount: 0,
        });
      }

      const driverRecord = driverMap.get(driver.id)!;
      driverRecord.operationCount += 1;
      driverRecord.totalPayoutAmount += route.payoutPrice;
    }

    // 각 기사별 세금 공제(소득세 3.3%) 및 실지급액 산출
    const payrollData: DriverPayrollItem[] = Array.from(driverMap.values())
      .map((item) => {
        const taxResult = calculatePayroll(item.totalPayoutAmount);
        return {
          ...item,
          totalDeductionAmount: taxResult.공제액,
          netPayoutAmount: taxResult.실지급액,
          incomeTax: taxResult.details.incomeTax,
          localIncomeTax: taxResult.details.localIncomeTax,
        };
      })
      .sort((a, b) => a.driverName.localeCompare(b.driverName, "ko-KR"));

    // 전체 요약 통계 계산
    const totalDrivers = payrollData.length;
    const totalOperations = payrollData.reduce((acc, cur) => acc + cur.operationCount, 0);
    const totalPayrollAmount = payrollData.reduce((acc, cur) => acc + cur.totalPayoutAmount, 0);
    const totalDeductionAmount = payrollData.reduce((acc, cur) => acc + cur.totalDeductionAmount, 0);
    const totalNetAmount = payrollData.reduce((acc, cur) => acc + cur.netPayoutAmount, 0);
    const averagePayout = totalDrivers > 0 ? Math.round(totalPayrollAmount / totalDrivers) : 0;
    const averageNetPayout = totalDrivers > 0 ? Math.round(totalNetAmount / totalDrivers) : 0;

    return {
      success: true,
      yearMonth,
      data: payrollData,
      summary: {
        totalDrivers,
        totalOperations,
        totalPayrollAmount,
        totalDeductionAmount,
        totalNetAmount,
        averagePayout,
        averageNetPayout,
      },
    };
  } catch (error) {
    console.error(`[기사 급여 정산 에러] yearMonth: ${yearMonth}`, error);
    return {
      success: false,
      yearMonth,
      data: [],
      summary: {
        totalDrivers: 0,
        totalOperations: 0,
        totalPayrollAmount: 0,
        totalDeductionAmount: 0,
        totalNetAmount: 0,
        averagePayout: 0,
        averageNetPayout: 0,
      },
      error: error instanceof Error ? error.message : "기사 급여 데이터 조회 중 오류가 발생했습니다.",
    };
  }
}
