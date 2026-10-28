import React from "react";
import Link from "next/link";
import Navbar from "@/app/components/Navbar";
import { getActiveRoutes, getAvailableDriversAndVehicles } from "@/app/actions/dispatch";
import DispatchForm from "./DispatchForm";

// Next.js 16 cacheComponents: 서버 사이드 동적 데이터 조회 허용
export const instant = false;

export const metadata = {
  title: "신규 배차 등록 | 스마트투어 ERP",
  description: "고정 노선 마스터 및 일반 대절 기반 신규 배차 등록",
};

export default async function NewDispatchPage() {
  // 1. 활성화된 노선 마스터 목록 SSR 조회
  const routesRes = await getActiveRoutes();
  const routes = routesRes.success && routesRes.data ? routesRes.data : [];

  // 2. 배정 가능한 기사 및 차량 목록 조회
  const resourcesRes = await getAvailableDriversAndVehicles();
  const drivers = resourcesRes.success && resourcesRes.data?.drivers ? resourcesRes.data.drivers : [];
  const vehicles = resourcesRes.success && resourcesRes.data?.vehicles ? resourcesRes.data.vehicles : [];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <Navbar />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 상단 브레드크럼 & 타이틀 */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 mb-1">
              <span>백오피스 관리자</span>
              <span>/</span>
              <Link href="/schedule" className="hover:text-slate-600 transition-colors">
                배차 스케줄러
              </Link>
              <span>/</span>
              <span className="text-indigo-600 font-bold">신규 배차 등록</span>
            </div>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              신규 배차 등록
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              사전 등록된 표준 노선 마스터를 활용하여 신속하고 정확하게 배차를 생성합니다.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/admin/master-data/route"
              className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 shadow-xs transition-colors"
            >
              노선 마스터 관리 →
            </Link>
          </div>
        </div>

        {/* 배차 등록 클라이언트 폼 */}
        <DispatchForm routes={routes} drivers={drivers} vehicles={vehicles} />
      </main>
    </div>
  );
}
