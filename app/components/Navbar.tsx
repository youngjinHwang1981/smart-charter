"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";

export default function Navbar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const navItems = [
    { name: "통합 대시보드", href: "/", icon: "📈" },
    { name: "배차 스케줄러", href: "/schedule", icon: "📅" },
    { name: "월간 통합 정산", href: "/settlement", icon: "📊" },
    { name: "기사별 급여 관리", href: "/payroll", icon: "💰" },
    { name: "기사 관리", href: "/admin/drivers", icon: "👨‍✈️" },
    { name: "차량 관리", href: "/admin/vehicles", icon: "🚌" },
    { name: "노선 마스터", href: "/admin/master-data/route", icon: "🗺️" },
  ];

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-2xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          {/* 로고 & 시스템 명칭 */}
          <div className="flex items-center gap-3">
            <Link
              href="/"
              onClick={() => setIsMobileMenuOpen(false)}
              className="flex items-center gap-2.5 group"
            >
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white text-xl shadow-sm shadow-blue-500/20 group-hover:scale-105 transition-transform">
                🚌
              </div>
              <div className="flex flex-col">
                <span className="font-extrabold text-gray-900 text-lg tracking-tight leading-none group-hover:text-blue-600 transition-colors">
                  스마트투어 ERP
                </span>
                <span className="text-[11px] text-gray-400 font-medium tracking-wide mt-1">
                  전세버스 통합 운영 관리 시스템
                </span>
              </div>
            </Link>
          </div>

          {/* 데스크탑 메인 네비게이션 메뉴 */}
          <div className="hidden lg:flex items-center gap-2 xl:gap-3 shrink-0">
            <nav className="flex items-center gap-1 xl:gap-1.5 whitespace-nowrap">
              {navItems.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap tracking-tight transition-all flex items-center gap-1.5 shrink-0 ${
                      isActive
                        ? "bg-blue-600 text-white shadow-xs shadow-blue-500/20 font-semibold"
                        : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                    }`}
                  >
                    <span className="text-xs shrink-0">{item.icon}</span>
                    <span className="whitespace-nowrap tracking-tight font-medium">{item.name}</span>
                  </Link>
                );
              })}
            </nav>

            {/* 사용자 프로필 및 로그아웃 버튼 */}
            {session?.user && (
              <div className="flex items-center pl-3 border-l border-gray-200 gap-2.5">
                <div className="flex flex-col text-right">
                  <span className="text-xs font-bold text-gray-800">
                    {session.user.name || "관리자"}
                  </span>
                  <span className="text-[10px] text-gray-400 font-mono">
                    {session.user.email}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => signOut({ callbackUrl: "/login" })}
                  className="px-2.5 py-1 text-xs font-semibold text-gray-600 hover:text-rose-600 hover:bg-rose-50 border border-gray-200 hover:border-rose-200 rounded-lg transition cursor-pointer"
                  title="로그아웃"
                >
                  로그아웃
                </button>
              </div>
            )}
          </div>

          {/* 모바일 햄버거 메뉴 토글 버튼 (lg 미만에서 노출) */}
          <div className="flex items-center lg:hidden">
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="p-2 rounded-xl text-gray-600 hover:text-gray-900 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 transition cursor-pointer"
              aria-label={isMobileMenuOpen ? "메뉴 닫기" : "메뉴 열기"}
              aria-expanded={isMobileMenuOpen}
            >
              {isMobileMenuOpen ? (
                // 닫기 (X) 아이콘
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                // 햄버거 (3선) 아이콘
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* 모바일 상하 슬라이드 네비게이션 드롭다운 뷰 (lg 미만) */}
      {isMobileMenuOpen && (
        <div className="lg:hidden border-t border-gray-200 bg-white/98 backdrop-blur-md px-4 pt-3 pb-5 shadow-lg animate-fade-in transition-all">
          <nav className="flex flex-col gap-1.5">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center justify-between ${
                    isActive
                      ? "bg-blue-600 text-white shadow-sm shadow-blue-500/20"
                      : "text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-base">{item.icon}</span>
                    <span>{item.name}</span>
                  </div>
                  {isActive && <span className="text-xs font-bold text-white/80">현재</span>}
                </Link>
              );
            })}
          </nav>

          {/* 모바일 사용자 계정 정보 및 로그아웃 */}
          {session?.user && (
            <div className="mt-4 pt-3.5 border-t border-gray-100 flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-xs font-bold text-gray-800">
                  {session.user.name || "관리자"}
                </span>
                <span className="text-[11px] text-gray-400 font-mono">
                  {session.user.email}
                </span>
              </div>
              <button
                type="button"
                onClick={() => signOut({ callbackUrl: "/login" })}
                className="px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-lg transition cursor-pointer"
              >
                로그아웃
              </button>
            </div>
          )}
        </div>
      )}
    </header>
  );
}
