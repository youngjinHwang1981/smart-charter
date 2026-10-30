"use client";

import React, { useState } from "react";
import RouteMasterForm from "./RouteMasterForm";
import PricingRuleManager, { type PricingRuleRecord } from "./PricingRuleManager";

interface MasterDataClientViewProps {
  routes: any[];
  pricingRules: PricingRuleRecord[];
}

export default function MasterDataClientView({
  routes,
  pricingRules,
}: MasterDataClientViewProps) {
  const [activeTab, setActiveTab] = useState<"routes" | "pricing">("routes");

  const totalCount = routes.length;
  const activeCount = routes.filter((r: any) => r.isActive).length;

  return (
    <>
      {/* 탭 네비게이션 & 통계 요약 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab("routes")}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === "routes"
                ? "bg-indigo-600 text-white shadow-xs"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            📍 노선 마스터 ({totalCount})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("pricing")}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === "pricing"
                ? "bg-indigo-600 text-white shadow-xs"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            <span>💳 급여/정산 단가 기준</span>
            <span
              className={`px-1.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                activeTab === "pricing"
                  ? "bg-white/20 text-white"
                  : "bg-emerald-100 text-emerald-700"
              }`}
            >
              자동연동 활성
            </span>
          </button>
        </div>

        <div className="flex items-center gap-3 text-xs">
          {activeTab === "routes" ? (
            <>
              <span className="text-slate-500">
                전체 등록: <strong className="text-slate-800 font-bold">{totalCount}개</strong>
              </span>
              <span className="text-slate-300">|</span>
              <span className="text-emerald-600 font-semibold flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                활성 노선: <strong>{activeCount}개</strong>
              </span>
            </>
          ) : (
            <span className="text-indigo-600 font-semibold flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
              차종·주행거리·주말할증 자동 수당 산정 엔진 작동 중 ({pricingRules.length}개 기준)
            </span>
          )}
        </div>
      </div>

      {activeTab === "routes" ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* 좌측 5칸: 신규 노선 등록 폼 */}
          <div className="lg:col-span-5 sticky top-24">
            <RouteMasterForm />
          </div>

          {/* 우측 7칸: 등록된 노선 마스터 데이터 테이블 */}
          <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-800">등록된 표준 노선 목록</h3>
                <p className="text-[11px] text-slate-400">
                  배차표 생성 시 자동 완성 제안되는 노선들입니다.
                </p>
              </div>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
                총 {routes.length}건
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    <th scope="col" className="px-4 py-3">노선명</th>
                    <th scope="col" className="px-4 py-3">운행 구간</th>
                    <th scope="col" className="px-3 py-3 text-right">예상 거리</th>
                    <th scope="col" className="px-3 py-3 text-right">기본 통행료</th>
                    <th scope="col" className="px-3 py-3 text-center">상태</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                  {routes.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-slate-400">
                        <div className="flex flex-col items-center justify-center gap-1.5">
                          <span className="text-2xl">🗺️</span>
                          <p className="text-sm font-medium">등록된 노선 마스터가 없습니다.</p>
                          <p className="text-xs text-slate-400">
                            좌측 입력 폼을 통해 첫 표준 노선을 등록해 보세요.
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    routes.map((route: any) => (
                      <tr key={route.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="px-4 py-3">
                          <div className="font-bold text-slate-900">{route.name}</div>
                          <div className="text-[10px] text-slate-400">
                            {new Date(route.createdAt).toLocaleDateString("ko-KR")} 등록
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5 font-medium text-slate-800">
                            <span className="truncate max-w-[90px]">{route.departure}</span>
                            <span className="text-slate-400 text-[11px]">➔</span>
                            <span className="truncate max-w-[90px]">{route.destination}</span>
                          </div>
                        </td>
                        <td className="px-3 py-3 text-right font-semibold text-slate-700">
                          {route.estimatedDistance}{" "}
                          <span className="text-[10px] text-slate-400 font-normal">km</span>
                        </td>
                        <td className="px-3 py-3 text-right font-medium text-slate-600">
                          {route.defaultTollFee
                            ? `${route.defaultTollFee.toLocaleString()}원`
                            : "0원"}
                        </td>
                        <td className="px-3 py-3 text-center">
                          {route.isActive ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                              운행중
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-500 border border-slate-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                              중지
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <PricingRuleManager initialRules={pricingRules} />
      )}
    </>
  );
}
