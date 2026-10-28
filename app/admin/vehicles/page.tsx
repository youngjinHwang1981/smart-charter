import React from "react";
import Link from "next/link";
import Navbar from "@/app/components/Navbar";
import { getVehicles } from "@/app/actions/vehicle";
import VehicleTableClient from "./VehicleTableClient";

// Next.js 16 cacheComponents: 서버 사이드 동적 데이터 조회 허용
export const instant = false;

export const metadata = {
  title: "차량 제원 및 가용 현황 관리 | 스마트투어 ERP",
  description: "전세버스 차량 제원 등록, 조회, 수정 및 가용 상태(B2B 중개) 관리",
};

export default async function AdminVehiclesPage() {
  // 1. 서버 사이드 렌더링(SSR)으로 차량 목록 조회 Server Action 호출
  const result = await getVehicles();
  const vehicles = result.success && result.data ? result.data : [];

  // 2. 상단 요약 통계 계산
  const totalCount = vehicles.length;
  const availableCount = vehicles.filter((v: any) => v.status === "AVAILABLE").length;
  const dispatchedCount = vehicles.filter((v: any) => v.status === "DISPATCHED").length;
  const maintenanceCount = vehicles.filter(
    (v: any) => v.status === "MAINTENANCE" || v.status === "IDLE"
  ).length;

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
              <span className="text-indigo-600 font-bold">차량 제원 관리</span>
            </div>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              차량 제원 및 가용 현황 관리
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              등록된 전세버스 제원(인승, 연식, 편의옵션)과 실시간 가용 상태를 통합 관리합니다.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/admin/drivers"
              className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 shadow-xs transition-colors"
            >
              기사 관리 바로가기 →
            </Link>
          </div>
        </div>

        {/* 상단 상태 통계 카드 4개 */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
            <p className="text-xs font-semibold text-slate-500">총 등록 차량</p>
            <p className="text-2xl font-black text-slate-900 mt-1">
              {totalCount}
              <span className="text-xs font-medium text-slate-500 ml-1">대</span>
            </p>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-emerald-200/80 shadow-xs bg-emerald-50/20">
            <p className="text-xs font-semibold text-emerald-700 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              운행 가능 (배차 가용)
            </p>
            <p className="text-2xl font-black text-emerald-700 mt-1">
              {availableCount}
              <span className="text-xs font-medium text-emerald-600 ml-1">대</span>
            </p>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-blue-200/80 shadow-xs bg-blue-50/20">
            <p className="text-xs font-semibold text-blue-700 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-blue-500" />
              배차 운행 중
            </p>
            <p className="text-2xl font-black text-blue-700 mt-1">
              {dispatchedCount}
              <span className="text-xs font-medium text-blue-600 ml-1">대</span>
            </p>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-amber-200/80 shadow-xs bg-amber-50/20">
            <p className="text-xs font-semibold text-amber-700 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              대기 / 정비 점검
            </p>
            <p className="text-2xl font-black text-amber-700 mt-1">
              {maintenanceCount}
              <span className="text-xs font-medium text-amber-600 ml-1">대</span>
            </p>
          </div>
        </div>

        {/* 차량 목록 데이터 테이블 (SSR 데이터 주입) */}
        <VehicleTableClient vehicles={vehicles} />
      </main>
    </div>
  );
}
