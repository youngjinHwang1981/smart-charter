"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";

export default function Navbar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const navItems = [
    { name: "통합 대시보드", href: "/" },
    { name: "배차 스케줄러", href: "/schedule" },
    { name: "월간 통합 정산", href: "/settlement" },
    { name: "기사별 급여 관리", href: "/payroll" },
    { name: "기사 관리", href: "/admin/drivers" },
    { name: "차량 관리", href: "/admin/vehicles" },
    { name: "노선 마스터", href: "/admin/master-data/route" },
  ];

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-2xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center gap-4">
          {/* 좌측: SF Mobility 공식 로고 & 브랜드 타이틀 */}
          <div className="flex items-center shrink-0">
            <Link
              href="/"
              onClick={() => setIsMobileMenuOpen(false)}
              className="flex items-center gap-3 group focus:outline-none"
            >
              <div className="relative flex items-center justify-center shrink-0">
                <Image
                  src="/images/sf_mobility_logo.png"
                  alt="SF Mobility 공식 로고"
                  width={120}
                  height={40}
                  preload
                  className="h-10 w-auto object-contain rounded-md group-hover:scale-105 transition-transform duration-200"
                />
              </div>
              <div className="flex flex-col justify-center">
                <span className="font-black text-[#0A1931] text-lg tracking-tight leading-none group-hover:text-blue-700 transition-colors whitespace-nowrap">
                  SF Mobility
                </span>
                <span className="text-xs text-slate-400 font-medium tracking-tight mt-1 leading-none whitespace-nowrap">
                  에스에프모빌리티
                </span>
              </div>
            </Link>
          </div>

          {/* 중앙~우측: 데스크탑 메인 네비게이션 메뉴 */}
          <div className="hidden lg:flex items-center gap-3 xl:gap-5 shrink-0">
            <nav
              aria-label="주요 메뉴"
              className="flex items-center gap-1 xl:gap-1.5 whitespace-nowrap"
            >
              {navItems.map((item) => {
                const isActive =
                  item.href === "/"
                    ? pathname === "/"
                    : pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`px-2.5 xl:px-3.5 py-2 rounded-lg text-sm tracking-tight whitespace-nowrap shrink-0 transition-all ${
                      isActive
                        ? "bg-[#0A1931] text-white font-semibold shadow-xs"
                        : "text-slate-600 font-medium hover:text-slate-900 hover:bg-slate-100"
                    }`}
                  >
                    {item.name}
                  </Link>
                );
              })}
            </nav>

            {/* 우측: 사용자 프로필 및 로그아웃 버튼 */}
            {session?.user && (
              <div className="flex items-center pl-3 xl:pl-4 border-l border-slate-200 gap-3 shrink-0">
                <div className="flex flex-col text-right whitespace-nowrap">
                  <span className="text-xs font-bold text-slate-800 leading-tight">
                    {session.user.name || "관리자"}
                  </span>
                  <span className="text-[11px] text-slate-400 font-mono leading-tight">
                    {session.user.email}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => signOut({ callbackUrl: "/login" })}
                  className="px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:text-rose-600 hover:bg-rose-50 border border-slate-200 hover:border-rose-200 rounded-lg transition whitespace-nowrap cursor-pointer shrink-0"
                  title="로그아웃"
                >
                  로그아웃
                </button>
              </div>
            )}
          </div>

          {/* 모바일 햄버거 메뉴 토글 버튼 (lg 미만에서 노출) */}
          <div className="flex items-center lg:hidden shrink-0">
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600 transition cursor-pointer"
              aria-label={isMobileMenuOpen ? "메뉴 닫기" : "메뉴 열기"}
              aria-expanded={isMobileMenuOpen}
            >
              {isMobileMenuOpen ? (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
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
        <div className="lg:hidden border-t border-slate-200 bg-white/98 backdrop-blur-md px-4 pt-3 pb-5 shadow-lg animate-fade-in transition-all">
          <nav className="flex flex-col gap-1">
            {navItems.map((item) => {
              const isActive =
                item.href === "/"
                  ? pathname === "/"
                  : pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`px-3.5 py-2.5 rounded-xl text-sm tracking-tight whitespace-nowrap font-semibold transition-all flex items-center justify-between ${
                    isActive
                      ? "bg-[#0A1931] text-white shadow-xs"
                      : "text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  <span>{item.name}</span>
                  {isActive && <span className="text-xs font-bold text-cyan-400">현재</span>}
                </Link>
              );
            })}
          </nav>

          {/* 모바일 사용자 계정 정보 및 로그아웃 */}
          {session?.user && (
            <div className="mt-4 pt-3.5 border-t border-slate-100 flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-xs font-bold text-slate-800">
                  {session.user.name || "관리자"}
                </span>
                <span className="text-[11px] text-slate-400 font-mono">
                  {session.user.email}
                </span>
              </div>
              <button
                type="button"
                onClick={() => signOut({ callbackUrl: "/login" })}
                className="px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-lg transition whitespace-nowrap cursor-pointer"
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
