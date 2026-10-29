import React, { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import Navbar from "@/app/components/Navbar";
import PendingSettlementList from "./PendingSettlementList";

export const instant = false;

export default async function AdminPendingSettlementsPage() {
  await connection();

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar />
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              수동 정산 승인 관리
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              일반 대절(CUSTOM_CHARTER) 운행 종료 후 기사가 제출한 실주행거리 및 영수증 증빙을 검토하고 최종 승인합니다.
            </p>
          </div>
          <Link
            href="/settlement"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-bold shadow-2xs transition self-start sm:self-auto"
          >
            <span>← 월간 통합 정산 대시보드로 이동</span>
          </Link>
        </div>

        <Suspense
          fallback={
            <div className="p-10 bg-white rounded-2xl border border-slate-200 text-center text-sm text-slate-400">
              정산 대기 목록을 불러오는 중입니다...
            </div>
          }
        >
          <PendingSettlementList />
        </Suspense>
      </main>
    </div>
  );
}
