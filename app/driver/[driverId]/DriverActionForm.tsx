"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { completeDispatch } from "@/app/actions/driver";

export interface DriverActionFormProps {
  dispatchId: string;
  routeType: "FIXED_ROUTE" | "CUSTOM_CHARTER" | string;
  status: string;
  estimatedDistance?: number | null;
  defaultTollFee?: number | null;
  actualDistance?: number | null;
  actualTollFee?: number | null;
  receiptImageUrl?: string | null;
}

/**
 * DB에 저장된 receiptImageUrl 문자열(단일 URL 또는 JSON 배열 문자열)을
 * 이미지 URL 배열로 안전하게 파싱하는 헬퍼
 */
export function parseReceiptImages(raw: string | null | undefined): string[] {
  if (!raw) return [];
  const trimmed = raw.trim();
  if (trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.filter(
          (u): u is string =>
            typeof u === "string" &&
            (u.startsWith("data:image/") ||
              u.startsWith("http") ||
              u.startsWith("/"))
        );
      }
    } catch {
      // ignore JSON parse error
    }
  }
  if (
    trimmed.startsWith("data:image/") ||
    trimmed.startsWith("http") ||
    trimmed.startsWith("/")
  ) {
    return [trimmed];
  }
  return [];
}

/**
 * 모바일 카메라 촬영 고해상도 이미지를 Canvas로 리사이징/압축하여
 * 여러 장 업로드 시에도 빠르게 전송 가능한 Data URL(JPEG)로 변환하는 헬퍼
 */
async function compressImageToDataUrl(
  file: File,
  maxWidth = 1200,
  quality = 0.78
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(e.target?.result as string);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function DriverActionForm({
  dispatchId,
  routeType,
  status: initialStatus,
  estimatedDistance = 0,
  defaultTollFee = 0,
  actualDistance: initialActualDistance = null,
  actualTollFee: initialActualTollFee = null,
  receiptImageUrl: initialReceiptUrl = null,
}: DriverActionFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // 일반 대절 폼에서 입력받은 주행거리(distance)와 다중 사진 배열(images) 상태 관리
  const [distance, setDistance] = useState<string>(
    initialActualDistance ? String(initialActualDistance) : ""
  );
  const [images, setImages] = useState<string[]>(() =>
    parseReceiptImages(initialReceiptUrl)
  );

  const [currentStatus, setCurrentStatus] = useState<string>(initialStatus);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // routeType 정규화 ('CUSTOM_CHARTER' 또는 'FIXED_ROUTE' 명확히 분기)
  const normalizedRouteType =
    routeType?.toUpperCase().trim() === "CUSTOM_CHARTER" ||
    routeType?.toUpperCase().trim() === "NORMAL"
      ? "CUSTOM_CHARTER"
      : "FIXED_ROUTE";

  // 여러 장 파일 선택 또는 카메라 연속 촬영 시 기존 목록에 누적 추가 (최대 6장)
  const handleFilesChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;
    setErrorMessage(null);

    const selectedFiles = Array.from(fileList);
    try {
      const compressedList = await Promise.all(
        selectedFiles.map((f) => compressImageToDataUrl(f))
      );
      setImages((prev) => [...prev, ...compressedList].slice(0, 6));
    } catch {
      setErrorMessage("사진을 불러오는 중 오류가 발생했습니다.");
    } finally {
      // 동일 파일 재선택 및 연속 촬영이 가능하도록 input 초기화
      e.target.value = "";
    }
  };

  // 개별 사진 삭제 핸들러
  const handleRemoveImage = (indexToRemove: number) => {
    setImages((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  };

  // 이미 운행 종료 또는 정산 대기 상태인 경우 완료 배지 및 다중 이미지 썸네일 표시
  if (currentStatus === "COMPLETED" || currentStatus === "PENDING_SETTLEMENT") {
    const submittedDistance = Number(
      distance || initialActualDistance || estimatedDistance || 0
    );
    return (
      <div className="mt-3 pt-3 border-t border-slate-700/60 space-y-2">
        <div
          className={`rounded-xl p-3 border flex items-center justify-between ${
            currentStatus === "COMPLETED"
              ? "bg-emerald-950/60 border-emerald-500/40 text-emerald-300"
              : "bg-amber-950/60 border-amber-500/40 text-amber-300"
          }`}
        >
          <div className="space-y-0.5">
            <div className="text-xs font-extrabold flex items-center gap-1.5">
              <span>{currentStatus === "COMPLETED" ? "✅" : "⏳"}</span>
              <span>
                {currentStatus === "COMPLETED"
                  ? "운행 종료 (자동 정산 완료)"
                  : "정산 내역 전송 완료 (승인 대기)"}
              </span>
            </div>
            <p className="text-[11px] text-slate-300">
              {feedbackMessage ||
                (submittedDistance > 0
                  ? `제출 주행거리: ${submittedDistance}km · 사진 ${images.length}장`
                  : `📷 사진 ${images.length}장 전송 완료 (사무실에서 거리·실비 입력)`)}
            </p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {currentStatus === "PENDING_SETTLEMENT" && (
              <button
                type="button"
                onClick={() => setCurrentStatus("ASSIGNED")}
                className="text-[10px] font-bold px-2 py-1 rounded-md bg-blue-600/30 hover:bg-blue-600/50 text-blue-200 border border-blue-400/40 cursor-pointer transition"
              >
                🔄 사진 추가/수정
              </button>
            )}
            <span className="text-[10px] font-bold px-2 py-1 rounded-md bg-slate-900/70 border border-slate-700">
              {currentStatus === "COMPLETED" ? "정산완료" : "정산대기"}
            </span>
          </div>
        </div>

        {images.length > 0 && (
          <div className="rounded-xl border border-slate-700/80 bg-slate-900/80 p-2.5">
            <span className="text-[10px] font-semibold text-slate-400 block mb-2">
              📎 제출된 계기판 / 영수증 사진 ({images.length}장)
            </span>
            <div className="grid grid-cols-3 gap-2">
              {images.map((imgSrc, idx) => (
                <div
                  key={idx}
                  className="relative aspect-square rounded-lg overflow-hidden border border-slate-700 bg-slate-950"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={imgSrc}
                    alt={`제출 사진 ${idx + 1}`}
                    className="w-full h-full object-cover"
                  />
                  <span className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded bg-black/70 text-[9px] font-bold text-white">
                    #{idx + 1}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // 1) FIXED_ROUTE (고정 노선) 전용 핸들러
  const handleFixedRouteComplete = () => {
    setErrorMessage(null);
    setFeedbackMessage(null);

    startTransition(async () => {
      const res = await completeDispatch(dispatchId);
      if (!res.success) {
        setErrorMessage(res.error || "자동 정산 처리 중 오류가 발생했습니다.");
        return;
      }
      setCurrentStatus(res.status || "COMPLETED");
      setFeedbackMessage(res.message || null);
      router.refresh();
    });
  };

  // 2) CUSTOM_CHARTER (일반 대절) 전용 폼 제출 핸들러 (다중 사진 & Camera-Only 지원)
  const handleCustomCharterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setFeedbackMessage(null);

    const parsedDistance = distance.trim() ? parseFloat(distance) : 0;
    const hasPhoto = images.length > 0;

    if ((!parsedDistance || parsedDistance <= 0) && !hasPhoto) {
      setErrorMessage(
        "📷 계기판/영수증 사진을 1장 이상 첨부하시거나 실제 주행거리(km)를 입력해 주세요."
      );
      return;
    }

    startTransition(async () => {
      // 1장이면 단일 문자열, 여러 장이면 JSON 배열 문자열로 직렬화하여 DB 호환성 유지
      const serializedReceiptUrl =
        images.length === 0
          ? null
          : images.length === 1
          ? images[0]
          : JSON.stringify(images);

      const res = await completeDispatch(dispatchId, {
        actualDistance: parsedDistance > 0 ? parsedDistance : 0,
        receiptImageUrl: serializedReceiptUrl,
      });

      if (!res.success) {
        setErrorMessage(res.error || "정산 내역 전송 중 오류가 발생했습니다.");
        return;
      }

      setCurrentStatus(res.status || "PENDING_SETTLEMENT");
      setFeedbackMessage(res.message || null);
      router.refresh();
    });
  };

  return (
    <div className="mt-3 pt-3 border-t border-slate-700/60 space-y-2.5">
      {errorMessage && (
        <div className="p-2.5 rounded-xl bg-rose-950/80 border border-rose-500/40 text-rose-300 text-xs font-semibold flex items-center gap-1.5">
          <span>⚠️</span>
          <span>{errorMessage}</span>
        </div>
      )}

      {/* 조건부 렌더링 분기: FIXED_ROUTE vs CUSTOM_CHARTER */}
      {normalizedRouteType === "FIXED_ROUTE" ? (
        <button
          type="button"
          disabled={isPending}
          onClick={handleFixedRouteComplete}
          className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-extrabold shadow-lg shadow-emerald-600/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
        >
          {isPending ? (
            <>
              <svg
                className="animate-spin h-4 w-4 text-white"
                viewBox="0 0 24 24"
                fill="none"
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
                  d="M4 12a8 8 0 018-8v8H4z"
                />
              </svg>
              <span>자동 정산 처리 중...</span>
            </>
          ) : (
            <span>운행 종료 및 자동 정산</span>
          )}
        </button>
      ) : (
        <form onSubmit={handleCustomCharterSubmit} className="space-y-2.5">
          <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-700/80 space-y-3">
            {/* ① 다중 사진(계기판 + 톨비/주차비 영수증) 연속 촬영 및 업로드 영역 */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-[11px] font-bold text-cyan-300">
                  📷 계기판 / 영수증 사진 첨부 ({images.length}/6장)
                </label>
                <span className="text-[10px] text-emerald-400 font-semibold">
                  여러 장 연속 추가 가능!
                </span>
              </div>

              <label className="w-full py-2.5 px-3 rounded-xl border border-dashed border-blue-500/50 bg-blue-950/30 hover:bg-blue-950/50 text-blue-200 text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition">
                <span>➕ 사진 촬영 / 앨범에서 여러 장 선택</span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleFilesChange}
                  className="hidden"
                />
              </label>

              {/* 첨부된 다중 사진 미리보기 그리드 (개별 삭제 가능) */}
              {images.length > 0 && (
                <div className="mt-2.5 grid grid-cols-3 gap-2">
                  {images.map((imgSrc, idx) => (
                    <div
                      key={idx}
                      className="relative aspect-square rounded-lg overflow-hidden border border-slate-700 bg-slate-950 group"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={imgSrc}
                        alt={`첨부 사진 ${idx + 1}`}
                        className="w-full h-full object-cover"
                      />
                      <span className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded bg-black/70 text-[9px] font-bold text-white">
                        {idx === 0 ? "사진 1" : `사진 ${idx + 1}`}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveImage(idx)}
                        className="absolute top-1 right-1 w-5 h-5 rounded-full bg-rose-600 text-white text-[11px] font-black flex items-center justify-center shadow-md cursor-pointer"
                        title="이 사진 삭제"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ② 실제 주행거리 입력 필드 (선택 입력) */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-[11px] font-bold text-slate-300">
                  실제 주행거리 (km)
                </label>
                <span className="text-[10px] text-slate-400">
                  선택사항 (사진만 찍어 보내도 OK)
                </span>
              </div>
              <input
                type="number"
                step="0.1"
                min="0"
                value={distance}
                onChange={(e) => setDistance(e.target.value)}
                placeholder="실제 주행거리 (km) - 생략 가능"
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* ③ 일반 대절 전용 정산 요청 버튼 */}
          <button
            type="submit"
            disabled={isPending}
            className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-extrabold shadow-lg shadow-blue-600/25 transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
          >
            {isPending ? (
              <>
                <svg
                  className="animate-spin h-4 w-4 text-white"
                  viewBox="0 0 24 24"
                  fill="none"
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
                    d="M4 12a8 8 0 018-8v8H4z"
                  />
                </svg>
                <span>사무실로 정산 내역 전송 중...</span>
              </>
            ) : (
              <span>
                정산 내역 사무실 전송
                {images.length > 0 ? ` (사진 ${images.length}장)` : ""}
              </span>
            )}
          </button>
        </form>
      )}
    </div>
  );
}
