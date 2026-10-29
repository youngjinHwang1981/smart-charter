"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import DriverActionForm from "./DriverActionForm";

export interface SerializedDriverInfo {
  id: string;
  name: string;
  employmentType: string;
  companyName: string;
}

export interface SerializedScheduleItem {
  id: string;
  dispatchId: string;
  date: string; // YYYY-MM-DD
  dayOfWeek: string; // 월, 화, 수...
  time: string; // "06:30" 등
  routeName: string;
  clientName: string;
  plateNumber: string;
  coDriver: string | null; // 동승 기사 (교대 시)
  type: "FIXED" | "NORMAL";
  routeType: "FIXED_ROUTE" | "CUSTOM_CHARTER";
  payoutPrice: number;
  status: string;
  estimatedDistance?: number | null;
  defaultTollFee?: number | null;
  actualDistance?: number | null;
  actualTollFee?: number | null;
  receiptImageUrl?: string | null;
  isToday: boolean;
}

export interface SerializedPayrollSummary {
  yearMonth: string;
  totalCount: number;
  grossPay: number;
  incomeTax: number;
  localIncomeTax: number;
  totalDeductions: number;
  netPay: number;
}

interface DriverMobileViewProps {
  driver: SerializedDriverInfo;
  currentMonth: string;
  todayString: string;
  availableMonths: string[];
  schedule: SerializedScheduleItem[];
  payroll: SerializedPayrollSummary;
}

export default function DriverMobileView({
  driver,
  currentMonth,
  todayString,
  availableMonths,
  schedule,
  payroll,
}: DriverMobileViewProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"timeline" | "payroll">("timeline");
  const [copied, setCopied] = useState(false);

  // 고용 형태 레이블 매핑
  const employmentLabel =
    driver.employmentType === "OWN"
      ? "직영 (자차)"
      : driver.employmentType === "AFFILIATED"
      ? "지입 기사"
      : "용차/외주";

  // 오늘의 배차 항목들 선별
  const todayDispatches = schedule.filter((s) => s.isToday);
  // 향후 및 기타 배차 항목들
  const otherDispatches = schedule.filter((s) => !s.isToday);

  // 월 전환 핸들러
  const handleMonthChange = (month: string) => {
    router.push(`/driver/${driver.id}?month=${month}`);
  };

  // 모바일 링크 복사 핸들러
  const handleCopyLink = () => {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex justify-center text-slate-100 font-sans antialiased">
      {/* 1. 컨테이너 제어: max-w-md mx-auto로 모바일 앱 종횡비 고정 */}
      <div className="w-full max-w-md mx-auto min-h-screen bg-slate-900 border-x border-slate-800 shadow-2xl flex flex-col pb-20 relative">
        
        {/* 네이티브 스타일 모바일 상단 바 */}
        <header className="sticky top-0 z-30 bg-slate-900/95 backdrop-blur-md border-b border-slate-800/80 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center font-bold text-white shadow-md text-sm border border-blue-400/30">
              {driver.name.slice(0, 1)}
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-bold text-white leading-tight">
                  {driver.name} 기사님
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 font-semibold border border-blue-500/30">
                  {employmentLabel}
                </span>
              </div>
              <p className="text-[11px] text-slate-400">{driver.companyName} 포털</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={handleCopyLink}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition text-xs flex items-center gap-1 border border-slate-700"
              title="포털 링크 복사"
            >
              {copied ? (
                <span className="text-emerald-400 text-[11px] font-bold px-1">복사됨!</span>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              )}
            </button>
            <button
              onClick={() => router.refresh()}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition border border-slate-700"
              title="새로고침"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>
        </header>

        {/* 메인 스크롤 콘텐츠 */}
        <main className="px-4 pt-3.5 space-y-4 flex-1">
          
          {/* 월 선택 빠른 필터 탭 */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {availableMonths.map((m) => (
              <button
                key={m}
                onClick={() => handleMonthChange(m)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all shadow-sm ${
                  currentMonth === m
                    ? "bg-blue-600 text-white shadow-blue-500/30 font-bold"
                    : "bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-700/60"
                }`}
              >
                {m.replace("-", "년 ")}월
                {m === "2026-10" ? " (당월)" : ""}
              </button>
            ))}
          </div>

          {/* 2. 상단 요약 카드: 기사 이름, 당월 누적 운행 횟수, 예상 실지급액 시각적 강조 */}
          <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-950 via-slate-900 to-slate-900 border border-indigo-500/40 p-5 shadow-2xl">
            {/* 데코레이션 블러 그라데이션 */}
            <div className="absolute top-0 right-0 -mr-8 -mt-8 w-32 h-32 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none"></div>
            <div className="absolute bottom-0 left-0 -ml-8 -mb-8 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl pointer-events-none"></div>

            <div className="relative z-10 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-300">
                    {currentMonth.replace("-", "년 ")}월 정산 리포트
                  </span>
                  <h2 className="text-lg font-extrabold text-white">
                    {driver.name} <span className="text-sm font-normal text-slate-300">기사</span>
                  </h2>
                </div>

                {/* 당월 누적 운행 횟수 뱃지 */}
                <div className="text-right">
                  <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-bold">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                    <span>누적 {payroll.totalCount}회 운행</span>
                  </div>
                </div>
              </div>

              {/* 예상 실지급액 핵심 지표 */}
              <div className="pt-2">
                <span className="text-xs text-slate-400 block font-medium">당월 예상 실지급액 (차인지급액)</span>
                <div className="flex items-baseline gap-1 mt-0.5">
                  <span className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white via-slate-100 to-indigo-200 tracking-tight">
                    {payroll.netPay.toLocaleString()}
                  </span>
                  <span className="text-sm font-bold text-slate-300">원</span>
                </div>
              </div>

              {/* 세전 총액 vs 3.3% 공제액 서브 그리드 */}
              <div className="pt-3 border-t border-slate-800 grid grid-cols-2 gap-3 text-xs">
                <div className="bg-slate-800/40 p-2.5 rounded-xl border border-slate-800/80">
                  <span className="text-slate-400 block text-[11px]">총 운행수당 (세전)</span>
                  <span className="font-bold text-slate-100 text-sm mt-0.5 block">
                    {payroll.grossPay.toLocaleString()}원
                  </span>
                </div>
                <div className="bg-slate-800/40 p-2.5 rounded-xl border border-slate-800/80">
                  <span className="text-rose-400/90 block text-[11px]">소득세 공제 (3.3%)</span>
                  <span className="font-bold text-rose-300 text-sm mt-0.5 block">
                    -{payroll.totalDeductions.toLocaleString()}원
                  </span>
                </div>
              </div>
            </div>
          </section>

          {/* 탭 네비게이션: 배차 타임라인 vs 급여 명세 */}
          <div className="bg-slate-800/70 p-1 rounded-xl flex items-center border border-slate-700/60">
            <button
              onClick={() => setActiveTab("timeline")}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                activeTab === "timeline"
                  ? "bg-blue-600 text-white shadow-md shadow-blue-600/30"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              배차 타임라인 ({schedule.length})
            </button>
            <button
              onClick={() => setActiveTab("payroll")}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                activeTab === "payroll"
                  ? "bg-blue-600 text-white shadow-md shadow-blue-600/30"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />
              </svg>
              급여 산출 내역
            </button>
          </div>

          {/* 3 & 4. 타임라인 리스트: '오늘의 배차' 최상단 강조 + 세로형 카드 리스트 */}
          {activeTab === "timeline" && (
            <div className="space-y-4">
              
              {/* [3-A] '오늘의 배차' 섹션 (최상단 강조 카드) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between px-1">
                  <h3 className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-blue-500 animate-ping"></span>
                    오늘의 배차 ({todayString})
                  </h3>
                  <span className="text-[11px] text-blue-400 font-semibold">
                    {todayDispatches.length > 0 ? `${todayDispatches.length}건 배정됨` : "배차 없음"}
                  </span>
                </div>

                {todayDispatches.length > 0 ? (
                  todayDispatches.map((item) => (
                    <article
                      key={item.id}
                      className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-900/60 via-indigo-900/50 to-slate-800 border-2 border-blue-500 p-4 shadow-xl shadow-blue-500/10 space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        {/* 오늘의 배차 강조 뱃지 */}
                        <div className="flex items-center gap-1.5">
                          <span className="px-2 py-0.5 rounded-full bg-rose-500 text-white text-[11px] font-black tracking-wide flex items-center gap-1 shadow-sm">
                            <span>🔥</span> 오늘의 배차
                          </span>
                          <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-400/40 text-[10px] font-bold">
                            {item.type === "FIXED" ? "고정 노선" : "일반 배차"}
                          </span>
                        </div>

                        <span className="text-xs font-extrabold text-emerald-400">
                          {item.payoutPrice > 0 ? `+${item.payoutPrice.toLocaleString()}원` : "수당 산정"}
                        </span>
                      </div>

                      {/* 노선명 */}
                      <div>
                        <h4 className="text-base font-bold text-white tracking-tight flex items-center gap-1.5">
                          {item.routeName}
                        </h4>
                        <span className="text-[11px] text-blue-200/80 font-medium mt-0.5 block">
                          고객사: {item.clientName}
                        </span>
                      </div>

                      {/* 세부 정보 3종 카드 구성 */}
                      <div className="pt-2 border-t border-blue-800/40 grid grid-cols-3 gap-2 text-xs">
                        <div className="bg-slate-900/70 p-2 rounded-lg border border-slate-700/60">
                          <span className="text-[10px] text-slate-400 block font-medium">운행 시간</span>
                          <span className="font-bold text-white text-[11px] mt-0.5 block truncate">
                            ⏰ {item.time}
                          </span>
                        </div>

                        <div className="bg-slate-900/70 p-2 rounded-lg border border-slate-700/60">
                          <span className="text-[10px] text-slate-400 block font-medium">탑승 차량</span>
                          <span className="font-bold text-amber-300 text-[11px] mt-0.5 block truncate">
                            🚌 {item.plateNumber}호
                          </span>
                        </div>

                        <div className="bg-slate-900/70 p-2 rounded-lg border border-slate-700/60">
                          <span className="text-[10px] text-slate-400 block font-medium">동승/교대</span>
                          <span className="font-bold text-indigo-300 text-[11px] mt-0.5 block truncate">
                            {item.coDriver ? `👥 ${item.coDriver}` : "👤 단독"}
                          </span>
                        </div>
                      </div>

                      {/* 투 트랙 운행 종료 및 자동/수동 정산 제어 폼 */}
                      <DriverActionForm
                        dispatchId={item.dispatchId}
                        routeType={item.routeType}
                        status={item.status}
                        estimatedDistance={item.estimatedDistance}
                        defaultTollFee={item.defaultTollFee}
                        actualDistance={item.actualDistance}
                        actualTollFee={item.actualTollFee}
                        receiptImageUrl={item.receiptImageUrl}
                      />
                    </article>
                  ))
                ) : (
                  <div className="rounded-xl border border-dashed border-slate-800 bg-slate-800/30 p-4 text-center text-xs text-slate-400">
                    <p>오늘 예정된 운행 배차가 없습니다 (휴무 또는 대기)</p>
                  </div>
                )}
              </div>

              {/* [3-B] 향후 주간 / 월간 배차 타임라인 세로형 카드 리스트 */}
              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-between px-1">
                  <h3 className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    주간 및 월간 배차 일정 ({otherDispatches.length})
                  </h3>
                  <span className="text-[11px] text-slate-400">{currentMonth}월 전체</span>
                </div>

                {otherDispatches.length === 0 ? (
                  <div className="rounded-xl border border-slate-800 bg-slate-800/30 p-8 text-center text-xs text-slate-400">
                    해당 월에 등록된 배차 일정이 없습니다.
                  </div>
                ) : (
                  <div className="relative pl-3 space-y-3 before:absolute before:left-1.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-800">
                    {otherDispatches.map((item) => (
                      <article
                        key={item.id}
                        className="relative rounded-xl border border-slate-800 bg-slate-800/60 hover:bg-slate-800/90 transition p-3.5 space-y-2 shadow-sm"
                      >
                        {/* 타임라인 노드 불릿 */}
                        <div className="absolute -left-3.5 top-4 w-2.5 h-2.5 rounded-full bg-slate-700 border-2 border-slate-900"></div>

                        {/* 상단: 일자/시간 + 구분 뱃지 */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-200 bg-slate-700/80 px-2 py-0.5 rounded">
                              {item.date} ({item.dayOfWeek})
                            </span>
                            <span
                              className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                                item.type === "FIXED"
                                  ? "bg-indigo-500/20 text-indigo-300 border-indigo-500/40"
                                  : "bg-amber-500/20 text-amber-300 border-amber-500/40"
                              }`}
                            >
                              {item.type === "FIXED" ? "고정" : "일반"}
                            </span>
                          </div>

                          <span className="text-xs font-bold text-emerald-400">
                            {item.payoutPrice > 0 ? `+${item.payoutPrice.toLocaleString()}원` : "수당산정"}
                          </span>
                        </div>

                        {/* 노선명 */}
                        <div>
                          <h4 className="text-sm font-semibold text-slate-100 flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
                            {item.routeName}
                          </h4>
                          <span className="text-[11px] text-slate-400 ml-3 block mt-0.5">
                            고객사: {item.clientName}
                          </span>
                        </div>

                        {/* 4. 카드 하단 필수 정보 구성: [운행 날짜/시간], [탑승 차량 번호], [동승 기사(교대 시)] */}
                        <div className="pt-2 border-t border-slate-700/50 flex items-center justify-between text-xs text-slate-300">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[11px] text-slate-400 font-medium">시간:</span>
                            <span className="font-semibold text-slate-200 text-[11px]">⏰ {item.time}</span>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <span className="text-[11px] text-slate-400 font-medium">차량:</span>
                            <span className="font-bold text-amber-300 text-[11px]">🚌 {item.plateNumber}호</span>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <span className="text-[11px] text-slate-400 font-medium">동승/교대:</span>
                            <span className="font-semibold text-indigo-300 text-[11px]">
                              {item.coDriver ? `👥 ${item.coDriver}` : "👤 단독"}
                            </span>
                          </div>
                        </div>

                        {/* 투 트랙 운행 종료 및 정산 제어 폼 */}
                        <DriverActionForm
                          dispatchId={item.dispatchId}
                          routeType={item.routeType}
                          status={item.status}
                          estimatedDistance={item.estimatedDistance}
                          defaultTollFee={item.defaultTollFee}
                          actualDistance={item.actualDistance}
                          actualTollFee={item.actualTollFee}
                          receiptImageUrl={item.receiptImageUrl}
                        />
                      </article>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 급여 상세 명세서 탭 */}
          {activeTab === "payroll" && (
            <div className="space-y-3">
              <div className="rounded-2xl border border-slate-800 bg-slate-800/70 p-4 space-y-3 shadow-md">
                <h3 className="text-xs font-bold text-slate-300 border-b border-slate-700 pb-2 flex items-center justify-between">
                  <span>💰 원천징수 세액 공제 명세 (소득세 3.3%)</span>
                  <span className="text-[10px] text-indigo-300 bg-indigo-500/20 px-1.5 py-0.5 rounded border border-indigo-500/30">
                    국고금단수계산법(10원절사)
                  </span>
                </h3>

                <div className="space-y-2 text-xs">
                  <div className="flex justify-between items-center text-slate-300">
                    <span>총 운행수당 (지급 원금)</span>
                    <span className="font-bold text-white text-sm">
                      {payroll.grossPay.toLocaleString()} 원
                    </span>
                  </div>

                  <div className="flex justify-between items-center text-slate-400">
                    <span className="pl-2">└ 소득세 (3.0%)</span>
                    <span className="text-rose-400 font-medium">
                      -{payroll.incomeTax.toLocaleString()} 원
                    </span>
                  </div>

                  <div className="flex justify-between items-center text-slate-400">
                    <span className="pl-2">└ 지방소득세 (0.3%)</span>
                    <span className="text-rose-400 font-medium">
                      -{payroll.localIncomeTax.toLocaleString()} 원
                    </span>
                  </div>

                  <div className="flex justify-between items-center text-slate-300 pt-1.5 border-t border-slate-700/60 font-semibold">
                    <span className="text-rose-300">총 공제세액 (3.3%)</span>
                    <span className="text-rose-400 font-bold">
                      -{payroll.totalDeductions.toLocaleString()} 원
                    </span>
                  </div>
                </div>

                <div className="p-3.5 bg-gradient-to-r from-indigo-950/80 to-blue-950/80 border border-indigo-500/40 rounded-xl flex justify-between items-center mt-3 shadow-inner">
                  <div>
                    <span className="text-xs font-bold text-indigo-200 block">
                      실수령 예상액 (차인지급액)
                    </span>
                    <span className="text-[10px] text-slate-400">공제 후 입금 예정 금액</span>
                  </div>
                  <span className="text-lg font-black text-emerald-400 tracking-tight">
                    {payroll.netPay.toLocaleString()} 원
                  </span>
                </div>
              </div>

              {/* 안내 사항 */}
              <div className="text-[11px] text-slate-500 p-3.5 rounded-xl bg-slate-800/30 border border-slate-800/60 space-y-1 leading-relaxed">
                <p>• 배차 및 급여 데이터는 본사 ERP 배차 시스템과 실시간으로 연동됩니다.</p>
                <p>• 소득세법 제127조 및 제129조에 의거하여 원천징수 3.3%가 자동 반영되었습니다.</p>
                <p>• 노선별 통행료, 유류비 및 기타 수당은 월말 정산 시 확정됩니다.</p>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
