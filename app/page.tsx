import React from "react";
import { connection } from "next/server";
import { prisma } from "@/lib/prisma";
import DashboardClient from "./DashboardClient";

// Next.js 16 동적 렌더링 허용 (실시간 미승인 정산 건수 조회)
export const instant = false;

/**
 * 통합 경영 대시보드 서버 컴포넌트 (Server Component)
 * - Prisma를 사용해 status가 'PENDING_SETTLEMENT'인 Dispatch 레코드의 총 개수(count)를 조회하여
 *   대시보드 상단 '월간 통합 정산' 퀵 액션 버튼의 알림 배지에 전달합니다.
 */
export default async function ExecutiveDashboardPage() {
  await connection();

  const count = await prisma.dispatch.count({
    where: {
      status: "PENDING_SETTLEMENT",
    },
  });

  return <DashboardClient pendingCount={count} />;
}
