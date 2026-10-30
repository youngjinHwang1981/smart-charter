"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createPricingRule, deletePricingRule } from "@/app/actions/masterData";

export interface PricingRuleRecord {
  id: string;
  capacityType: string;
  baseRate: number;
  extraFuelCostPerKm: number;
  weekendSurgeRate: number;
  startDate: string | Date;
  isActive: boolean;
}

const CAPACITY_LABELS: Record<string, { label: string; badge: string }> = {
  STANDARD_45: { label: "45인승 대형 표준", badge: "대형 45인승" },
  LARGE_47: { label: "47인승 대형", badge: "대형 47인승" },
  LUXURY_31: { label: "31인승 리무진 우등", badge: "우등 31인승" },
  PREMIUM_28: { label: "28인승 프리미엄 우등", badge: "우등 28인승" },
  COMPACT_25: { label: "25인승 중형 카운티/레스타", badge: "중형 25인승" },
  MINI_15: { label: "15인승 미니버스 (쏠라티)", badge: "미니 15인승" },
  VAN_11: { label: "11인승 비즈니스 밴", badge: "밴 11인승" },
  OTHER: { label: "기타 특수 차종", badge: "기타" },
};

interface PricingRuleManagerProps {
  initialRules: PricingRuleRecord[];
}

export default function PricingRuleManager({
  initialRules,
}: PricingRuleManagerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [capacityType, setCapacityType] = useState<string>("STANDARD_45");
  const [baseRate, setBaseRate] = useState<string>("70000");
  const [extraFuelCostPerKm, setExtraFuelCostPerKm] = useState<string>("500");
  const [weekendSurgeRate, setWeekendSurgeRate] = useState<string>("1.1");
  const [startDate, setStartDate] = useState<string>("2026-01-01");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // 시뮬레이션 예시 계산 (예: 34km 운행 시)
  const sampleDistance = 34;
  const parsedBase = Number(baseRate) || 0;
  const parsedPerKm = Number(extraFuelCostPerKm) || 0;
  const parsedSurge = Number(weekendSurgeRate) || 1.0;
  const weekdayPreview = parsedBase + sampleDistance * parsedPerKm;
  const weekendPreview = Math.round((weekdayPreview * parsedSurge) / 100) * 100;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    startTransition(async () => {
      const res = await createPricingRule({
        capacityType: capacityType as any,
        baseRate: Number(baseRate) || 0,
        extraFuelCostPerKm: Number(extraFuelCostPerKm) || 0,
        weekendSurgeRate: Number(weekendSurgeRate) || 1.0,
        startDate,
        isActive: true,
      });

      if (!res.success) {
        setErrorMessage(res.error || "단가 기준 등록에 실패했습니다.");
        return;
      }

      router.refresh();
    });
  };

  const handleDelete = (ruleId: string) => {
    if (!confirm("해당 차종 단가 기준을 삭제하시겠습니까?")) return;
    startTransition(async () => {
      await deletePricingRule(ruleId);
      router.refresh();
    });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* 좌측 5칸: 차종별 급여/정산 단가 기준 등록 폼 */}
      <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
          <span className="w-7 h-7 rounded-lg bg-blue-50 border border-blue-100 text-blue-600 flex items-center justify-center font-bold text-sm">
            💳
          </span>
          <div>
            <h3 className="text-sm font-bold text-slate-800">
              차종별 급여/정산 단가 기준 설정
            </h3>
            <p className="text-[11px] text-slate-400">
              일반 대절 및 단가 미지정 노선의 기사 수당을 주행거리(km)에 연동해 자동 산출합니다.
            </p>
          </div>
        </div>

        {errorMessage && (
          <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-semibold">
            ⚠️ {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              차종 / 인승 등급 <span className="text-rose-500">*</span>
            </label>
            <select
              value={capacityType}
              onChange={(e) => setCapacityType(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {Object.entries(CAPACITY_LABELS).map(([key, info]) => (
                <option key={key} value={key}>
                  {info.label}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                1회 기본 운행수당 (원) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                min="0"
                step="1000"
                value={baseRate}
                onChange={(e) => setBaseRate(e.target.value)}
                className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                km당 거리 가산 수당 (원/km)
              </label>
              <input
                type="number"
                min="0"
                step="50"
                value={extraFuelCostPerKm}
                onChange={(e) => setExtraFuelCostPerKm(e.target.value)}
                className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                주말(토·일) 할증 배율
              </label>
              <input
                type="number"
                min="1.0"
                max="3.0"
                step="0.05"
                value={weekendSurgeRate}
                onChange={(e) => setWeekendSurgeRate(e.target.value)}
                className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-[10px] text-slate-400 mt-0.5 block">
                예: 1.1 = 주말 10% 가산 / 1.0 = 할증 없음
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                적용 시작일
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* 실시간 수당 자동 산정 시뮬레이터 박스 */}
          <div className="rounded-xl bg-slate-900 text-white p-3.5 space-y-1.5 border border-slate-800">
            <div className="flex items-center justify-between text-[11px] text-blue-300 font-bold">
              <span>⚡ 자동 산정 시뮬레이션 (예: 34km 운행 시)</span>
              <span>실비(톨비·주차비) 별도 합산</span>
            </div>
            <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-800">
              <span className="text-slate-400">평일 운행 수당:</span>
              <span className="font-extrabold text-emerald-400">
                +{weekdayPreview.toLocaleString("ko-KR")}원
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">
                주말(토·일) 운행 수당 ({parsedSurge}배):
              </span>
              <span className="font-extrabold text-amber-300">
                +{weekendPreview.toLocaleString("ko-KR")}원
              </span>
            </div>
          </div>

          <button
            type="submit"
            disabled={isPending}
            className="w-full py-2.5 px-4 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs transition disabled:opacity-50 cursor-pointer"
          >
            {isPending ? "단가 기준 저장 중..." : "단가 기준 추가 / 업데이트"}
          </button>
        </form>
      </div>

      {/* 우측 7칸: 등록된 단가 기준 목록 테이블 */}
      <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-800">
              적용 중인 차종별 급여/정산 단가 기준표
            </h3>
            <p className="text-[11px] text-slate-400">
              기사 모바일 뷰 및 월간 정산에서 주행거리(km) 제출 시 아래 단가표가 자동 반영됩니다.
            </p>
          </div>
          <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
            활성 {initialRules.length}건
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold text-slate-500">
                <th className="px-4 py-3">차종 등급</th>
                <th className="px-3 py-3 text-right">1회 기본수당</th>
                <th className="px-3 py-3 text-right">km당 거리단가</th>
                <th className="px-3 py-3 text-center">주말 할증</th>
                <th className="px-3 py-3 text-right">34km(토) 예시</th>
                <th className="px-3 py-3 text-center">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
              {initialRules.map((rule) => {
                const info = CAPACITY_LABELS[rule.capacityType] || {
                  label: rule.capacityType,
                  badge: rule.capacityType,
                };
                const sample34Sat =
                  Math.round(
                    ((rule.baseRate + 34 * rule.extraFuelCostPerKm) *
                      (rule.weekendSurgeRate || 1)) /
                      100
                  ) * 100;

                return (
                  <tr key={rule.id} className="hover:bg-slate-50/70 transition">
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 font-bold text-[11px]">
                        {info.badge}
                      </span>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        {info.label}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-right font-bold text-slate-900">
                      {rule.baseRate.toLocaleString("ko-KR")}원
                    </td>
                    <td className="px-3 py-3 text-right font-semibold text-blue-600">
                      +{rule.extraFuelCostPerKm.toLocaleString("ko-KR")}원/km
                    </td>
                    <td className="px-3 py-3 text-center font-semibold text-amber-700">
                      ×{rule.weekendSurgeRate}배
                    </td>
                    <td className="px-3 py-3 text-right font-extrabold text-emerald-600">
                      +{sample34Sat.toLocaleString("ko-KR")}원
                    </td>
                    <td className="px-3 py-3 text-center">
                      <button
                        type="button"
                        onClick={() => handleDelete(rule.id)}
                        disabled={isPending}
                        className="text-[11px] font-bold text-rose-500 hover:text-rose-700 px-2 py-1 rounded hover:bg-rose-50 transition cursor-pointer"
                      >
                        삭제
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
