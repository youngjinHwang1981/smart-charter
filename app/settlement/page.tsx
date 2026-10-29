import React from "react";
import { connection } from "next/server";
import { prisma } from "@/lib/prisma";
import SettlementClient from "./SettlementClient";

// Next.js 16 동적 렌더링 허용 (실시간 미승인 건수 조회)
export const instant = false;

/**
 * 월간 통합 정산 서버 컴포넌트 (Server Component)
 * - Prisma를 사용해 status가 'PENDING_SETTLEMENT'인 Dispatch 레코드의 총 개수(count)를 조회하여
 *   클라이언트 대시보드 컴포넌트의 '수동 정산 승인 대기함' 알림 배지에 전달합니다.
 */
export default async function SettlementPage() {
  await connection();

  const count = await prisma.dispatch.count({
    where: {
      status: "PENDING_SETTLEMENT",
    },
  });

  return <SettlementClient pendingCount={count} />;
}
