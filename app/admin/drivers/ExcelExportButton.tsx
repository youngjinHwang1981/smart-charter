"use client";

import React, { useState } from "react";
import * as XLSX from "xlsx";

interface DriverExportItem {
  id: string;
  name: string;
  phone: string;
  companyName?: string;
  employmentType?: string;
}

const EMPLOYMENT_LABEL_MAP: Record<string, string> = {
  OWN: "직영",
  AFFILIATED: "지입",
  OUTSOURCED: "용차",
};

// [성능/UX 영향]: 불필요한 SheetJS 연산 및 빈 파일 다운로드를 사전 차단하고, 중복 클릭 방지로 API 서버 부하 방지
export default function ExcelExportButton({ totalCount }: { totalCount?: number }) {
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const handleDownload = async () => {
    // 0. 사전 방어: 상위에서 기사 데이터가 0건임이 확실한 경우 API 호출 전 조기 차단
    if (totalCount !== undefined && totalCount <= 0) {
      alert("다운로드할 기사 데이터가 없습니다.");
      return;
    }

    setIsLoading(true);

    try {
      // 1. 기사 데이터 조회 API 호출
      const response = await fetch("/api/admin/drivers/export", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "데이터를 불러오는 데 실패했습니다.");
      }

      const drivers: DriverExportItem[] = result.data || [];

      // 2. 사후 방어: 반환된 기사 목록 데이터가 비어있는 배열([])일 경우 즉시 다운로드 중단
      if (!Array.isArray(drivers) || drivers.length === 0) {
        alert("다운로드할 기사 데이터가 없습니다.");
        return;
      }

      // 2. 도메인 URL 기준값 결정 (기본값: 실제 운영 배포 도메인)
      const baseUrl = (
        process.env.NEXT_PUBLIC_SITE_URL ||
        (typeof window !== "undefined" && window.location.hostname !== "localhost"
          ? window.location.origin
          : "https://smart-charter-ten.vercel.app")
      ).replace(/\/$/, "");

      // 3. 엑셀 로우 데이터 포맷팅
      const excelRows = drivers.map((driver) => {
        const empLabel =
          EMPLOYMENT_LABEL_MAP[driver.employmentType || ""] ||
          driver.employmentType ||
          "-";

        return {
          기사명: driver.name,
          고용형태: empLabel,
          연락처: driver.phone || "-",
          고유식별자: driver.id,
          "고유 접속 URL": `${baseUrl}/driver/${driver.id}`,
        };
      });

      // 4. SheetJS 워크시트 및 워크북 생성
      const worksheet = XLSX.utils.json_to_sheet(excelRows);

      // 열 너비(width) 가독성 최적화
      worksheet["!cols"] = [
        { wch: 14 }, // 기사명
        { wch: 12 }, // 고용형태
        { wch: 16 }, // 연락처
        { wch: 38 }, // 고유식별자
        { wch: 55 }, // 고유 접속 URL
      ];

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "기사별접속링크");

      // 5. 파일명 생성: 기사_접속링크_목록_YYYYMMDD.xlsx
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, "0");
      const day = String(now.getDate()).padStart(2, "0");
      const fileName = `기사_접속링크_목록_${year}${month}${day}.xlsx`;

      // 6. 브라우저 파일 다운로드 트리거
      XLSX.writeFile(workbook, fileName);
    } catch (error) {
      console.error("[EXCEL_EXPORT_ERROR]", error);
      alert(
        error instanceof Error
          ? error.message
          : "엑셀 다운로드 중 예기치 않은 오류가 발생했습니다."
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleDownload}
      disabled={isLoading}
      aria-label="기사 URL 엑셀 다운로드"
      className={`inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold text-white transition-all rounded-xl shadow-sm cursor-pointer ${
        isLoading
          ? "bg-emerald-400 cursor-not-allowed opacity-80"
          : "bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
      }`}
    >
      {isLoading ? (
        <>
          {/* 회전 로딩 스피너 SVG */}
          <svg
            className="w-4 h-4 animate-spin text-white"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          <span>엑셀 생성 중...</span>
        </>
      ) : (
        <>
          {/* 엑셀/다운로드 SVG 아이콘 */}
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <span>기사 URL 엑셀 다운로드</span>
        </>
      )}
    </button>
  );
}
