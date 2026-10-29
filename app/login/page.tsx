"use client";

import React, { useState, Suspense } from "react";
import Image from "next/image";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // 테스트 계정 빠른 자동완성
  const handleQuickFill = () => {
    setEmail("admin@smarttour.com");
    setPassword("1234");
    setErrorMessage(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!email || !password) {
      setErrorMessage("이메일과 비밀번호를 모두 입력해 주세요.");
      return;
    }

    try {
      setLoading(true);
      const res = await signIn("credentials", {
        redirect: false,
        email: email.trim(),
        password,
        callbackUrl,
      });

      if (!res?.ok) {
        setErrorMessage(res?.error || "이메일 또는 비밀번호가 일치하지 않습니다.");
      } else {
        // 외부 접속(ngrok 등) 환경에서 안전하게 상대 경로로 이동 및 세션 쿠키 즉시 동기화
        let targetUrl = callbackUrl || "/";
        try {
          if (targetUrl.startsWith("http://") || targetUrl.startsWith("https://")) {
            const parsed = new URL(targetUrl);
            targetUrl = parsed.pathname + parsed.search;
          }
        } catch {
          targetUrl = "/";
        }
        if (!targetUrl.startsWith("/")) targetUrl = "/";

        window.location.href = targetUrl;
      }
    } catch (err) {
      console.error("로그인 에러:", err);
      setErrorMessage("로그인 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-slate-100 via-blue-50/40 to-slate-200 p-4">
      <div className="w-full max-w-md bg-white/95 backdrop-blur-md rounded-3xl shadow-xl border border-gray-100 p-8 sm:p-10 transition-all">
        {/* 시스템 로고 및 환영 인사 */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <Image
              src="/images/sf_mobility_logo.png"
              alt="SF Mobility 공식 로고"
              width={180}
              height={72}
              preload
              className="h-16 w-auto object-contain rounded-xl"
            />
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            SF Mobility
          </h1>
          <p className="text-sm text-gray-500 mt-1.5 font-medium">
            B2B 통합 모빌리티 플랫폼 로그인
          </p>
        </div>

        {/* 에러 메시지 안내 */}
        {errorMessage && (
          <div className="mb-6 p-3.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold rounded-xl flex items-center gap-2">
            <span>⚠️</span>
            <span>{errorMessage}</span>
          </div>
        )}

        {/* 로그인 폼 */}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label
              htmlFor="email"
              className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5"
            >
              이메일 주소
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@smarttour.com"
              className="w-full px-4 py-3 rounded-xl border border-gray-300 text-sm font-medium text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all bg-white"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5"
            >
              비밀번호
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-4 py-3 rounded-xl border border-gray-300 text-sm font-medium text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all bg-white"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-sm font-bold rounded-xl shadow-md shadow-blue-500/25 transition-all transform active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer mt-2"
          >
            {loading ? (
              <>
                <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                <span>인증 확인 중...</span>
              </>
            ) : (
              <span>ERP 시스템 로그인</span>
            )}
          </button>
        </form>

        {/* 테스트 계정 빠른 입력 안내 박스 */}
        <div className="mt-8 pt-6 border-t border-gray-100">
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs flex items-center justify-between gap-3">
            <div>
              <div className="font-bold text-gray-700 mb-0.5">🔑 테스트 관리자 계정</div>
              <div className="text-gray-500 font-mono text-[11px]">
                admin@smarttour.com / 1234
              </div>
            </div>
            <button
              type="button"
              onClick={handleQuickFill}
              className="px-3 py-1.5 bg-white hover:bg-blue-50 text-blue-600 hover:text-blue-700 border border-blue-200 rounded-lg font-semibold transition text-xs shadow-2xs cursor-pointer whitespace-nowrap"
            >
              자동 완성
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-sm text-gray-500">페이지 로딩 중...</div>}>
      <LoginForm />
    </Suspense>
  );
}
