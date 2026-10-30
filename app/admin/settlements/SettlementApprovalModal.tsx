"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { approvePendingSettlement } from "@/app/actions/admin";
import { calculateDispatchPayout } from "@/lib/payroll-calculator";

export interface PendingSettlementItemProps {
  dispatchId: string;
  date: string;
  routeName: string;
  clientName: string;
  driverName: string;
  plateNumber: string;
  actualDistance: number;
  actualTollFee: number;
  parkingFee: number;
  receiptImageUrl: string | null;
}

/**
 * 단일 URL 또는 JSON 배열 문자열로 저장된 receiptImageUrl을 배열로 파싱
 */
export function parseReceiptImageArray(raw: string | null | undefined): string[] {
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
              u.startsWith("http://") ||
              u.startsWith("https://") ||
              u.startsWith("/"))
        );
      }
    } catch {
      // ignore
    }
  }
  if (
    trimmed.startsWith("data:image/") ||
    trimmed.startsWith("http://") ||
    trimmed.startsWith("https://") ||
    trimmed.startsWith("/")
  ) {
    return [trimmed];
  }
  return [];
}

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

export default function SettlementApprovalModal({
  item,
}: {
  item: PendingSettlementItemProps;
}) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [zoomIndex, setZoomIndex] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();

  const [distanceInput, setDistanceInput] = useState<string>(
    String(item.actualDistance || 0)
  );
  const [tollFeeInput, setTollFeeInput] = useState<string>(
    String(item.actualTollFee || 0)
  );
  const [parkingFeeInput, setParkingFeeInput] = useState<string>(
    String(item.parkingFee || 0)
  );
  const [imageList, setImageList] = useState<string[]>(() =>
    parseReceiptImageArray(item.receiptImageUrl)
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // 관리자 모달에서 여러 장 사진 추가 업로드 지원
  const handleAdminImageUpload = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;
    try {
      const newUrls = await Promise.all(
        Array.from(fileList).map((f) => compressImageToDataUrl(f))
      );
      setImageList((prev) => [...prev, ...newUrls].slice(0, 6));
    } catch {
      setErrorMessage("이미지 변환 중 오류가 발생했습니다.");
    } finally {
      e.target.value = "";
    }
  };

  const handleRemoveImage = (indexToRemove: number) => {
    setImageList((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  };

  const handleApproveSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const parsedDistance = parseFloat(distanceInput) || 0;
    const parsedToll = parseInt(tollFeeInput, 10) || 0;
    const parsedParking = parseInt(parkingFeeInput, 10) || 0;

    const serializedReceiptUrl =
      imageList.length === 0
        ? item.receiptImageUrl
        : imageList.length === 1
        ? imageList[0]
        : JSON.stringify(imageList);

    startTransition(async () => {
      const res = await approvePendingSettlement(item.dispatchId, {
        actualDistance: parsedDistance,
        actualTollFee: parsedToll,
        parkingFee: parsedParking,
        receiptImageUrl: serializedReceiptUrl,
      });

      if (!res.success) {
        setErrorMessage(res.error || "정산 승인 처리 중 오류가 발생했습니다.");
        return;
      }

      setIsOpen(false);
      router.refresh();
    });
  };

  const totalExtraExpense =
    (parseInt(tollFeeInput, 10) || 0) + (parseInt(parkingFeeInput, 10) || 0);

  const estimatedTotalPayout = calculateDispatchPayout({
    status: "COMPLETED",
    actualDistance: parseFloat(distanceInput) || 0,
    actualTollFee: parseInt(tollFeeInput, 10) || 0,
    parkingFee: parseInt(parkingFeeInput, 10) || 0,
    date: item.date,
  });

  return (
    <>
      {/* 목록 내 '정산 검토' 트리거 버튼 */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="px-3.5 py-2 rounded-xl bg-[#0A1931] hover:bg-blue-700 text-white text-xs font-bold tracking-tight transition shadow-xs cursor-pointer whitespace-nowrap"
      >
        정산 검토
      </button>

      {/* 영수증 확인 및 최종 정산 승인 모달 */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 whitespace-normal text-left">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-fade-in max-h-[92vh] flex flex-col">
            {/* 모달 헤더 */}
            <div className="px-6 py-4 bg-[#0A1931] text-white flex items-center justify-between shrink-0">
              <div>
                <span className="text-[11px] font-bold text-cyan-400 uppercase tracking-wider block">
                  일반 대절 수동 정산 검토
                </span>
                <h3 className="text-base font-extrabold tracking-tight mt-0.5">
                  {item.date} · {item.routeName}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition cursor-pointer"
                aria-label="닫기"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form
              onSubmit={handleApproveSubmit}
              className="p-6 space-y-5 overflow-y-auto overflow-x-hidden"
            >
              {/* 기사 및 차량 요약 정보 */}
              <div className="grid grid-cols-3 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs text-center">
                <div>
                  <span className="text-slate-400 block text-[11px]">운행 기사</span>
                  <span className="font-bold text-slate-900 mt-0.5 block">
                    {item.driverName}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">차량 번호</span>
                  <span className="font-bold text-slate-900 mt-0.5 block">
                    {item.plateNumber}호
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">기사 제출 거리</span>
                  <span className="font-extrabold text-blue-600 mt-0.5 block">
                    {item.actualDistance > 0
                      ? `${item.actualDistance} km`
                      : "📷 사진 전용 제출"}
                  </span>
                </div>
              </div>

              {/* 다중 영수증 / 계기판 사진 갤러리 확인 및 확대(Zoom) 영역 */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-700">
                    제출된 계기판 / 영수증 사진 ({imageList.length}장)
                  </label>
                  <div className="flex items-center gap-2">
                    {imageList.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setZoomIndex(0)}
                        className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer"
                      >
                        <span>🔍 크게 보기</span>
                      </button>
                    )}
                    <label className="text-xs font-bold text-indigo-600 hover:text-indigo-800 cursor-pointer flex items-center gap-1 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-200">
                      <span>📷 사진 추가 첨부</span>
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={handleAdminImageUpload}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>

                {imageList.length > 0 ? (
                  <div
                    className={`grid gap-2.5 ${
                      imageList.length === 1 ? "grid-cols-1" : "grid-cols-2 sm:grid-cols-3"
                    }`}
                  >
                    {imageList.map((imgSrc, idx) => (
                      <div
                        key={idx}
                        onClick={() => setZoomIndex(idx)}
                        title="클릭하면 원본 크기로 확대됩니다"
                        className="relative group rounded-xl overflow-hidden border border-slate-200 bg-slate-900 h-44 flex items-center justify-center cursor-zoom-in"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={imgSrc}
                          alt={`증빙 사진 ${idx + 1}`}
                          className="h-full w-full object-contain group-hover:scale-[1.03] transition-transform"
                        />
                        <span className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-black/70 text-white text-[10px] font-bold">
                          사진 #{idx + 1}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveImage(idx);
                          }}
                          className="absolute top-2 right-2 w-6 h-6 rounded-full bg-rose-600/90 hover:bg-rose-600 text-white text-xs font-black flex items-center justify-center shadow cursor-pointer"
                          title="이 사진 제거"
                        >
                          ✕
                        </button>
                        <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded bg-black/70 text-white text-[10px] font-semibold">
                          🔍 확대
                        </div>
                      </div>
                    ))}
                  </div>
                ) : item.receiptImageUrl ? (
                  <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-1.5 break-words">
                    <span className="font-bold block">
                      📎 파일명 기록됨: {decodeURIComponent(item.receiptImageUrl.split("/").pop() || "")}
                    </span>
                    <p className="text-[11px] text-amber-700 leading-relaxed">
                      우측 상단 <strong>[📷 사진 추가 첨부]</strong> 버튼을 눌러 사진을 올리시거나, 기사 모바일 화면에서 <strong>[🔄 사진 추가/수정]</strong> 후 다시 제출하시면 여러 장의 이미지가 바로 표시됩니다.
                    </p>
                  </div>
                ) : (
                  <div className="p-6 rounded-xl border border-dashed border-slate-300 bg-slate-50 text-center text-xs text-slate-400">
                    업로드된 영수증 사진이 없습니다. 우측 상단 [📷 사진 추가 첨부]로 여러 장 등록할 수 있습니다.
                  </div>
                )}
              </div>

              {/* 관리자 실비 입력 및 확정 주행거리 폼 */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    확정 주행거리 (km)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    required
                    value={distanceInput}
                    onChange={(e) => setDistanceInput(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    톨게이트비 (원)
                  </label>
                  <input
                    type="number"
                    step="100"
                    min="0"
                    value={tollFeeInput}
                    onChange={(e) => setTollFeeInput(e.target.value)}
                    placeholder="0"
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    주차비 / 기타 실비 (원)
                  </label>
                  <input
                    type="number"
                    step="100"
                    min="0"
                    value={parkingFeeInput}
                    onChange={(e) => setParkingFeeInput(e.target.value)}
                    placeholder="0"
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
              </div>

              {/* 합산 실비 및 단가 기준표 연동 최종 수당 안내 */}
              <div className="p-3.5 rounded-xl bg-slate-100 border border-slate-200 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-600">
                    추가 인정 실비 합계 (톨비 + 주차비)
                  </span>
                  <span className="text-sm font-bold text-slate-800">
                    +{totalExtraExpense.toLocaleString("ko-KR")}원
                  </span>
                </div>
                <div className="pt-2 border-t border-slate-200/80 flex items-center justify-between">
                  <span className="font-bold text-blue-700">
                    💳 단가 기준표 연동 예상 기사 지급 총액 (거리수당 + 실비)
                  </span>
                  <span className="text-base font-black text-emerald-600">
                    +{estimatedTotalPayout.toLocaleString("ko-KR")}원
                  </span>
                </div>
              </div>

              {errorMessage && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">
                  ⚠️ {errorMessage}
                </div>
              )}

              {/* 하단 액션 버튼 */}
              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => setIsOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 text-xs font-bold transition cursor-pointer"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold shadow-md shadow-emerald-600/20 transition flex items-center gap-2 disabled:opacity-50 cursor-pointer"
                >
                  {isPending ? (
                    <>
                      <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                      </svg>
                      <span>승인 처리 중...</span>
                    </>
                  ) : (
                    <span>✅ 최종 정산 승인</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 다중 사진 전체화면 확대(Lightbox) 슬라이드 뷰어 */}
      {zoomIndex !== null && imageList[zoomIndex] && (
        <div
          onClick={() => setZoomIndex(null)}
          className="fixed inset-0 z-[60] bg-black/92 flex flex-col items-center justify-center p-4 whitespace-normal text-left"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-4xl flex items-center justify-between text-white mb-3 px-2"
          >
            <span className="text-sm font-bold">
              📷 {item.date} · {item.driverName} 기사 증빙 사진 ({zoomIndex + 1} /{" "}
              {imageList.length}장)
            </span>
            <div className="flex items-center gap-2">
              <a
                href={imageList[zoomIndex]}
                download={`영수증_${item.date}_${item.driverName}_${zoomIndex + 1}.jpg`}
                className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-bold"
              >
                📥 다운로드
              </a>
              <button
                type="button"
                onClick={() => setZoomIndex(null)}
                className="px-3 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-xs font-bold cursor-pointer"
              >
                ✕ 닫기
              </button>
            </div>
          </div>

          <div
            onClick={(e) => e.stopPropagation()}
            className="relative flex items-center justify-center w-full max-w-4xl"
          >
            {imageList.length > 1 && (
              <button
                type="button"
                onClick={() =>
                  setZoomIndex((prev) =>
                    prev !== null
                      ? (prev - 1 + imageList.length) % imageList.length
                      : 0
                  )
                }
                className="absolute left-2 z-10 px-3.5 py-2.5 rounded-full bg-black/70 hover:bg-black text-white text-sm font-black border border-white/20 cursor-pointer"
              >
                ◀
              </button>
            )}

            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageList[zoomIndex]}
              alt={`증빙 사진 원본 ${zoomIndex + 1}`}
              className="max-h-[78vh] max-w-full object-contain rounded-lg shadow-2xl"
            />

            {imageList.length > 1 && (
              <button
                type="button"
                onClick={() =>
                  setZoomIndex((prev) =>
                    prev !== null ? (prev + 1) % imageList.length : 0
                  )
                }
                className="absolute right-2 z-10 px-3.5 py-2.5 rounded-full bg-black/70 hover:bg-black text-white text-sm font-black border border-white/20 cursor-pointer"
              >
                ▶
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}
