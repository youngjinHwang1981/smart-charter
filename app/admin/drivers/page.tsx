import React from "react";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/lib/auth";
import { prisma } from "@/lib/prisma";
import Navbar from "@/app/components/Navbar";
import ExcelExportButton from "./ExcelExportButton";
import CopyUrlButton from "./CopyUrlButton";

// Next.js 16 cacheComponents: 동적 비캐시 데이터(Prisma DB 조회) 허용
export const instant = false;

export const metadata = {
  title: "기사 관리 및 모바일 접속 링크 | 스마트투어 ERP",
  description: "전세버스 기사 관리 및 모바일 웹 고유 접속 링크 발급",
};

export default async function AdminDriversPage() {
  // 1. 세션 확인
  const session = await getServerSession(authOptions);

  // 2. 기사 목록 조회
  const drivers = await prisma.driver.findMany({
    select: {
      id: true,
      name: true,
      employmentType: true,
      dependentsCount: true,
      company: {
        select: {
          name: true,
        },
      },
      _count: {
        select: {
          assignments: true,
        },
      },
    },
    orderBy: {
      name: "asc",
    },
  });

  // 3. 통계 집계
  const totalCount = drivers.length;
  const ownCount = drivers.filter((d) => d.employmentType === "OWN").length;
  const affiliatedCount = drivers.filter((d) => d.employmentType === "AFFILIATED").length;
  const outsourcedCount = drivers.filter((d) => d.employmentType === "OUTSOURCED").length;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 상단 브레드크럼 & 타이틀 */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-gray-400 mb-1">
              <span>백오피스 관리자</span>
              <span>/</span>
              <span className="text-blue-600">기사 관리</span>
            </div>
            <h1 className="text-2xl font-black text-gray-900 tracking-tight flex items-center gap-2.5">
              <span>👨‍✈️</span>
              <span>기사 관리 및 모바일 접속 링크</span>
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              등록된 전세버스 기사 목록을 확인하고 앱 설치가 필요 없는 기사별 고유 모바일 접속 URL을 엑셀로 일괄 다운로드합니다.
            </p>
          </div>

          {/* 액션 버튼 영역 */}
          <div className="flex items-center gap-2.5 self-start md:self-auto">
            <Link
              href="/payroll"
              className="px-3.5 py-2 border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 text-sm font-semibold rounded-xl shadow-2xs transition flex items-center gap-1.5"
            >
              <span>📊</span>
              <span>기사별 급여 관리</span>
            </Link>
            <ExcelExportButton />
          </div>
        </div>

        {/* 통계 요약 카드 */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-2xs">
            <span className="text-xs font-medium text-gray-500">전체 등록 기사</span>
            <div className="text-2xl font-extrabold text-gray-900 mt-1">
              {totalCount} <span className="text-sm font-normal text-gray-500">명</span>
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-2xs">
            <span className="text-xs font-medium text-blue-600">직영 (OWN)</span>
            <div className="text-2xl font-extrabold text-blue-700 mt-1">
              {ownCount} <span className="text-sm font-normal text-gray-500">명</span>
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-2xs">
            <span className="text-xs font-medium text-amber-600">지입 (AFFILIATED)</span>
            <div className="text-2xl font-extrabold text-amber-700 mt-1">
              {affiliatedCount} <span className="text-sm font-normal text-gray-500">명</span>
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-2xs">
            <span className="text-xs font-medium text-purple-600">용차 (OUTSOURCED)</span>
            <div className="text-2xl font-extrabold text-purple-700 mt-1">
              {outsourcedCount} <span className="text-sm font-normal text-gray-500">명</span>
            </div>
          </div>
        </div>

        {/* 안내 카드 */}
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 mb-6 flex items-start gap-3">
          <div className="text-blue-600 text-lg mt-0.5">💡</div>
          <div className="text-xs sm:text-sm text-blue-900 leading-relaxed">
            <strong className="font-semibold">모바일 접속 안내:</strong> 기사는 별도의 앱 설치나 로그인 절차 없이, 고유 URL을 통해 자신의 배차 일정과 급여 내역을 실시간으로 확인할 수 있습니다. 우측 상단의 <strong>[기사 URL 엑셀 다운로드]</strong>를 클릭하여 기사님들께 카카오톡 또는 문자로 개별 전송하세요.
          </div>
        </div>

        {/* 기사 목록 테이블 */}
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-base font-bold text-gray-900">
              기사 목록 ({totalCount}명)
            </h2>
            <span className="text-xs text-gray-400">
              이름 오름차순 정렬
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
              <thead className="bg-gray-50 text-gray-600 font-semibold text-xs">
                <tr>
                  <th scope="col" className="px-6 py-3">기사명</th>
                  <th scope="col" className="px-6 py-3">고용 형태</th>
                  <th scope="col" className="px-6 py-3">소속 회사</th>
                  <th scope="col" className="px-6 py-3">누적 배차 건수</th>
                  <th scope="col" className="px-6 py-3">고유 UUID</th>
                  <th scope="col" className="px-6 py-3 text-right">모바일 웹 링크</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-gray-700">
                {drivers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-gray-400 text-sm">
                      등록된 기사 정보가 없습니다.
                    </td>
                  </tr>
                ) : (
                  drivers.map((driver) => {
                    let badgeClass = "bg-gray-100 text-gray-700 border-gray-200";
                    let badgeLabel = driver.employmentType;
                    if (driver.employmentType === "OWN") {
                      badgeClass = "bg-blue-50 text-blue-700 border-blue-200";
                      badgeLabel = "직영 (OWN)";
                    } else if (driver.employmentType === "AFFILIATED") {
                      badgeClass = "bg-amber-50 text-amber-700 border-amber-200";
                      badgeLabel = "지입 (AFFILIATED)";
                    } else if (driver.employmentType === "OUTSOURCED") {
                      badgeClass = "bg-purple-50 text-purple-700 border-purple-200";
                      badgeLabel = "용차 (OUTSOURCED)";
                    }

                    return (
                      <tr key={driver.id} className="hover:bg-gray-50/70 transition-colors">
                        <td className="px-6 py-4 font-bold text-gray-900">
                          {driver.name}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium border ${badgeClass}`}>
                            {badgeLabel}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-gray-500">
                          {driver.company?.name || "-"}
                        </td>
                        <td className="px-6 py-4 font-medium text-gray-800">
                          {driver._count.assignments.toLocaleString()}회
                        </td>
                        <td className="px-6 py-4 font-mono text-xs text-gray-400">
                          {driver.id}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <CopyUrlButton driverId={driver.id} />
                            <a
                              href={`/driver/${driver.id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 hover:text-blue-800 transition inline-flex items-center gap-1"
                              title="새 창에서 모바일 뷰 열기"
                            >
                              <span>📱</span>
                              <span>모바일 뷰</span>
                            </a>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
