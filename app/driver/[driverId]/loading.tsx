import React from "react";

export default function DriverLoading() {
  return (
    <div className="min-h-screen bg-slate-950 flex justify-center text-slate-100 font-sans">
      <div className="w-full max-w-md mx-auto min-h-screen bg-slate-900 border-x border-slate-800 shadow-2xl flex flex-col p-4 space-y-4 animate-pulse">
        {/* 상단 헤더 스켈레톤 */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-slate-800"></div>
            <div className="space-y-1.5">
              <div className="w-24 h-4 bg-slate-800 rounded"></div>
              <div className="w-16 h-3 bg-slate-800 rounded"></div>
            </div>
          </div>
          <div className="w-8 h-8 bg-slate-800 rounded-lg"></div>
        </div>

        {/* 상단 카드 스켈레톤 */}
        <div className="h-44 rounded-2xl bg-slate-800/60 border border-slate-800 p-5 space-y-3">
          <div className="flex justify-between">
            <div className="w-28 h-4 bg-slate-700 rounded"></div>
            <div className="w-20 h-5 bg-slate-700 rounded-full"></div>
          </div>
          <div className="w-40 h-8 bg-slate-700 rounded mt-4"></div>
          <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-700/40">
            <div className="h-10 bg-slate-700/50 rounded-xl"></div>
            <div className="h-10 bg-slate-700/50 rounded-xl"></div>
          </div>
        </div>

        {/* 탭 스켈레톤 */}
        <div className="h-10 bg-slate-800/80 rounded-xl border border-slate-800"></div>

        {/* 리스트 카드 스켈레톤 */}
        <div className="space-y-3 pt-2">
          <div className="h-28 rounded-xl bg-slate-800/50 border border-slate-800"></div>
          <div className="h-28 rounded-xl bg-slate-800/50 border border-slate-800"></div>
          <div className="h-28 rounded-xl bg-slate-800/50 border border-slate-800"></div>
        </div>
      </div>
    </div>
  );
}
