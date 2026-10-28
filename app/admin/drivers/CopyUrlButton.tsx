"use client";

import React, { useState } from "react";

interface CopyUrlButtonProps {
  driverId: string;
}

export default function CopyUrlButton({ driverId }: CopyUrlButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      const baseUrl = (
        process.env.NEXT_PUBLIC_SITE_URL ||
        (typeof window !== "undefined" && window.location.hostname !== "localhost"
          ? window.location.origin
          : "https://smart-charter-ten.vercel.app")
      ).replace(/\/$/, "");
      const targetUrl = `${baseUrl}/driver/${driverId}`;

      await navigator.clipboard.writeText(targetUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("클립보드 복사 실패:", err);
      alert("링크 복사에 실패했습니다.");
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={`px-2.5 py-1 text-xs font-medium rounded-lg border transition-all cursor-pointer inline-flex items-center gap-1 ${
        copied
          ? "bg-emerald-50 text-emerald-700 border-emerald-300"
          : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50 hover:text-blue-600 hover:border-blue-200"
      }`}
      title="모바일 접속 URL 복사"
    >
      {copied ? (
        <>
          <svg className="w-3.5 h-3.5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
          </svg>
          <span>복사됨!</span>
        </>
      ) : (
        <>
          <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
          </svg>
          <span>링크 복사</span>
        </>
      )}
    </button>
  );
}
