"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { createRouteMaster } from "@/app/actions/masterData";

// Zod 폼 검증 스키마
const formSchema = z.object({
  name: z.string().min(2, "노선명을 2자 이상 입력해 주세요."),
  departure: z.string().min(2, "출발지를 입력해 주세요."),
  destination: z.string().min(2, "도착지를 입력해 주세요."),
  estimatedDistance: z.number().min(0.1, "0.1km 이상이어야 합니다."),
  defaultTollFee: z.number().min(0, "0원 이상이어야 합니다."),
  isActive: z.boolean(),
});

type RouteMasterFormValues = z.infer<typeof formSchema>;

export default function RouteMasterForm() {
  const router = useRouter();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<RouteMasterFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      departure: "",
      destination: "",
      estimatedDistance: 35,
      defaultTollFee: 0,
      isActive: true,
    },
  });

  const onSubmit = async (values: RouteMasterFormValues) => {
    setErrorMessage(null);
    try {
      const res = await createRouteMaster({
        name: values.name.trim(),
        departure: values.departure.trim(),
        destination: values.destination.trim(),
        estimatedDistance: Number(values.estimatedDistance),
        defaultTollFee: Number(values.defaultTollFee),
        isActive: Boolean(values.isActive),
      });

      if (!res.success) {
        setErrorMessage(res.error || "노선 등록에 실패했습니다.");
        alert(res.error || "등록 실패");
        return;
      }

      alert(`노선 [${values.name}]이(가) 성공적으로 등록되었습니다.`);
      reset({
        name: "",
        departure: "",
        destination: "",
        estimatedDistance: 35,
        defaultTollFee: 0,
        isActive: true,
      });
      router.refresh();
    } catch (err: any) {
      console.error(err);
      const msg = err.message || "서버 통신 중 오류가 발생했습니다.";
      setErrorMessage(msg);
      alert(msg);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5">
      <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100">
        <span className="w-7 h-7 rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-sm">
          ➕
        </span>
        <div>
          <h3 className="text-sm font-bold text-slate-800">신규 노선 마스터 등록</h3>
          <p className="text-[11px] text-slate-400">자주 배차되는 표준 통근/투어 노선 정보를 사전 정의합니다.</p>
        </div>
      </div>

      {errorMessage && (
        <div className="mb-4 p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
          <span>⚠️ {errorMessage}</span>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3.5">
        {/* 노선명 */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            노선명 <span className="text-rose-500">*</span>
          </label>
          <input
            type="text"
            placeholder="예: 판교 테크노밸리 통근 A노선"
            {...register("name")}
            className={`w-full px-3 py-2 text-xs rounded-xl border bg-white focus:outline-none focus:ring-2 transition-all ${
              errors.name
                ? "border-rose-300 focus:ring-rose-100 focus:border-rose-500"
                : "border-slate-200 focus:ring-indigo-100 focus:border-indigo-500"
            }`}
          />
          {errors.name && <p className="mt-1 text-[11px] text-rose-600">{errors.name.message}</p>}
        </div>

        {/* 출발지 & 도착지 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              출발지 <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              placeholder="예: 수원 영통역 1번출구"
              {...register("departure")}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 transition-all"
            />
            {errors.departure && <p className="mt-1 text-[11px] text-rose-600">{errors.departure.message}</p>}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              도착지 <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              placeholder="예: 판교 H스퀘어 앞"
              {...register("destination")}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 transition-all"
            />
            {errors.destination && <p className="mt-1 text-[11px] text-rose-600">{errors.destination.message}</p>}
          </div>
        </div>

        {/* 주행거리 & 통행료 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              예상 편도 주행거리 (km) <span className="text-rose-500">*</span>
            </label>
            <input
              type="number"
              step="0.1"
              placeholder="35.5"
              {...register("estimatedDistance", { valueAsNumber: true })}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 transition-all"
            />
            {errors.estimatedDistance && (
              <p className="mt-1 text-[11px] text-rose-600">{errors.estimatedDistance.message}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              기본 도로 통행료 (원)
            </label>
            <input
              type="number"
              placeholder="1800"
              {...register("defaultTollFee", { valueAsNumber: true })}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 transition-all"
            />
          </div>
        </div>

        {/* 사용 여부 */}
        <div className="flex items-center gap-2 pt-1">
          <input
            id="isActive"
            type="checkbox"
            {...register("isActive")}
            className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
          />
          <label htmlFor="isActive" className="text-xs font-medium text-slate-700 cursor-pointer">
            현재 운행 노선으로 활성화 (즉시 배차 가능)
          </label>
        </div>

        {/* 제출 버튼 */}
        <div className="pt-2">
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-2.5 px-4 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 rounded-xl shadow-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <>
                <svg className="animate-spin h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                <span>등록 처리 중...</span>
              </>
            ) : (
              "노선 마스터 등록하기"
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
