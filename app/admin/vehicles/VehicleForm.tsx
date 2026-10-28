"use client";

import React, { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CapacityType, VehicleStatus } from "@prisma/client";
import { createVehicle, updateVehicle } from "@/app/actions/vehicle";

// Zod 폼 검증 스키마
export const vehicleFormSchema = z.object({
  plateNumber: z
    .string()
    .min(2, "차량번호를 2자 이상 입력해 주세요 (예: 서울70바1234)")
    .max(20, "차량번호가 너무 깁니다."),
  capacity: z
    .number()
    .min(1, "최소 1인승 이상이어야 합니다."),
  capacityType: z.nativeEnum(CapacityType),
  modelName: z.string().optional(),
  manufactureYear: z
    .number()
    .min(1990, "1990년 이후 연식을 입력해 주세요.")
    .max(new Date().getFullYear() + 2, "유효한 연식을 입력해 주세요.")
    .optional()
    .nullable(),
  status: z.nativeEnum(VehicleStatus),
  amenities: z.object({
    wifi: z.boolean(),
    usb: z.boolean(),
    fridge: z.boolean(),
  }),
  isMarketplaceVisible: z.boolean(),
  dailyRentalPrice: z
    .number()
    .optional()
    .nullable(),
  mileage: z
    .number()
    .optional()
    .nullable(),
});

export type VehicleFormData = z.infer<typeof vehicleFormSchema>;

export interface VehicleData {
  id: string;
  plateNumber: string;
  capacity: number;
  capacityType: CapacityType;
  modelName?: string | null;
  manufactureYear?: number | null;
  status: VehicleStatus;
  amenities?: any;
  isMarketplaceVisible?: boolean;
  dailyRentalPrice?: number | null;
  mileage?: number | null;
}

interface VehicleFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialData?: VehicleData | null;
  onSuccess?: () => void;
}

// 인승/등급 라벨
export const CAPACITY_TYPE_LABELS: Record<CapacityType, string> = {
  VAN_11: "11인승 (밴/스타리아)",
  MINI_15: "15인승 (미니버스/쏠라티)",
  COMPACT_25: "25인승 (소형버스)",
  PREMIUM_28: "28인승 (우등 리무진)",
  LUXURY_31: "31인승 (프리미엄)",
  STANDARD_45: "45인승 (일반 대형)",
  LARGE_47: "47인승 (대형)",
  OTHER: "기타",
};

// 차량 상태 라벨 & 배지 스타일
export const STATUS_CONFIG: Record<
  VehicleStatus,
  { label: string; badgeClass: string; dotClass: string }
> = {
  AVAILABLE: {
    label: "운행 가능",
    badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200",
    dotClass: "bg-emerald-500",
  },
  DISPATCHED: {
    label: "배차 운행중",
    badgeClass: "bg-blue-50 text-blue-700 border-blue-200",
    dotClass: "bg-blue-500",
  },
  IDLE: {
    label: "대기/유휴",
    badgeClass: "bg-amber-50 text-amber-700 border-amber-200",
    dotClass: "bg-amber-500",
  },
  MAINTENANCE: {
    label: "정비/점검중",
    badgeClass: "bg-rose-50 text-rose-700 border-rose-200",
    dotClass: "bg-rose-500",
  },
  INACTIVE: {
    label: "비가동/휴지",
    badgeClass: "bg-gray-100 text-gray-600 border-gray-200",
    dotClass: "bg-gray-400",
  },
};

export default function VehicleFormModal({
  isOpen,
  onClose,
  initialData,
  onSuccess,
}: VehicleFormModalProps) {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const parsedAmenities = {
    wifi: Boolean(initialData?.amenities?.wifi),
    usb: Boolean(initialData?.amenities?.usb),
    fridge: Boolean(initialData?.amenities?.fridge),
  };

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<VehicleFormData>({
    resolver: zodResolver(vehicleFormSchema),
    defaultValues: {
      plateNumber: initialData?.plateNumber || "",
      capacity: initialData?.capacity || 45,
      capacityType: initialData?.capacityType || CapacityType.STANDARD_45,
      modelName: initialData?.modelName || "",
      manufactureYear: initialData?.manufactureYear || new Date().getFullYear(),
      status: initialData?.status || VehicleStatus.AVAILABLE,
      amenities: parsedAmenities,
      isMarketplaceVisible: initialData?.isMarketplaceVisible ?? false,
      dailyRentalPrice: initialData?.dailyRentalPrice || 0,
      mileage: initialData?.mileage || 0,
    },
  });

  // initialData 변경 시 폼 필드 동기화
  useEffect(() => {
    if (isOpen) {
      reset({
        plateNumber: initialData?.plateNumber || "",
        capacity: initialData?.capacity || 45,
        capacityType: initialData?.capacityType || CapacityType.STANDARD_45,
        modelName: initialData?.modelName || "",
        manufactureYear: initialData?.manufactureYear || new Date().getFullYear(),
        status: initialData?.status || VehicleStatus.AVAILABLE,
        amenities: {
          wifi: Boolean(initialData?.amenities?.wifi),
          usb: Boolean(initialData?.amenities?.usb),
          fridge: Boolean(initialData?.amenities?.fridge),
        },
        isMarketplaceVisible: initialData?.isMarketplaceVisible ?? false,
        dailyRentalPrice: initialData?.dailyRentalPrice || 0,
        mileage: initialData?.mileage || 0,
      });
      setErrorMessage(null);
    }
  }, [isOpen, initialData, reset]);

  if (!isOpen) return null;

  // 폼 제출 핸들러 (서버 액션 호출)
  const onSubmit = async (values: VehicleFormData) => {
    setErrorMessage(null);

    // 부가옵션을 JSON 규격 {"wifi": true, "usb": false, "fridge": true} 형태로 서버 액션에 전달
    const payload = {
      plateNumber: values.plateNumber.trim(),
      capacity: Number(values.capacity),
      capacityType: values.capacityType,
      modelName: values.modelName?.trim() || undefined,
      manufactureYear: values.manufactureYear ? Number(values.manufactureYear) : null,
      status: values.status,
      amenities: {
        wifi: Boolean(values.amenities.wifi),
        usb: Boolean(values.amenities.usb),
        fridge: Boolean(values.amenities.fridge),
      },
      isMarketplaceVisible: Boolean(values.isMarketplaceVisible),
      dailyRentalPrice: values.dailyRentalPrice ? Number(values.dailyRentalPrice) : null,
      mileage: values.mileage ? Number(values.mileage) : null,
    };

    try {
      let result;
      if (initialData?.id) {
        // 수정 (PATCH)
        result = await updateVehicle(initialData.id, payload);
      } else {
        // 등록 (POST)
        result = await createVehicle(payload);
      }

      if (!result.success) {
        setErrorMessage(result.error || "작업을 완료할 수 없습니다.");
        alert(result.error || "오류가 발생했습니다.");
        return;
      }

      alert(
        initialData?.id
          ? `차량 [${values.plateNumber}] 정보가 성공적으로 수정되었습니다.`
          : `신규 차량 [${values.plateNumber}]이(가) 성공적으로 등록되었습니다.`
      );

      reset();
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      console.error(err);
      const msg = err.message || "서버 통신 중 알 수 없는 오류가 발생했습니다.";
      setErrorMessage(msg);
      alert(msg);
    }
  };

  const isEditMode = Boolean(initialData?.id);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden transform transition-all animate-in fade-in zoom-in-95 duration-150">
        {/* 모달 헤더 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/70">
          <div>
            <h3 className="text-lg font-bold text-slate-800">
              {isEditMode ? "차량 제원 정보 수정" : "신규 차량 등록"}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              차량번호, 규격 인승 및 편의 옵션을 등록하여 배차 및 B2B 중개에 활용합니다.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-200/50 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 에러 알림 배너 */}
        {errorMessage && (
          <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2.5 text-xs text-red-700">
            <svg className="w-4 h-4 text-red-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{errorMessage}</span>
          </div>
        )}

        {/* 폼 본문 */}
        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* 차량 번호 */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                차량 번호 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                placeholder="예: 서울70바1234"
                {...register("plateNumber")}
                className={`w-full px-3.5 py-2 text-sm rounded-xl border bg-white focus:outline-none focus:ring-2 transition-all ${
                  errors.plateNumber
                    ? "border-red-300 focus:ring-red-100 focus:border-red-500"
                    : "border-slate-200 focus:ring-indigo-100 focus:border-indigo-500"
                }`}
              />
              {errors.plateNumber && (
                <p className="mt-1 text-xs text-red-600 font-medium">{errors.plateNumber.message}</p>
              )}
            </div>

            {/* 모델명 */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">모델명 (선택)</label>
              <input
                type="text"
                placeholder="예: 현대 뉴 유니버스 노블"
                {...register("modelName")}
                className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 transition-all"
              />
            </div>

            {/* 인승 규격 (CapacityType Select 드롭다운) */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                인승 / 차량 등급 <span className="text-red-500">*</span>
              </label>
              <select
                {...register("capacityType")}
                className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 transition-all font-medium text-slate-700"
              >
                {Object.entries(CAPACITY_TYPE_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            {/* 등록 인원 (탑승 정원) */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                탑승 정원 (인승) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min={1}
                max={60}
                placeholder="45"
                {...register("capacity", { valueAsNumber: true })}
                className={`w-full px-3.5 py-2 text-sm rounded-xl border bg-white focus:outline-none focus:ring-2 transition-all ${
                  errors.capacity
                    ? "border-red-300 focus:ring-red-100 focus:border-red-500"
                    : "border-slate-200 focus:ring-indigo-100 focus:border-indigo-500"
                }`}
              />
              {errors.capacity && (
                <p className="mt-1 text-xs text-red-600 font-medium">{errors.capacity.message}</p>
              )}
            </div>

            {/* 제조 연식 */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">제조 연식</label>
              <input
                type="number"
                placeholder="2023"
                {...register("manufactureYear", { valueAsNumber: true })}
                className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 transition-all"
              />
              {errors.manufactureYear && (
                <p className="mt-1 text-xs text-red-600">{errors.manufactureYear.message}</p>
              )}
            </div>

            {/* 차량 가용 상태 (VehicleStatus Select 드롭다운) */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                운행 / 가용 상태 <span className="text-red-500">*</span>
              </label>
              <select
                {...register("status")}
                className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 transition-all font-medium text-slate-700"
              >
                {Object.entries(STATUS_CONFIG).map(([key, item]) => (
                  <option key={key} value={key}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 부가옵션 (Json 필드) - 3개의 체크박스 (와이파이, USB 충전, 냉장고) */}
          <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-200/80">
            <label className="block text-xs font-semibold text-slate-700 mb-2">
              차량 부가 옵션 (편의 시설)
            </label>
            <div className="grid grid-cols-3 gap-3">
              {/* 와이파이 */}
              <label className="flex items-center gap-2.5 p-2.5 bg-white rounded-lg border border-slate-200 hover:border-indigo-300 cursor-pointer transition-colors shadow-xs">
                <input
                  type="checkbox"
                  {...register("amenities.wifi")}
                  className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
                />
                <span className="text-xs font-medium text-slate-700 flex items-center gap-1.5">
                  📶 와이파이
                </span>
              </label>

              {/* USB 충전포트 */}
              <label className="flex items-center gap-2.5 p-2.5 bg-white rounded-lg border border-slate-200 hover:border-indigo-300 cursor-pointer transition-colors shadow-xs">
                <input
                  type="checkbox"
                  {...register("amenities.usb")}
                  className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
                />
                <span className="text-xs font-medium text-slate-700 flex items-center gap-1.5">
                  🔌 USB 충전
                </span>
              </label>

              {/* 차량용 냉장고 */}
              <label className="flex items-center gap-2.5 p-2.5 bg-white rounded-lg border border-slate-200 hover:border-indigo-300 cursor-pointer transition-colors shadow-xs">
                <input
                  type="checkbox"
                  {...register("amenities.fridge")}
                  className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
                />
                <span className="text-xs font-medium text-slate-700 flex items-center gap-1.5">
                  🧊 냉장고
                </span>
              </label>
            </div>
            <p className="mt-2 text-[11px] text-slate-400">
              체크된 항목은 B2B 전세버스 마켓플레이스 및 견적 시 탑승객 편의 제원으로 자동 안내됩니다.
            </p>
          </div>

          {/* B2B 중개 마켓플레이스 옵션 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1 border-t border-slate-100">
            <div className="flex items-center gap-2.5 mt-2">
              <input
                id="isMarketplaceVisible"
                type="checkbox"
                {...register("isMarketplaceVisible")}
                className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
              />
              <label htmlFor="isMarketplaceVisible" className="text-xs font-semibold text-slate-700 cursor-pointer">
                B2B 중개 마켓에 유휴 차량 공개
              </label>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                일일 기준 임대/용차 희망가 (원)
              </label>
              <input
                type="number"
                placeholder="예: 450000"
                {...register("dailyRentalPrice", { valueAsNumber: true })}
                className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 transition-all"
              />
            </div>
          </div>

          {/* 폼 액션 버튼 */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2.5 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors disabled:opacity-50"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 rounded-xl shadow-sm transition-all disabled:opacity-50 min-w-[100px]"
            >
              {isSubmitting ? (
                <>
                  <svg className="animate-spin h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  <span>저장 중...</span>
                </>
              ) : isEditMode ? (
                "정보 수정 완료"
              ) : (
                "신규 차량 등록"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
