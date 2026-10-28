"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import * as XLSX from "xlsx";
import { AgGridReact } from "ag-grid-react";
import { AllCommunityModule, ModuleRegistry, type ColDef } from "ag-grid-community";
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-quartz.css";
import {
  getMonthlySettlement,
  type MonthlySettlementItem,
  type MonthlySettlementSummary,
} from "./actions";
import Navbar from "../components/Navbar";

// AG Grid v32+ 필수 모듈 등록
ModuleRegistry.registerModules([AllCommunityModule]);

// 한국어 화폐 포맷터 (예: ₩100,000)
const formatCurrency = (val: number | null | undefined): string => {
  if (val === null || val === undefined || isNaN(val)) return "₩0";
  return `₩${val.toLocaleString("ko-KR")}`;
};

export default function SettlementDashboard() {
  // 기본 선택 연-월은 데이터가 존재하는 '2026-09'로 초기화
  const [yearMonth, setYearMonth] = useState<string>("2026-09");
  const [loading, setLoading] = useState<boolean>(false);
  const [rowData, setRowData] = useState<MonthlySettlementItem[]>([]);
  const [summary, setSummary] = useState<MonthlySettlementSummary>({
    totalOperations: 0,
    totalBilling: 0,
    totalPayout: 0,
    totalMargin: 0,
    marginRate: 0,
  });
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // 정산 데이터 비동기 Fetch 함수
  const loadSettlementData = useCallback(async (targetMonth: string) => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const result = await getMonthlySettlement(targetMonth);
      if (result.success) {
        setRowData(result.data);
        setSummary(result.summary);
      } else {
        setErrorMessage(result.error || "정산 데이터를 불러오지 못했습니다.");
        setRowData([]);
        setSummary({ totalOperations: 0, totalBilling: 0, totalPayout: 0, totalMargin: 0, marginRate: 0 });
      }
    } catch (err) {
      console.error(err);
      setErrorMessage("서버 통신 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  // 컴포넌트 마운트 시 초기 데이터 로드
  useEffect(() => {
    loadSettlementData(yearMonth);
  }, [loadSettlementData, yearMonth]);

  // AG Grid 컬럼 정의
  const columnDefs = useMemo<ColDef[]>(
    () => [
      {
        field: "clientName",
        headerName: "발주처",
        pinned: "left",
        width: 140,
        filter: true,
        cellClass: "font-semibold text-gray-800",
      },
      {
        field: "name",
        headerName: "노선명",
        pinned: "left",
        minWidth: 220,
        flex: 1,
        filter: true,
        cellClass: "text-gray-700",
      },
      {
        field: "operationCount",
        headerName: "총 운행 횟수",
        width: 130,
        type: "rightAligned",
        valueFormatter: (params) => {
          if (params.value === undefined || params.value === null) return "";
          return `${params.value.toLocaleString("ko-KR")}회`;
        },
      },
      {
        field: "billingPrice",
        headerName: "청구 단가",
        width: 140,
        type: "rightAligned",
        valueFormatter: (params) => {
          if (params.value === undefined || params.value === null) return "-";
          return formatCurrency(params.value);
        },
      },
      {
        field: "totalBillingAmount",
        headerName: "청구액 합계",
        width: 160,
        type: "rightAligned",
        valueFormatter: (params) => formatCurrency(params.value),
        cellClass: "font-medium text-gray-900",
      },
      {
        field: "totalPayoutAmount",
        headerName: "지급액 합계",
        width: 160,
        type: "rightAligned",
        valueFormatter: (params) => formatCurrency(params.value),
        cellClass: "text-gray-600",
      },
      {
        field: "operatingMargin",
        headerName: "수익 마진",
        width: 170,
        type: "rightAligned",
        // '수익 마진' 컬럼: 파란색 굵은 글씨로 렌더링 (cellRenderer)
        cellRenderer: (params: any) => {
          const val = params.value ?? 0;
          return (
            <span className="font-bold text-blue-600 tracking-tight">
              {formatCurrency(val)}
            </span>
          );
        },
      },
    ],
    []
  );

  // 하단 고정 합계(Pinned Bottom Row) 데이터
  const pinnedBottomRowData = useMemo(() => {
    if (rowData.length === 0) return [];
    return [
      {
        clientName: "합계",
        name: `총 ${rowData.length}개 노선`,
        operationCount: summary.totalOperations,
        billingPrice: null,
        totalBillingAmount: summary.totalBilling,
        totalPayoutAmount: summary.totalPayout,
        operatingMargin: summary.totalMargin,
      },
    ];
  }, [rowData, summary]);

  // 엑셀 내보내기 (.xlsx) 처리 함수
  const handleExportExcel = useCallback(() => {
    if (rowData.length === 0) {
      alert("내보낼 정산 데이터가 없습니다.");
      return;
    }

    // 엑셀 시트에 출력할 데이터 포맷 구성
    const excelRows = rowData.map((item) => ({
      "발주처": item.clientName,
      "노선명": item.name,
      "총 운행 횟수(회)": item.operationCount,
      "청구 단가(원)": item.billingPrice,
      "청구액 합계(원)": item.totalBillingAmount,
      "지급액 합계(원)": item.totalPayoutAmount,
      "수익 마진(원)": item.operatingMargin,
    }));

    // 하단 총 합계 행 추가
    excelRows.push({
      "발주처": "합계",
      "노선명": `총 ${rowData.length}개 노선`,
      "총 운행 횟수(회)": summary.totalOperations,
      "청구 단가(원)": "" as any,
      "청구액 합계(원)": summary.totalBilling,
      "지급액 합계(원)": summary.totalPayout,
      "수익 마진(원)": summary.totalMargin,
    });

    // 워크시트 생성
    const worksheet = XLSX.utils.json_to_sheet(excelRows);

    // 컬럼 너비(wch) 지정하여 보기 좋게 서식 적용
    worksheet["!cols"] = [
      { wch: 14 }, // 발주처
      { wch: 28 }, // 노선명
      { wch: 16 }, // 총 운행 횟수
      { wch: 16 }, // 청구 단가
      { wch: 18 }, // 청구액 합계
      { wch: 18 }, // 지급액 합계
      { wch: 18 }, // 수익 마진
    ];

    // 워크북 생성 및 시트 추가
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, `${yearMonth} 정산내역`);

    // 지정된 동적 파일명으로 다운로드 (월간_통합_정산내역_YYYY-MM.xlsx)
    const fileName = `월간_통합_정산내역_${yearMonth}.xlsx`;
    XLSX.writeFile(workbook, fileName);
  }, [rowData, summary, yearMonth]);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-gray-800">
      {/* 1. 상단 글로벌 네비게이션 바 */}
      <Navbar />

      <main className="p-4 md:p-6 max-w-7xl w-full mx-auto flex-1 flex flex-col">
        {/* 헤더 타이틀 및 엑셀 내보내기 */}
        <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-gray-200 gap-4 mb-6">
          <div>
            <div className="flex items-center gap-3">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
                정산 관리 ERP
              </span>
              <h1 className="text-xl md:text-2xl font-bold text-gray-900">전세버스 월간 통합 정산</h1>
            </div>
            <p className="text-xs md:text-sm text-gray-500 mt-1">
              월별 배차 실적을 바탕으로 발주처별 청구액, 기사 지급액 및 영업 마진을 자동 집계합니다.
            </p>
          </div>

          <div className="flex flex-col md:flex-row gap-2 w-full md:w-auto">
            {/* 엑셀 내보내기 버튼 */}
            <button
              type="button"
              onClick={handleExportExcel}
              disabled={rowData.length === 0}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg shadow-sm transition flex items-center justify-center gap-2 cursor-pointer w-full md:w-auto"
              title="현재 조회된 월간 정산 데이터를 Excel 파일로 다운로드합니다."
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span>엑셀 내보내기 (.xlsx)</span>
            </button>
          </div>
        </div>

      {/* 2. 상단 제어부: 연-월 선택 및 데이터 호출 컨트롤러 */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <label htmlFor="settlement-month" className="text-sm font-semibold text-gray-700">
            정산 대상 연-월:
          </label>
          <input
            id="settlement-month"
            type="month"
            value={yearMonth}
            onChange={(e) => setYearMonth(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white shadow-inner"
          />

          {/* 빠른 월간 선택 버튼들 */}
          <div className="flex items-center gap-1.5 ml-2">
            {["2026-07", "2026-06", "2026-09", "2026-10"].map((quickMonth) => (
              <button
                key={quickMonth}
                type="button"
                onClick={() => setYearMonth(quickMonth)}
                className={`px-2.5 py-1 text-xs font-medium rounded transition ${
                  yearMonth === quickMonth
                    ? "bg-blue-600 text-white font-bold"
                    : "bg-gray-100 hover:bg-gray-200 text-gray-700"
                }`}
              >
                {quickMonth === "2026-07" ? "2026-07 (이관)" : quickMonth}
              </button>
            ))}
          </div>

          <button
            type="button"
            disabled={loading}
            onClick={() => loadSettlementData(yearMonth)}
            title="배차 실적 또는 노선 단가 변경 시 현재 월의 매출/마진을 다시 계산하여 최신 데이터로 새로고침합니다."
            className="ml-2 px-4 py-2 bg-white hover:bg-blue-50 text-blue-700 border border-blue-300 disabled:opacity-50 text-sm font-bold rounded-xl shadow-xs transition flex items-center gap-2 cursor-pointer active:scale-95"
          >
            <svg
              className={`w-4 h-4 text-blue-600 ${loading ? "animate-spin" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            <span>{loading ? "정산 재계산 중..." : "최신 데이터 새로고침"}</span>
          </button>
        </div>

        <div className="flex items-center gap-2 text-xs text-gray-500">
          <span className="inline-block w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
          <span>월 선택 시 자동 반영 · 기준 데이터: <span className="font-mono text-gray-700 font-semibold">{yearMonth}</span></span>
        </div>
      </div>

      {/* 3. 상단 핵심 요약 지표 카드 (KPI Summary Cards) */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col">
          <span className="text-xs font-medium text-gray-500">총 운행 횟수</span>
          <span className="text-2xl font-bold text-gray-800 mt-1">
            {summary.totalOperations.toLocaleString("ko-KR")}
            <span className="text-sm font-normal text-gray-500 ml-1">회</span>
          </span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col">
          <span className="text-xs font-medium text-gray-500">청구액 합계 (매출)</span>
          <span className="text-2xl font-bold text-gray-900 mt-1">
            {formatCurrency(summary.totalBilling)}
          </span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col">
          <span className="text-xs font-medium text-gray-500">지급액 합계 (원가)</span>
          <span className="text-2xl font-bold text-rose-600 mt-1">
            {formatCurrency(summary.totalPayout)}
          </span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-blue-200 shadow-sm flex flex-col bg-gradient-to-br from-blue-50 to-white">
          <span className="text-xs font-semibold text-blue-600">수익 마진 (영업이익)</span>
          <span className="text-2xl font-extrabold text-blue-700 mt-1">
            {formatCurrency(summary.totalMargin)}
          </span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-emerald-200 shadow-sm flex flex-col bg-gradient-to-br from-emerald-50 to-white">
          <span className="text-xs font-semibold text-emerald-600">영업 마진율</span>
          <span className="text-2xl font-extrabold text-emerald-700 mt-1">
            {summary.marginRate}
            <span className="text-sm font-semibold ml-0.5">%</span>
          </span>
        </div>
      </div>

      {/* 에러 메시지 알림 바 */}
      {errorMessage && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg flex items-center justify-between">
          <span>⚠️ {errorMessage}</span>
          <button
            onClick={() => setErrorMessage(null)}
            className="text-red-500 hover:text-red-700 font-bold ml-4"
          >
            ×
          </button>
        </div>
      )}

      {/* 4. 하단 출력부: AG Grid 정산 집계 테이블 */}
      <div className="flex-1 flex flex-col bg-white border border-gray-300 rounded-xl shadow-sm overflow-hidden min-h-[420px]">
        <div className="px-5 py-3 border-b border-gray-200 flex items-center justify-between bg-gray-50">
          <h2 className="text-sm font-bold text-gray-700 flex items-center gap-2">
            <span>📋 노선별 월간 정산 내역</span>
            <span className="text-xs font-normal text-gray-500">({rowData.length}개 노선 집계됨)</span>
          </h2>
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-400">컬럼 헤더를 클릭하여 정렬 및 필터링 가능</span>
            <button
              type="button"
              onClick={handleExportExcel}
              disabled={rowData.length === 0}
              className="px-3 py-1 bg-white hover:bg-emerald-50 text-emerald-700 border border-emerald-300 text-xs font-semibold rounded-md shadow-2xs transition flex items-center gap-1 disabled:opacity-50 cursor-pointer"
            >
              <span>📥 엑셀(.xlsx) 저장</span>
            </button>
          </div>
        </div>

        <div className="overflow-x-auto whitespace-nowrap">
          <div className="ag-theme-quartz w-full min-w-[720px] h-[500px]">
            <AgGridReact
              modules={[AllCommunityModule]}
              rowData={rowData}
              columnDefs={columnDefs}
              pinnedBottomRowData={pinnedBottomRowData}
              defaultColDef={{
                sortable: true,
                filter: true,
                resizable: true,
                minWidth: 120,
              }}
              overlayNoRowsTemplate={`<span class="p-4 text-gray-400 text-sm">${yearMonth}월에 등록된 운행 배차 데이터가 없습니다.</span>`}
            />
          </div>
        </div>
      </div>
    </main>
  </div>
);
}
