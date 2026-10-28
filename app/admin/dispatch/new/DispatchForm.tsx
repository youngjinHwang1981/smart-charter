"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { createDispatch } from "@/app/actions/dispatch";

// 폼 스키마
const dispatchFormSchema = z.object({
  routeId: z.string().min(1, "노선을 선택해 주세요."),
  date: z.string().min(1, "배차 운행 일자를 선택해 주세요."),
  type: z.string().min(1, "운행 구분을 선택해 주세요."),
  driverId: z.string().optional(),
  vehicleId: z.string().optional(),
  memo: z.string().optional(),
});

type DispatchFormValues = z.infer<typeof dispatchFormSchema>;

export interface RouteOption {
  id: string;
  name: string;
  departure: string;
  destination: string;
  estimatedDistance: number;
  defaultTollFee: number;
}

export interface DriverOption {
  id: string;
  name: string;
  employmentType: string;
}

export interface VehicleOption {
  id: string;
  plateNumber: string;
  capacity: number;
  capacityType: string;
  modelName: string | null;
}

interface DispatchFormProps {
  routes: RouteOption[];
  drivers?: DriverOption[];
  vehicles?: VehicleOption[];
}

export default function DispatchForm({
  routes,
  drivers = [],
  vehicles = [],
}: DispatchFormProps) {
  const router = useRouter();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // 오늘 날짜 기본값 (YYYY-MM-DD)
  const todayStr = new Date().toISOString().split("T")[0];

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<DispatchFormValues>({
    resolver: zodResolver(dispatchFormSchema),
    defaultValues: {
      routeId: routes[0]?.id || "CUSTOM",
      date: todayStr,
      type: "출근",
      driverId: "",
      vehicleId: "",
      memo: "",
    },
  });

  // 선택된 노선 감시
  const selectedRouteId = watch("routeId");
  const isCustomCharter = selectedRouteId === "CUSTOM";
  const selectedRoute = routes.find((r) => r.id === selectedRouteId);

  // 폼 제출
  const onSubmit = async (values: DispatchFormValues) => {
    setErrorMessage(null);
    try {
      const res = await createDispatch({
        routeId: values.routeId,
        date: values.date,
        type: values.type,
        driverId: values.driverId || null,
        vehicleId: values.vehicleId || null,
        memo: values.memo || null,
      });

      if (!res.success) {
        setErrorMessage(res.error || "배차 등록에 실패했습니다.");
        alert(res.error || "배차 등록 중 오류가 발생했습니다.");
        return;
      }

      alert("배차가 성공적으로 등록되었습니다. 배차 스케줄러로 이동합니다.");
      reset();
      router.push("/schedule");
    } catch (err: any) {
      console.error(err);
      const msg = err.message || "서버 통신 중 오류가 발생했습니다.";
      setErrorMessage(msg);
      alert(msg);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
      {/* 폼 상단 헤더 */}
      <div className="p-6 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-indigo-50/20">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold text-lg shadow-sm shadow-indigo-200">
            📋
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">신규 배차 등록</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              표준 고정 노선 또는 수동 일반 대절을 선택하여 기사와 차량을 배차합니다.
            </p>
          </div>
        </div>
      </div>

      {/* 에러 알림 */}
      {errorMessage && (
        <div className="mx-6 mt-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
          <span>⚠️ {errorMessage}</span>
        </div>
      )}

      {/* 폼 본문 */}
      <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* 1. 노선 선택 드롭다운 */}
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              운행 노선 선택 <span className="text-rose-500">*</span>
            </label>
            <select
              {...register("routeId")}
              className={`w-full px-3.5 py-2.5 text-xs font-medium rounded-xl border bg-white focus:outline-none focus:ring-2 transition-all ${
                errors.routeId
                  ? "border-rose-300 focus:ring-rose-100 focus:border-rose-500"
                  : "border-slate-200 focus:ring-indigo-100 focus:border-indigo-500"
              }`}
            >
              <optgroup label="[표준 고정 노선 마스터]">
                {routes.map((route) => (
                  <option key={route.id} value={route.id}>
                    📍 {route.name} ({route.departure} ➔ {route.destination} / {route.estimatedDistance}km)
                  </option>
                ))}
              </optgroup>
              <optgroup label="[수동 지정 및 대절]">
                <option value="CUSTOM">== 일반 대절 (수동 배차) ==</option>
              </optgroup>
            </select>
            {errors.routeId && (
              <p className="mt-1 text-[11px] text-rose-600 font-medium">{errors.routeId.message}</p>
            )}
          </div>

          {/* 2. 운행 일자 */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              배차 일자 <span className="text-rose-500">*</span>
            </label>
            <input
              type="date"
              {...register("date")}
              className="w-full px-3.5 py-2 text-xs font-medium rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 transition-all text-slate-800"
            />
            {errors.date && (
              <p className="mt-1 text-[11px] text-rose-600 font-medium">{errors.date.message}</p>
            )}
          </div>

          {/* 3. 운행 구분 */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              운행 구분 <span className="text-rose-500">*</span>
            </label>
            <select
              {...register("type")}
              className="w-full px-3.5 py-2 text-xs font-medium rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 transition-all text-slate-800"
            >
              <option value="출근">출근 배차</option>
              <option value="퇴근">퇴근 배차</option>
              <option value="주간정기">주간 정기 운행</option>
              <option value="일반대절">일반 대절 / 관광</option>
              <option value="기타">기타 배차</option>
            </select>
          </div>

          {/* 4. 기사 배정 */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">담당 기사 배정</label>
            <select
              {...register("driverId")}
              className="w-full px-3.5 py-2 text-xs font-medium rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 transition-all text-slate-800"
            >
              <option value="">(미배정 / 추후 배정)</option>
              {drivers.map((driver) => (
                <option key={driver.id} value={driver.id}>
                  👨‍✈️ {driver.name} ({driver.employmentType === "OWN" ? "직영" : driver.employmentType === "AFFILIATED" ? "지입" : "용차"})
                </option>
              ))}
            </select>
          </div>

          {/* 5. 차량 배정 */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">배정 차량</label>
            <select
              {...register("vehicleId")}
              className="w-full px-3.5 py-2 text-xs font-medium rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 transition-all text-slate-800"
            >
              <option value="">(미배정 / 추후 배정)</option>
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  🚌 {v.plateNumber} ({v.capacity}인승 / {v.modelName || "대형"})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* 6. 노선 선택에 따른 동적 안내 메시지 박스 (핵심 요구사항) */}
        <div className="pt-2">
          {isCustomCharter ? (
            // 일반 대절 선택 시 (계기판 사진 업로드 필요)
            <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/70 text-amber-900 flex items-start gap-3 transition-all animate-in fade-in">
              <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center font-bold text-sm shrink-0 mt-0.5">
                📸
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-amber-900">
                    계기판 사진 업로드 필요
                  </span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-200 text-amber-800">
                    일반 대절 (CUSTOM_CHARTER)
                  </span>
                </div>
                <p className="text-[11px] text-amber-800 mt-1 leading-relaxed">
                  일반 대절 운행은 고정 거리가 지정되지 않으므로, 기사가 모바일 웹 링크에서 운행 전/후 <strong>출발 계기판 및 도착 계기판 사진을 업로드</strong>해야 최종 주행거리와 유류비가 정산됩니다.
                </p>
              </div>
            </div>
          ) : (
            // 고정 노선 선택 시 (운행 종료 시 주행거리 자동 정산)
            <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/70 text-emerald-900 flex items-start gap-3 transition-all animate-in fade-in">
              <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-sm shrink-0 mt-0.5">
                ⚡
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-emerald-900">
                      운행 종료 시 주행거리 자동 정산
                    </span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-200 text-emerald-800">
                      고정 노선 (FIXED_ROUTE)
                    </span>
                  </div>
                  {selectedRoute && (
                    <span className="text-xs font-bold text-emerald-700">
                      편도 기준: {selectedRoute.estimatedDistance}km
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-emerald-800 mt-1 leading-relaxed">
                  노선 마스터에 등록된 표준 예상 거리({selectedRoute?.estimatedDistance || 0}km)와 기본 통행료({selectedRoute?.defaultTollFee?.toLocaleString() || 0}원)가 기사 운행 완료 시점에 <strong>자동으로 급여 및 청구서에 반영</strong>됩니다.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* 제출 및 취소 버튼 */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
          <button
            type="button"
            onClick={() => router.back()}
            disabled={isSubmitting}
            className="px-4 py-2.5 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors disabled:opacity-50"
          >
            취소
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center justify-center gap-2 px-6 py-2.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 rounded-xl shadow-sm transition-all disabled:opacity-50 min-w-[120px]"
          >
            {isSubmitting ? (
              <>
                <svg className="animate-spin h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                <span>등록 중...</span>
              </>
            ) : (
              "배차 등록 완료"
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
