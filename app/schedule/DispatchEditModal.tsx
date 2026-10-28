"use client";

import React, { useEffect, useState } from "react";
import {
  deleteDispatch,
  updateDispatchDetail,
  type CalendarDispatch,
  type DispatchType,
} from "./actions";

interface Option {
  id: string;
  label: string;
}

interface DispatchEditModalProps {
  dispatch: CalendarDispatch;
  routeOptions: Option[];
  driverOptions: Option[];
  vehicleOptions: Option[];
  onClose: () => void;
  /** 저장/삭제 성공 후 호출 (메시지는 토스트로 노출) */
  onSaved: (message: string) => void;
}

const inputClass =
  "w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm font-medium text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white";
const labelClass = "block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wider";

/**
 * 캘린더 배차 카드 클릭 시 열리는 배차 상세 수정 모달
 */
export default function DispatchEditModal({
  dispatch,
  routeOptions,
  driverOptions,
  vehicleOptions,
  onClose,
  onSaved,
}: DispatchEditModalProps) {
  const [date, setDate] = useState(dispatch.date);
  const [type, setType] = useState<DispatchType>(dispatch.type);
  const [routeId, setRouteId] = useState(dispatch.routeId);
  const [driverId, setDriverId] = useState(dispatch.driverId ?? "");
  const [vehicleId, setVehicleId] = useState(dispatch.vehicleId ?? "");
  const [busy, setBusy] = useState<"save" | "delete" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // ESC 키로 닫기
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onClose]);

  const isFixed = type === "FIXED";

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy("save");
    const res = await updateDispatchDetail({
      dispatchId: dispatch.id,
      date,
      type,
      routeId,
      driverId,
      vehicleId,
    });
    setBusy(null);
    if (!res.success) {
      setError(res.error || "배차 수정에 실패했습니다.");
      return;
    }
    onSaved("✅ 배차 정보가 수정되었습니다.");
  };

  const handleDelete = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setError(null);
    setBusy("delete");
    const res = await deleteDispatch(dispatch.id);
    setBusy(null);
    if (!res.success) {
      setError(res.error || "배차 삭제에 실패했습니다.");
      return;
    }
    onSaved("🗑️ 배차가 삭제되었습니다.");
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="dispatch-edit-title"
        className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-gray-100 overflow-hidden"
      >
        {/* 헤더: 배차 구분에 따라 색상 변경 */}
        <div
          className={`px-6 py-5 text-white flex items-center justify-between bg-gradient-to-r transition-colors ${
            isFixed ? "from-indigo-600 to-blue-600" : "from-amber-500 to-orange-500"
          }`}
        >
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">✏️</span>
            <div>
              <h3 id="dispatch-edit-title" className="text-lg font-extrabold tracking-tight">
                배차 상세 수정
              </h3>
              <p className="text-xs text-white/80 mt-0.5">
                {dispatch.date} · {dispatch.routeName} ({dispatch.clientName})
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => !busy && onClose()}
            className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white text-sm font-bold transition cursor-pointer"
            aria-label="닫기"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSave} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-semibold flex items-center gap-2">
              <span>⚠️</span>
              <span>{error}</span>
            </div>
          )}

          {/* 배차 구분 (고정/일반) 세그먼트 */}
          <div>
            <span className={labelClass}>배차 구분</span>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  { key: "FIXED", label: "📌 고정 노선", active: "bg-indigo-600 text-white border-indigo-600" },
                  { key: "NORMAL", label: "🚌 일반 노선", active: "bg-amber-500 text-white border-amber-500" },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.key}
                  id={`edit-type-${opt.key.toLowerCase()}`}
                  type="button"
                  onClick={() => setType(opt.key)}
                  className={`py-2.5 rounded-xl border text-sm font-bold transition cursor-pointer ${
                    type === opt.key ? opt.active : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="edit-date" className={labelClass}>
                배차 일자 <span className="text-rose-500">*</span>
              </label>
              <input
                id="edit-date"
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="edit-route" className={labelClass}>
                운행 노선 <span className="text-rose-500">*</span>
              </label>
              <select
                id="edit-route"
                required
                value={routeId}
                onChange={(e) => setRouteId(e.target.value)}
                className={inputClass}
              >
                {routeOptions.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="edit-driver" className={labelClass}>
                담당 기사
              </label>
              <select
                id="edit-driver"
                value={driverId}
                onChange={(e) => setDriverId(e.target.value)}
                className={inputClass}
              >
                <option value="">미배정</option>
                {driverOptions.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="edit-vehicle" className={labelClass}>
                배차 차량
              </label>
              <select
                id="edit-vehicle"
                value={vehicleId}
                onChange={(e) => setVehicleId(e.target.value)}
                className={inputClass}
              >
                <option value="">미배정</option>
                {vehicleOptions.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="pt-4 border-t border-gray-100 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2">
            <button
              id="edit-delete"
              type="button"
              disabled={!!busy}
              onClick={handleDelete}
              className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition cursor-pointer disabled:opacity-50 text-center ${
                confirmDelete
                  ? "bg-rose-600 text-white hover:bg-rose-700"
                  : "text-rose-600 border border-rose-200 hover:bg-rose-50"
              }`}
            >
              {busy === "delete" ? "삭제 중..." : confirmDelete ? "정말 삭제할까요?" : "배차 삭제"}
            </button>

            <div className="flex flex-col md:flex-row gap-2">
              <button
                type="button"
                disabled={!!busy}
                onClick={onClose}
                className="px-4 py-2.5 border border-gray-300 text-gray-700 hover:bg-gray-50 rounded-xl text-sm font-semibold transition cursor-pointer text-center"
              >
                취소
              </button>
              <button
                id="edit-save"
                type="submit"
                disabled={!!busy}
                className={`px-5 py-2.5 text-white rounded-xl text-sm font-bold shadow-md transition cursor-pointer disabled:opacity-50 text-center bg-gradient-to-r ${
                  isFixed
                    ? "from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700"
                    : "from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600"
                }`}
              >
                {busy === "save" ? "저장 중..." : "변경사항 저장"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
