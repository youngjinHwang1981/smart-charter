import React from "react";
import { prisma } from "@/lib/prisma";
import { calculatePayroll } from "@/lib/payroll-calculator";
import DriverMobileView, {
  SerializedDriverInfo,
  SerializedScheduleItem,
  SerializedPayrollSummary,
} from "./DriverMobileView";

interface DriverPortalPageProps {
  params: Promise<{ driverId: string }>;
  searchParams?: Promise<{ month?: string; today?: string }>;
}

// Next.js 16 cacheComponents: 동적 비캐시 데이터(Prisma DB 조회) 허용
export const instant = false;

const DAY_NAMES = ["일", "월", "화", "수", "목", "금", "토"];

/**
 * 기사 전용 모바일 웹 대시보드 (React Server Component)
 * 경로: /driver/[driverId]
 */
export default async function DriverPortalPage({
  params,
  searchParams,
}: DriverPortalPageProps) {
  const { driverId } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};

  // 1. 기사 정보 조회 (필요한 컬럼만 경량 조회)
  const driver = await prisma.driver.findUnique({
    where: { id: driverId },
    select: {
      id: true,
      name: true,
      employmentType: true,
      company: {
        select: {
          name: true,
        },
      },
    },
  });

  if (!driver) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="max-w-xs w-full bg-slate-900 border border-slate-800 rounded-2xl p-6 text-center shadow-2xl">
          <div className="w-12 h-12 rounded-full bg-rose-500/20 text-rose-400 mx-auto flex items-center justify-center mb-3">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h1 className="text-base font-bold text-white mb-1">기사 정보를 찾을 수 없습니다</h1>
          <p className="text-xs text-slate-400">
            유효하지 않은 링크이거나 등록되지 않은 기사 식별자입니다. 관리자에게 문의해 주세요.
          </p>
        </div>
      </div>
    );
  }

  // 2. 조회 대상 연-월 결정 (기본값: 당월 2026-10)
  const defaultMonth = "2026-10";
  const targetMonth = resolvedSearchParams.month || defaultMonth;

  // 오늘 날짜 계산 (KST 기준)
  const kstNow = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const todayString = resolvedSearchParams.today || kstNow.toISOString().slice(0, 10);

  // 월 시작일 & 종료일 (UTC 기준)
  const [yearStr, monthStr] = targetMonth.split("-");
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  const startDate = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  const endDate = new Date(Date.UTC(nextYear, nextMonth - 1, 1, 0, 0, 0));

  // 3. 해당 기사의 당월 배차 및 과거 운행 월 목록을 Promise.all로 병렬 조회
  const [assignments, pastAssignments] = await Promise.all([
    prisma.dispatchAssignment.findMany({
      where: {
        driverId: driver.id,
        dispatch: {
          date: {
            gte: startDate,
            lt: endDate,
          },
        },
      },
      select: {
        id: true,
        status: true,
        vehicle: { select: { plateNumber: true } },
        dispatch: {
          select: {
            id: true,
            date: true,
            type: true,
            routeType: true,
            routeMasterId: true,
            status: true,
            actualDistance: true,
            actualTollFee: true,
            parkingFee: true,
            receiptImageUrl: true,
            routeMaster: {
              select: {
                id: true,
                name: true,
                departure: true,
                destination: true,
                estimatedDistance: true,
                defaultTollFee: true,
              },
            },
            route: {
              select: {
                name: true,
                clientName: true,
                payoutPrice: true,
              },
            },
            assignments: {
              select: {
                driverId: true,
                driver: { select: { name: true } },
              },
            },
          },
        },
      },
      orderBy: {
        dispatch: {
          date: "asc",
        },
      },
    }),
    prisma.dispatchAssignment.findMany({
      where: { driverId: driver.id },
      select: { dispatch: { select: { date: true } } },
      take: 200,
    }),
  ]);

  const monthSet = new Set<string>();
  monthSet.add("2026-10");
  pastAssignments.forEach((a) => {
    if (a.dispatch?.date) {
      monthSet.add(a.dispatch.date.toISOString().slice(0, 7));
    }
  });
  const availableMonths = Array.from(monthSet).sort().reverse();

  // 5. 급여 사전 계산 (payroll-calculator 재사용 + 승인 완료된 실비 합산)
  const grossPay = assignments.reduce((sum, a) => {
    const basePayout = a.dispatch?.route?.payoutPrice || 0;
    const isApproved = a.dispatch?.status === "COMPLETED";
    const approvedExpenses = isApproved
      ? (a.dispatch?.actualTollFee || 0) + (a.dispatch?.parkingFee || 0)
      : 0;
    return sum + basePayout + approvedExpenses;
  }, 0);
  const payrollResult = calculatePayroll(grossPay);

  // 6. 클라이언트 컴포넌트 렌더링에 필요한 최소한의 직렬화 데이터 가공
  const serializedDriver: SerializedDriverInfo = {
    id: driver.id,
    name: driver.name,
    employmentType: driver.employmentType,
    companyName: driver.company?.name || "스마트여행사",
  };

  const serializedSchedule: SerializedScheduleItem[] = assignments.map((a) => {
    const d = new Date(a.dispatch.date);
    const dateStr = d.toISOString().slice(0, 10);
    const dayOfWeek = DAY_NAMES[d.getUTCDay()] || "";

    // 노선명에서 시간 추출 또는 기본 운행시간 부여
    const routeName = a.dispatch?.route?.name || "미지정 노선";
    const timeMatch = routeName.match(/(\d{1,2}:\d{2})/);
    const departureTime = timeMatch
      ? timeMatch[1]
      : a.dispatch?.type === "FIXED"
      ? "06:30 (출근)"
      : "운행전 확인";

    // 동승 기사(동일 배차에 할당된 타 기사) 탐색
    const otherDrivers = (a.dispatch?.assignments || [])
      .filter((other) => other.driverId && other.driverId !== driver.id)
      .map((other) => other.driver?.name)
      .filter(Boolean) as string[];
    const coDriver = otherDrivers.length > 0 ? otherDrivers.join(", ") : null;

    const isCustomCharter =
      a.dispatch?.routeType === "CUSTOM_CHARTER" ||
      (!a.dispatch?.routeMasterId && a.dispatch?.type !== "FIXED");
    const resolvedRouteType: "FIXED_ROUTE" | "CUSTOM_CHARTER" = isCustomCharter
      ? "CUSTOM_CHARTER"
      : "FIXED_ROUTE";

    return {
      id: a.id,
      dispatchId: a.dispatch.id,
      date: dateStr,
      dayOfWeek,
      time: departureTime,
      routeName: a.dispatch?.routeMaster?.name || routeName,
      clientName: a.dispatch?.route?.clientName || "일반",
      plateNumber: a.vehicle?.plateNumber || "미배정",
      coDriver,
      type: (resolvedRouteType === "FIXED_ROUTE" ? "FIXED" : "NORMAL") as "FIXED" | "NORMAL",
      routeType: resolvedRouteType,
      payoutPrice:
        (a.dispatch?.route?.payoutPrice || 0) +
        (a.dispatch?.status === "COMPLETED"
          ? (a.dispatch?.actualTollFee || 0) + (a.dispatch?.parkingFee || 0)
          : 0),
      status: a.dispatch?.status !== "PENDING" ? a.dispatch.status : a.status,
      estimatedDistance: a.dispatch?.routeMaster?.estimatedDistance ?? null,
      defaultTollFee: a.dispatch?.routeMaster?.defaultTollFee ?? null,
      actualDistance: a.dispatch?.actualDistance ?? null,
      actualTollFee: a.dispatch?.actualTollFee ?? null,
      receiptImageUrl: a.dispatch?.receiptImageUrl ?? null,
      isToday: dateStr === todayString,
    };
  });

  const serializedPayroll: SerializedPayrollSummary = {
    yearMonth: targetMonth,
    totalCount: assignments.length,
    grossPay: payrollResult.총액,
    incomeTax: payrollResult.details.incomeTax,
    localIncomeTax: payrollResult.details.localIncomeTax,
    totalDeductions: payrollResult.공제액,
    netPay: payrollResult.실지급액,
  };

  // 7. 클라이언트로 최소 직렬화 데이터만 전달
  return (
    <DriverMobileView
      driver={serializedDriver}
      currentMonth={targetMonth}
      todayString={todayString}
      availableMonths={availableMonths}
      schedule={serializedSchedule}
      payroll={serializedPayroll}
    />
  );
}
