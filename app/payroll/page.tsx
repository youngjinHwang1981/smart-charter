"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import * as XLSX from "xlsx";
import { AgGridReact } from "ag-grid-react";
import { AllCommunityModule, ModuleRegistry, type ColDef } from "ag-grid-community";
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-quartz.css";
import {
  getMonthlyPayroll,
  type DriverPayrollItem,
  type MonthlyPayrollSummary,
} from "./actions";
import { calculatePayroll } from "@/src/lib/payroll-calculator";
import Navbar from "../components/Navbar";

// AG Grid v32+ 필수 모듈 등록
ModuleRegistry.registerModules([AllCommunityModule]);

// 한국어 화폐 포맷터 (예: ₩100,000)
const formatCurrency = (val: number | null | undefined): string => {
  if (val === null || val === undefined || isNaN(val)) return "₩0";
  return `₩${val.toLocaleString("ko-KR")}`;
};

// 고용 형태 뱃지 텍스트 및 스타일 맵핑
const getEmploymentTypeBadge = (type: string) => {
  switch (type) {
    case "OWN":
      return {
        label: "직영 (OWN)",
        className: "bg-blue-100 text-blue-800 border-blue-200",
      };
    case "AFFILIATED":
      return {
        label: "지입 (AFFILIATED)",
        className: "bg-amber-100 text-amber-800 border-amber-200",
      };
    case "OUTSOURCED":
      return {
        label: "용차 (OUTSOURCED)",
        className: "bg-purple-100 text-purple-800 border-purple-200",
      };
    default:
      return {
        label: type || "기타",
        className: "bg-gray-100 text-gray-700 border-gray-200",
      };
  }
};

export default function PayrollDashboard() {
  // 기본 선택 연-월은 데이터가 존재하는 '2026-09'로 초기화
  const [yearMonth, setYearMonth] = useState<string>("2026-09");
  const [loading, setLoading] = useState<boolean>(false);
  const [rowData, setRowData] = useState<DriverPayrollItem[]>([]);
  const [summary, setSummary] = useState<MonthlyPayrollSummary>({
    totalDrivers: 0,
    totalOperations: 0,
    totalPayrollAmount: 0,
    totalDeductionAmount: 0,
    totalNetAmount: 0,
    averagePayout: 0,
    averageNetPayout: 0,
  });
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // 급여 데이터 비동기 Fetch 함수
  const loadPayrollData = useCallback(async (targetMonth: string) => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const result = await getMonthlyPayroll(targetMonth);
      if (result.success) {
        setRowData(result.data);
        setSummary(result.summary);
      } else {
        setErrorMessage(result.error || "급여 데이터를 불러오지 못했습니다.");
        setRowData([]);
        setSummary({
          totalDrivers: 0,
          totalOperations: 0,
          totalPayrollAmount: 0,
          totalDeductionAmount: 0,
          totalNetAmount: 0,
          averagePayout: 0,
          averageNetPayout: 0,
        });
      }
    } catch (err) {
      console.error(err);
      setErrorMessage("서버 통신 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  // 초기 데이터 로드
  useEffect(() => {
    loadPayrollData(yearMonth);
  }, [loadPayrollData, yearMonth]);

  // 급여 대장 엑셀 다운로드 (.xlsx)
  const handleExportExcel = useCallback(() => {
    if (rowData.length === 0) {
      alert("내보낼 급여 데이터가 없습니다.");
      return;
    }

    const excelRows = rowData.map((item) => {
      const badge = getEmploymentTypeBadge(item.employmentType);
      return {
        "기사명": item.driverName,
        "고용 형태": badge.label,
        "부양가족 수(명)": item.dependentsCount,
        "총 운행 횟수(회)": item.operationCount,
        "총 지급액 (세전)": item.totalPayoutAmount,
        "소득세 (3%)": item.incomeTax ?? Math.floor(item.totalPayoutAmount * 0.03),
        "지방소득세 (0.3%)": item.localIncomeTax ?? Math.floor(item.totalPayoutAmount * 0.003),
        "공제 총액 (3.3%)": item.totalDeductionAmount,
        "실지급액 (세후 차인지급액)": item.netPayoutAmount,
      };
    });

    // 합계 행 추가
    excelRows.push({
      "기사명": "합계",
      "고용 형태": `총 ${summary.totalDrivers}명`,
      "부양가족 수(명)": "" as any,
      "총 운행 횟수(회)": summary.totalOperations,
      "총 지급액 (세전)": summary.totalPayrollAmount,
      "소득세 (3%)": Math.floor(summary.totalDeductionAmount * (3 / 3.3)),
      "지방소득세 (0.3%)": Math.floor(summary.totalDeductionAmount * (0.3 / 3.3)),
      "공제 총액 (3.3%)": summary.totalDeductionAmount,
      "실지급액 (세후 차인지급액)": summary.totalNetAmount,
    });

    const worksheet = XLSX.utils.json_to_sheet(excelRows);

    // 열 너비 지정
    worksheet["!cols"] = [
      { wch: 14 }, // 기사명
      { wch: 20 }, // 고용 형태
      { wch: 16 }, // 부양가족 수
      { wch: 16 }, // 총 운행 횟수
      { wch: 20 }, // 총 지급액
      { wch: 16 }, // 소득세
      { wch: 18 }, // 지방소득세
      { wch: 18 }, // 공제 총액
      { wch: 24 }, // 실지급액
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, `${yearMonth} 급여대장`);

    const fileName = `기사별_월간_급여대장_${yearMonth}.xlsx`;
    XLSX.writeFile(workbook, fileName);
  }, [rowData, summary, yearMonth]);

  // AG Grid 컬럼 정의: [총 지급액], [공제액], [실지급액] 시각적 분리
  const columnDefs = useMemo<ColDef[]>(
    () => [
      {
        field: "driverName",
        headerName: "기사명",
        pinned: "left",
        width: 145,
        filter: true,
        cellRenderer: (params: any) => {
          if (!params.value || !params.data?.driverId) return params.value;
          return (
            <div className="flex items-center justify-between w-full">
              <span className="font-semibold text-gray-900">{params.value}</span>
              <a
                href={`/driver/${params.data.driverId}?month=${yearMonth}`}
                target="_blank"
                rel="noreferrer"
                title="기사 모바일 웹 열기"
                className="text-xs text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-1.5 py-0.5 rounded border border-blue-200 transition font-normal"
              >
                📱 모바일
              </a>
            </div>
          );
        },
      },
      {
        field: "employmentType",
        headerName: "고용 형태",
        width: 160,
        filter: true,
        cellRenderer: (params: any) => {
          if (!params.value) return "-";
          const badge = getEmploymentTypeBadge(params.value);
          return (
            <span
              className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold border ${badge.className}`}
            >
              {badge.label}
            </span>
          );
        },
      },
      {
        field: "dependentsCount",
        headerName: "부양가족",
        width: 100,
        type: "rightAligned",
        valueFormatter: (params) => {
          if (params.value === undefined || params.value === null) return "-";
          return `${params.value}명`;
        },
        cellClass: "text-gray-500",
      },
      {
        field: "operationCount",
        headerName: "운행 횟수",
        width: 110,
        type: "rightAligned",
        valueFormatter: (params) => {
          if (params.value === undefined || params.value === null) return "";
          return `${params.value.toLocaleString("ko-KR")}회`;
        },
        cellClass: "font-medium text-gray-800",
      },
      {
        field: "totalPayoutAmount",
        headerName: "총 지급액 (세전)",
        width: 170,
        type: "rightAligned",
        valueFormatter: (params) => formatCurrency(params.value),
        cellRenderer: (params: any) => {
          const val = params.value ?? 0;
          return (
            <span className="font-bold text-blue-700 text-sm tracking-tight">
              {formatCurrency(val)}
            </span>
          );
        },
      },
      {
        field: "totalDeductionAmount",
        headerName: "공제액 (소득세 3.3%)",
        width: 180,
        type: "rightAligned",
        valueFormatter: (params) => {
          if (!params.value) return "₩0";
          return `-${formatCurrency(params.value)}`;
        },
        cellRenderer: (params: any) => {
          const val = params.value ?? 0;
          const income = params.data?.incomeTax;
          const local = params.data?.localIncomeTax;
          const tooltip = income && local ? `소득세 3%: ₩${income.toLocaleString()} | 지방소득세 0.3%: ₩${local.toLocaleString()}` : "사업소득세 3.3% 원천징수";
          return (
            <span
              title={tooltip}
              className="inline-flex items-center gap-1 font-semibold text-rose-600 text-sm tracking-tight cursor-help"
            >
              <span>-{formatCurrency(val)}</span>
              <span className="text-[10px] bg-rose-100 text-rose-700 px-1 py-0.2 rounded font-normal">
                3.3%
              </span>
            </span>
          );
        },
      },
      {
        field: "netPayoutAmount",
        headerName: "실지급액 (차인지급액)",
        minWidth: 200,
        flex: 1,
        type: "rightAligned",
        valueFormatter: (params) => formatCurrency(params.value),
        cellRenderer: (params: any) => {
          const val = params.value ?? 0;
          return (
            <span className="inline-block px-2.5 py-0.5 rounded-lg bg-emerald-50 text-emerald-800 font-extrabold text-base tracking-tight border border-emerald-200">
              {formatCurrency(val)}
            </span>
          );
        },
      },
    ],
    []
  );

  // 하단 고정 합계행 (Pinned Bottom Row)
  const pinnedBottomRowData = useMemo(() => {
    if (rowData.length === 0) return [];
    return [
      {
        driverName: "합계",
        employmentType: `총 ${summary.totalDrivers}명`,
        dependentsCount: null,
        operationCount: summary.totalOperations,
        totalPayoutAmount: summary.totalPayrollAmount,
        totalDeductionAmount: summary.totalDeductionAmount,
        netPayoutAmount: summary.totalNetAmount,
      },
    ];
  }, [rowData, summary]);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-gray-800">
      {/* 1. 상단 글로벌 네비게이션 바 */}
      <Navbar />

      <main className="p-4 md:p-6 max-w-7xl w-full mx-auto flex-1 flex flex-col">
        {/* 헤더 안내 및 엑셀 다운로드 */}
        <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-gray-200 gap-4 mb-6">
          <div>
            <div className="flex items-center gap-3">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                급여 관리 ERP (Payroll)
              </span>
              <h1 className="text-xl md:text-2xl font-bold text-gray-900">전세버스 기사별 월간 급여 정산</h1>
            </div>
            <p className="text-xs md:text-sm text-gray-500 mt-1">
              월별 배차 배정 실적을 기반으로 기사별 총 수당에서 소득세(3.3%)를 자동 공제하여 실지급액을 정산합니다.
            </p>
          </div>

          <div className="flex flex-col md:flex-row gap-2 w-full md:w-auto">
            <Link
              href="/schedule"
              className="px-3.5 py-2 border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 text-sm font-semibold rounded-xl shadow-2xs transition flex items-center justify-center gap-1.5 w-full md:w-auto"
            >
              <span>📅</span>
              <span>배차 스케줄러</span>
            </Link>
            <Link
              href="/settlement"
              className="px-3.5 py-2 border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 text-sm font-semibold rounded-xl shadow-2xs transition flex items-center justify-center gap-1.5 w-full md:w-auto"
            >
              <span>📊</span>
              <span>월간 정산</span>
            </Link>

            {/* 급여 대장 엑셀 다운로드 버튼 */}
            <button
              type="button"
              onClick={handleExportExcel}
              disabled={rowData.length === 0}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl shadow-sm transition flex items-center justify-center gap-2 cursor-pointer w-full md:w-auto"
              title="세전 총액, 세금 공제액, 실지급액이 포함된 급여대장 Excel 파일을 다운로드합니다."
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span>급여 대장 엑셀 다운로드</span>
            </button>
          </div>
        </div>

        {/* 2. 상단 제어부: 연-월 선택 및 데이터 호출 */}
        <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm mb-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <label htmlFor="payroll-month" className="text-sm font-bold text-gray-700">
              급여 정산 대상 연-월:
            </label>
            <input
              id="payroll-month"
              type="month"
              value={yearMonth}
              onChange={(e) => setYearMonth(e.target.value)}
              className="px-3.5 py-2 border border-gray-300 rounded-xl text-sm font-medium text-gray-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-white shadow-inner"
            />

            {/* 빠른 월간 선택 버튼들 */}
            <div className="flex items-center gap-1.5 ml-1">
              {["2026-07", "2026-06", "2026-09", "2026-10"].map((quickMonth) => (
                <button
                  key={quickMonth}
                  type="button"
                  onClick={() => setYearMonth(quickMonth)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition cursor-pointer ${
                    yearMonth === quickMonth
                      ? "bg-emerald-600 text-white font-bold shadow-xs"
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
              onClick={() => loadPayrollData(yearMonth)}
              title="배차 또는 기사 배정 변경 시 현재 월의 급여 실적을 다시 계산하여 최신 데이터로 새로고침합니다."
              className="ml-2 px-4 py-2 bg-white hover:bg-emerald-50 text-emerald-700 border border-emerald-300 disabled:opacity-50 text-sm font-bold rounded-xl shadow-xs transition flex items-center gap-2 cursor-pointer active:scale-95"
            >
              <svg
                className={`w-4 h-4 text-emerald-600 ${loading ? "animate-spin" : ""}`}
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
              <span>{loading ? "급여 재계산 중..." : "최신 데이터 새로고침"}</span>
            </button>
          </div>

          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>월 선택 시 자동 반영 · 소득세(3.3%) 원천징수 적용</span>
          </div>
        </div>

        {/* 3. 상단 핵심 요약 지표 카드 (총 지급액 / 공제액 / 실지급액 시각적 분리) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {/* 카드 1: 세전 총 지급액 */}
          <div className="bg-white p-5 rounded-2xl border border-blue-200 shadow-sm flex flex-col justify-between bg-gradient-to-br from-blue-50/70 to-white">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-blue-700">총 지급액 (세전 총액)</span>
              <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-blue-100 text-blue-700">
                GROSS
              </span>
            </div>
            <div className="mt-3">
              <span className="text-2xl font-black text-blue-900 tracking-tight">
                {formatCurrency(summary.totalPayrollAmount)}
              </span>
              <p className="text-xs text-blue-600/80 mt-1">
                {summary.totalDrivers}명 기사 · 총 {summary.totalOperations.toLocaleString()}회 운행 수당
              </p>
            </div>
          </div>

          {/* 카드 2: 세금 공제액 (소득세 3.3%) */}
          <div className="bg-white p-5 rounded-2xl border border-rose-200 shadow-sm flex flex-col justify-between bg-gradient-to-br from-rose-50/70 to-white">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-rose-700">총 공제액 (원천징수 세액)</span>
              <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-rose-100 text-rose-700">
                TAX 3.3%
              </span>
            </div>
            <div className="mt-3">
              <span className="text-2xl font-black text-rose-600 tracking-tight">
                -{formatCurrency(summary.totalDeductionAmount)}
              </span>
              <p className="text-xs text-rose-600/80 mt-1">
                소득세 3.0% + 지방소득세 0.3% 합산
              </p>
            </div>
          </div>

          {/* 카드 3: 실지급액 (차인지급액) - 메인 강조 카드 */}
          <div className="bg-gradient-to-br from-emerald-600 to-teal-700 text-white p-5 rounded-2xl shadow-md shadow-emerald-600/20 flex flex-col justify-between transform transition hover:scale-[1.01]">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-100">총 실지급액 (세후 차인지급액)</span>
              <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-white/20 text-white">
                NET PAY
              </span>
            </div>
            <div className="mt-3">
              <span className="text-3xl font-black text-white tracking-tight">
                {formatCurrency(summary.totalNetAmount)}
              </span>
              <p className="text-xs text-emerald-100 mt-1">
                기사 실제 통장 입금 총액 (지급액 - 공제액)
              </p>
            </div>
          </div>

          {/* 카드 4: 기사당 평균 지급 현황 */}
          <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-gray-500">기사당 평균 실지급액</span>
              <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-gray-100 text-gray-600">
                1인 평균
              </span>
            </div>
            <div className="mt-3">
              <span className="text-2xl font-black text-gray-800 tracking-tight">
                {formatCurrency(summary.averageNetPayout)}
              </span>
              <p className="text-xs text-gray-500 mt-1">
                세전 평균: {formatCurrency(summary.averagePayout)}
              </p>
            </div>
          </div>
        </div>

        {/* 에러 메시지 알림 바 */}
        {errorMessage && (
          <div className="mb-4 p-3.5 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl flex items-center justify-between">
            <span>⚠️ {errorMessage}</span>
            <button
              onClick={() => setErrorMessage(null)}
              className="text-red-500 hover:text-red-700 font-bold ml-4 cursor-pointer"
            >
              ×
            </button>
          </div>
        )}

        {/* 4. 하단 출력부: AG Grid 기사별 급여 집계 테이블 */}
        <div className="flex-1 flex flex-col bg-white border border-gray-300 rounded-2xl shadow-sm overflow-hidden min-h-[460px]">
          <div className="px-5 py-3.5 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between bg-gray-50/80 gap-2">
            <h2 className="text-sm font-bold text-gray-800 flex items-center gap-2">
              <span>👨‍✈️ 기사별 월간 급여/세무 정산 명세</span>
              <span className="text-xs font-semibold text-gray-500 bg-gray-200/60 px-2.5 py-0.5 rounded-full">
                {rowData.length}명
              </span>
            </h2>
            <div className="flex items-center gap-3 text-xs text-gray-400">
              <span>💡 공제액 셀에 마우스를 올리면 소득세 및 지방소득세 세부 내역 확인 가능</span>
              <button
                type="button"
                onClick={handleExportExcel}
                disabled={rowData.length === 0}
                className="px-3 py-1 bg-white hover:bg-emerald-50 text-emerald-700 border border-emerald-300 text-xs font-semibold rounded-lg shadow-2xs transition flex items-center gap-1 disabled:opacity-50 cursor-pointer"
              >
                <span>📥 엑셀 저장</span>
              </button>
            </div>
          </div>

          <div className="overflow-x-auto whitespace-nowrap">
            <div className="ag-theme-quartz w-full min-w-[720px] h-[520px]">
              <AgGridReact
                modules={[AllCommunityModule]}
                rowData={rowData}
                columnDefs={columnDefs}
                pinnedBottomRowData={pinnedBottomRowData}
                defaultColDef={{
                  sortable: true,
                  filter: true,
                  resizable: true,
                  minWidth: 110,
                }}
                overlayNoRowsTemplate={`<span class="p-4 text-gray-400 text-sm font-medium">${yearMonth}월에 배정된 기사 운행 내역이 없습니다.</span>`}
              />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

