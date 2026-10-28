"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import Navbar from "./components/Navbar";
import { getDashboardStats, type DashboardStatsResult } from "./actions";

// 원화 화폐 포맷터
const formatCurrency = (val: number | null | undefined): string => {
  if (val === null || val === undefined || isNaN(val)) return "₩0";
  return `₩${val.toLocaleString("ko-KR")}`;
};

// Recharts 커스텀 툴팁
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-white/95 backdrop-blur-sm p-3.5 border border-gray-200 rounded-xl shadow-lg text-xs">
        <p className="font-bold text-gray-900 border-b pb-1.5 mb-2">
          📅 {data.fullDate || label} 운행 실적
        </p>
        <div className="space-y-1.5 font-medium">
          <div className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-blue-600">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-600 inline-block" />
              청구액 (매출):
            </span>
            <span className="font-bold text-gray-900">{formatCurrency(data.totalBilling)}</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-rose-500">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block" />
              지급액 (원가):
            </span>
            <span className="font-bold text-gray-900">{formatCurrency(data.totalPayout)}</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-emerald-600">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 inline-block" />
              영업이익:
            </span>
            <span className="font-extrabold text-emerald-600">{formatCurrency(data.operatingMargin)}</span>
          </div>
          <div className="flex items-center justify-between gap-4 pt-1 border-t text-gray-500">
            <span>배차 운행 횟수:</span>
            <span className="font-semibold text-gray-800">{data.operationCount}회</span>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

export default function ExecutiveDashboard() {
  const [stats, setStats] = useState<DashboardStatsResult | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        setLoading(true);
        const data = await getDashboardStats();
        setStats(data);
      } catch (err) {
        console.error("대시보드 통계 조회 실패:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchStats();
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-gray-800">
      {/* 1. 상단 글로벌 네비게이션 바 */}
      <Navbar />

      <main className="p-4 md:p-6 max-w-7xl w-full mx-auto flex-1 flex flex-col">
        {/* 대시보드 타이틀 및 빠른 액션 */}
        <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-gray-200 mb-6 gap-4">
          <div>
            <div className="flex items-center gap-3">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-700">
                경영진 리포트
              </span>
              <h1 className="text-xl md:text-2xl font-bold text-gray-900">전세버스 통합 경영 대시보드</h1>
            </div>
            <p className="text-xs md:text-sm text-gray-500 mt-1">
              최근 30일간의 배차 실적을 기반으로 매출, 원가, 영업이익 및 추이를 실시간 집계합니다.
            </p>
          </div>

          {/* 버튼 컨트롤 패널 (모바일: flex-col, 데스크탑: flex-row gap-2) */}
          <div className="flex flex-col md:flex-row gap-2 w-full md:w-auto">
            <Link
              href="/schedule"
              className="px-4 py-2 bg-white hover:bg-gray-50 border border-gray-300 text-gray-700 text-sm font-semibold rounded-lg shadow-2xs transition flex items-center justify-center gap-1.5 w-full md:w-auto"
            >
              <span>📅 배차 스케줄러</span>
            </Link>
            <Link
              href="/settlement"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg shadow-sm transition flex items-center justify-center gap-1.5 w-full md:w-auto"
            >
              <span>📊 월간 통합 정산</span>
            </Link>
            <Link
              href="/payroll"
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-lg shadow-sm transition flex items-center justify-center gap-1.5 w-full md:w-auto"
            >
              <span>👨‍✈️ 기사 급여 관리</span>
            </Link>
          </div>
        </div>

        {/* 2. 상단 핵심 지표 요약 카드 4개 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {/* 카드 1: 총매출 */}
          <div className="bg-white p-5 rounded-2xl border border-blue-100 shadow-sm relative overflow-hidden flex flex-col justify-between">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                총매출 (청구액)
              </span>
              <span className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center text-base">
                💰
              </span>
            </div>
            <div>
              <div className="text-2xl lg:text-3xl font-extrabold text-gray-900 tracking-tight">
                {formatCurrency(stats?.totalBilling)}
              </div>
              <div className="flex items-center justify-between text-xs mt-2 text-gray-400">
                <span>최근 30일 누적 청구액</span>
                <span className="text-blue-600 font-semibold bg-blue-50 px-2 py-0.5 rounded">
                  매출 100%
                </span>
              </div>
            </div>
          </div>

          {/* 카드 2: 총원가 */}
          <div className="bg-white p-5 rounded-2xl border border-rose-100 shadow-sm relative overflow-hidden flex flex-col justify-between">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                총원가 (지급액)
              </span>
              <span className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center text-base">
                🏷️
              </span>
            </div>
            <div>
              <div className="text-2xl lg:text-3xl font-extrabold text-rose-600 tracking-tight">
                {formatCurrency(stats?.totalPayout)}
              </div>
              <div className="flex items-center justify-between text-xs mt-2 text-gray-400">
                <span>기사 수당 및 외주 원가</span>
                <span className="text-rose-600 font-semibold bg-rose-50 px-2 py-0.5 rounded">
                  원가율 {stats ? Math.round((stats.totalPayout / (stats.totalBilling || 1)) * 100) : 0}%
                </span>
              </div>
            </div>
          </div>

          {/* 카드 3: 영업이익 */}
          <div className="bg-white p-5 rounded-2xl border border-emerald-100 shadow-sm relative overflow-hidden flex flex-col justify-between bg-gradient-to-br from-white via-white to-emerald-50/40">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">
                영업이익 (마진)
              </span>
              <span className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center text-base">
                💎
              </span>
            </div>
            <div>
              <div className="text-2xl lg:text-3xl font-extrabold text-emerald-700 tracking-tight">
                {formatCurrency(stats?.operatingMargin)}
              </div>
              <div className="flex items-center justify-between text-xs mt-2">
                <span className="text-gray-400">순수익 마진</span>
                <span className="text-emerald-700 font-bold bg-emerald-100/70 px-2 py-0.5 rounded">
                  마진율 {stats?.marginRate || 0}%
                </span>
              </div>
            </div>
          </div>

          {/* 카드 4: 총 운행 횟수 */}
          <div className="bg-white p-5 rounded-2xl border border-indigo-100 shadow-sm relative overflow-hidden flex flex-col justify-between">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                총 운행 횟수
              </span>
              <span className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center text-base">
                🚌
              </span>
            </div>
            <div>
              <div className="text-2xl lg:text-3xl font-extrabold text-indigo-900 tracking-tight">
                {(stats?.totalOperations || 0).toLocaleString("ko-KR")}
                <span className="text-base font-semibold text-gray-500 ml-1">회</span>
              </div>
              <div className="flex items-center justify-between text-xs mt-2 text-gray-400">
                <span>{stats?.activeRoutesCount || 0}개 정기 노선 운행</span>
                <span className="text-indigo-600 font-semibold bg-indigo-50 px-2 py-0.5 rounded">
                  정상 운행 100%
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 3. 화면 중앙: Recharts 일자별 매출 및 원가 추이 콤보 차트 */}
        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm mb-6 flex flex-col">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-gray-100 mb-6 gap-2">
            <div>
              <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <span>📊 일자별 매출 및 원가 추이 비교</span>
                <span className="text-xs font-normal text-gray-400">
                  (최근 30일 배차 실적 기준)
                </span>
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                청구액(막대) 대비 원가(적색선)와 영업 마진(녹색 점선)의 추세를 분석합니다.
              </p>
            </div>

            <div className="flex items-center gap-3 text-xs text-gray-500">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-xs bg-blue-500 inline-block" /> 매출(청구액)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-0.5 bg-rose-500 inline-block" /> 원가(지급액)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-0.5 bg-emerald-500 border-b border-dashed inline-block" /> 영업이익
              </span>
            </div>
          </div>

          {/* Recharts 컴포넌트 렌더링 영역 */}
          <div className="w-full h-[380px]">
            {loading ? (
              <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm">
                <svg className="animate-spin h-5 w-5 mr-3 text-blue-600" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                데이터 로딩 중...
              </div>
            ) : !stats || stats.dailyTrends.length === 0 ? (
              <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm">
                표시할 일자별 배차 실적 데이터가 없습니다.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={stats.dailyTrends}
                  margin={{ top: 10, right: 20, left: 10, bottom: 20 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                  <XAxis
                    dataKey="date"
                    stroke="#94A3B8"
                    fontSize={12}
                    tickLine={false}
                    axisLine={{ stroke: "#E2E8F0" }}
                  />
                  <YAxis
                    stroke="#94A3B8"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) => `${value / 10000}만`}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend
                    verticalAlign="top"
                    height={36}
                    wrapperStyle={{ fontSize: "12px", paddingTop: "0px" }}
                  />
                  {/* 청구액: 바 차트 */}
                  <Bar
                    dataKey="totalBilling"
                    name="매출(청구액)"
                    fill="#3B82F6"
                    radius={[6, 6, 0, 0]}
                    maxBarSize={44}
                  />
                  {/* 원가: 적색 라인 */}
                  <Line
                    type="monotone"
                    dataKey="totalPayout"
                    name="원가(지급액)"
                    stroke="#EF4444"
                    strokeWidth={3}
                    dot={{ r: 4, fill: "#EF4444", strokeWidth: 1, stroke: "#FFF" }}
                    activeDot={{ r: 6 }}
                  />
                  {/* 영업이익: 에메랄드 라인 */}
                  <Line
                    type="monotone"
                    dataKey="operatingMargin"
                    name="영업이익(마진)"
                    stroke="#10B981"
                    strokeWidth={2.5}
                    strokeDasharray="4 4"
                    dot={{ r: 4, fill: "#10B981", strokeWidth: 1, stroke: "#FFF" }}
                    activeDot={{ r: 6 }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* 4. 하단: 노선별 누적 실적 및 빠른 작업 카드 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 노선별 실적 요약 테이블 (2열 차지) */}
          <div className="lg:col-span-2 bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 mb-4">
              <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                <span>🚍 주요 노선별 매출 및 마진 현황</span>
                <span className="text-xs font-normal text-gray-400">
                  ({stats?.routeStats.length || 0}개 노선)
                </span>
              </h3>
              <Link
                href="/settlement"
                className="text-xs font-semibold text-blue-600 hover:text-blue-800 transition"
              >
                전체 정산 내역 보기 →
              </Link>
            </div>

            {/* 노선별 실적 요약 테이블 (모바일 가로 스크롤 및 텍스트 줄바꿈 깨짐 방지) */}
            <div className="overflow-x-auto whitespace-nowrap">
              <table className="w-full text-left text-xs min-w-[600px]">
                <thead>
                  <tr className="bg-gray-50 text-gray-500 uppercase border-b border-gray-200 font-semibold">
                    <th className="py-2.5 px-3">발주처</th>
                    <th className="py-2.5 px-3">노선명</th>
                    <th className="py-2.5 px-3 text-right">운행 횟수</th>
                    <th className="py-2.5 px-3 text-right">청구액(매출)</th>
                    <th className="py-2.5 px-3 text-right">지급액(원가)</th>
                    <th className="py-2.5 px-3 text-right">영업이익</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {stats?.routeStats.map((route) => (
                    <tr key={route.routeId} className="hover:bg-slate-50 transition">
                      <td className="py-3 px-3 font-semibold text-gray-800">{route.clientName}</td>
                      <td className="py-3 px-3 font-medium text-gray-700">{route.routeName}</td>
                      <td className="py-3 px-3 text-right font-medium text-gray-900">
                        {route.count}회
                      </td>
                      <td className="py-3 px-3 text-right font-bold text-gray-900">
                        {formatCurrency(route.totalBilling)}
                      </td>
                      <td className="py-3 px-3 text-right text-rose-600 font-medium">
                        {formatCurrency(route.totalPayout)}
                      </td>
                      <td className="py-3 px-3 text-right font-extrabold text-blue-600">
                        {formatCurrency(route.operatingMargin)}
                      </td>
                    </tr>
                  ))}
                  {(!stats || stats.routeStats.length === 0) && (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-gray-400">
                        등록된 노선 실적 데이터가 없습니다.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* ERP 빠른 바로가기 패널 (1열 차지) */}
          <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex flex-col justify-between">
            <div>
              <h3 className="text-sm font-bold text-gray-900 pb-3 border-b border-gray-100 mb-4">
                ⚡ 빠른 업무 바로가기
              </h3>
              <div className="space-y-2.5">
                <Link
                  href="/schedule"
                  className="p-3 rounded-xl border border-gray-200 hover:border-blue-300 hover:bg-blue-50/50 transition flex items-center justify-between group"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl">📅</span>
                    <div>
                      <div className="text-xs font-bold text-gray-900 group-hover:text-blue-600">
                        일일 배차 스케줄러
                      </div>
                      <div className="text-[11px] text-gray-400">
                        10일치 날짜별 기사 및 차량 배정 수정
                      </div>
                    </div>
                  </div>
                  <span className="text-gray-300 group-hover:text-blue-500 font-bold">→</span>
                </Link>

                <Link
                  href="/settlement"
                  className="p-3 rounded-xl border border-gray-200 hover:border-blue-300 hover:bg-blue-50/50 transition flex items-center justify-between group"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl">📊</span>
                    <div>
                      <div className="text-xs font-bold text-gray-900 group-hover:text-blue-600">
                        월간 통합 정산 관리
                      </div>
                      <div className="text-[11px] text-gray-400">
                        발주처별 청구액 및 노선별 정산 엑셀 출력
                      </div>
                    </div>
                  </div>
                  <span className="text-gray-300 group-hover:text-blue-500 font-bold">→</span>
                </Link>

                <Link
                  href="/payroll"
                  className="p-3 rounded-xl border border-gray-200 hover:border-emerald-300 hover:bg-emerald-50/50 transition flex items-center justify-between group"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl">👨‍✈️</span>
                    <div>
                      <div className="text-xs font-bold text-gray-900 group-hover:text-emerald-600">
                        기사별 월간 급여 정산
                      </div>
                      <div className="text-[11px] text-gray-400">
                        직영/지입/용차별 운행 수당 집계 및 급여대장
                      </div>
                    </div>
                  </div>
                  <span className="text-gray-300 group-hover:text-emerald-500 font-bold">→</span>
                </Link>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-gray-100 text-center">
              <span className="text-[11px] text-gray-400">
                스마트투어 ERP 시스템 • 버전 1.0.0
              </span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}