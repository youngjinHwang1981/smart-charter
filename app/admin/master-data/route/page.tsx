import React from "react";
import Link from "next/link";
import { connection } from "next/server";
import Navbar from "@/app/components/Navbar";
import { getRouteMasters, getPricingRules } from "@/app/actions/masterData";
import MasterDataClientView from "./MasterDataClientView";

// Next.js 16 cacheComponents: 서버 사이드 동적 데이터 조회 허용
export const instant = false;

export const metadata = {
  title: "노선 마스터 및 단가 기준 관리 | SF Mobility ERP",
  description: "전세버스 표준 운행 노선 및 차종별 급여/정산 자동 산정 단가 기준 관리",
};

export default async function RouteMasterPage() {
  await connection();

  const [routeResult, pricingResult] = await Promise.all([
    getRouteMasters(),
    getPricingRules(),
  ]);

  const routes = routeResult.success && routeResult.data ? routeResult.data : [];
  const pricingRules =
    pricingResult.success && pricingResult.data ? pricingResult.data : [];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 상단 브레드크럼 & 타이틀 */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 mb-1">
              <span>백오피스 관리자</span>
              <span>/</span>
              <span>기준 정보 관리 (MDM)</span>
              <span>/</span>
              <span className="text-indigo-600 font-bold">노선 마스터 & 정산 단가 기준</span>
            </div>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              노선 마스터 & 급여/정산 단가 기준 관리
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              정기 통근 표준 노선(고정 노선)과 일반 대절 주행거리 연동 급여/정산 단가 기준표를 통합 관리합니다.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/admin/vehicles"
              className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 shadow-xs transition-colors"
            >
              차량 제원 관리 →
            </Link>
          </div>
        </div>

        <MasterDataClientView routes={routes} pricingRules={pricingRules} />
      </main>
    </div>
  );
}
