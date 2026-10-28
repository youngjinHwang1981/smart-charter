"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { CapacityType, VehicleStatus } from "@prisma/client";
import VehicleFormModal, {
  CAPACITY_TYPE_LABELS,
  STATUS_CONFIG,
  VehicleData,
} from "./VehicleForm";
import { deleteVehicle } from "@/app/actions/vehicle";

interface VehicleItem {
  id: string;
  plateNumber: string;
  capacity: number;
  capacityType: CapacityType;
  modelName: string | null;
  manufactureYear: number | null;
  status: VehicleStatus;
  amenities: any;
  isMarketplaceVisible: boolean;
  dailyRentalPrice: number | null;
  mileage: number | null;
  createdAt: Date | string;
  company?: {
    id: string;
    name: string;
  } | null;
  _count?: {
    assignments: number;
  };
}

interface VehicleTableClientProps {
  vehicles: VehicleItem[];
}

export default function VehicleTableClient({ vehicles }: VehicleTableClientProps) {
  const router = useRouter();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState<VehicleData | null>(null);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("ALL");

  // 등록 모달 열기
  const handleOpenCreateModal = () => {
    setSelectedVehicle(null);
    setIsModalOpen(true);
  };

  // 수정 모달 열기
  const handleOpenEditModal = (vehicle: VehicleItem) => {
    setSelectedVehicle({
      id: vehicle.id,
      plateNumber: vehicle.plateNumber,
      capacity: vehicle.capacity,
      capacityType: vehicle.capacityType,
      modelName: vehicle.modelName,
      manufactureYear: vehicle.manufactureYear,
      status: vehicle.status,
      amenities: vehicle.amenities,
      isMarketplaceVisible: vehicle.isMarketplaceVisible,
      dailyRentalPrice: vehicle.dailyRentalPrice,
      mileage: vehicle.mileage,
    });
    setIsModalOpen(true);
  };

  // 차량 삭제 처리
  const handleDelete = async (vehicle: VehicleItem) => {
    const confirmMsg = `차량번호 [${vehicle.plateNumber}]을(를) 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`;
    if (!window.confirm(confirmMsg)) return;

    try {
      setIsDeleting(vehicle.id);
      const res = await deleteVehicle(vehicle.id);
      if (!res.success) {
        alert(res.error || "삭제에 실패했습니다.");
        return;
      }
      alert(`차량 [${vehicle.plateNumber}]이(가) 정상적으로 삭제되었습니다.`);
      router.refresh();
    } catch (err: any) {
      alert(err.message || "삭제 중 오류가 발생했습니다.");
    } finally {
      setIsDeleting(null);
    }
  };

  // 상태 필터링
  const filteredVehicles = vehicles.filter((v) => {
    if (filterStatus === "ALL") return true;
    return v.status === filterStatus;
  });

  return (
    <div>
      {/* 액션 바 & 필터 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-500">상태 필터:</span>
          <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 shadow-xs">
            <button
              onClick={() => setFilterStatus("ALL")}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                filterStatus === "ALL"
                  ? "bg-indigo-600 text-white shadow-xs"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              전체 ({vehicles.length})
            </button>
            {Object.entries(STATUS_CONFIG).map(([key, config]) => {
              const count = vehicles.filter((v) => v.status === key).length;
              return (
                <button
                  key={key}
                  onClick={() => setFilterStatus(key)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 ${
                    filterStatus === key
                      ? "bg-slate-800 text-white"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${config.dotClass}`} />
                  <span>{config.label}</span>
                  <span className="text-[10px] opacity-75">({count})</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 신규 차량 등록 버튼 */}
        <button
          onClick={handleOpenCreateModal}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 rounded-xl shadow-sm transition-all shadow-indigo-200"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
          </svg>
          <span>신규 차량 등록</span>
        </button>
      </div>

      {/* 데이터 테이블 */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <th scope="col" className="px-5 py-3.5">차량번호</th>
                <th scope="col" className="px-4 py-3.5">연식</th>
                <th scope="col" className="px-4 py-3.5">인승 / 등급</th>
                <th scope="col" className="px-4 py-3.5">상태</th>
                <th scope="col" className="px-5 py-3.5">부가옵션</th>
                <th scope="col" className="px-4 py-3.5 text-right">액션 (수정/삭제)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
              {filteredVehicles.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <svg className="w-8 h-8 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                      </svg>
                      <p className="text-sm font-medium">등록된 차량이 없습니다.</p>
                      <p className="text-xs text-slate-400">우측 상단의 &apos;신규 차량 등록&apos; 버튼을 눌러 첫 차량을 등록해 보세요.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredVehicles.map((vehicle) => {
                  const statusConf = STATUS_CONFIG[vehicle.status] || STATUS_CONFIG.AVAILABLE;
                  const capacityLabel = CAPACITY_TYPE_LABELS[vehicle.capacityType] || vehicle.capacityType;
                  const amenities = (typeof vehicle.amenities === "object" && vehicle.amenities !== null)
                    ? (vehicle.amenities as any)
                    : {};

                  return (
                    <tr key={vehicle.id} className="hover:bg-slate-50/70 transition-colors">
                      {/* 차량번호 & 모델명 */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-xs shrink-0">
                            🚌
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 flex items-center gap-2">
                              <span>{vehicle.plateNumber}</span>
                              {vehicle.isMarketplaceVisible && (
                                <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-purple-50 text-purple-700 border border-purple-200 rounded">
                                  B2B 마켓 공개
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-400">
                              {vehicle.modelName || "차량 모델 미입력"}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* 연식 */}
                      <td className="px-4 py-3.5 font-medium text-slate-600">
                        {vehicle.manufactureYear ? `${vehicle.manufactureYear}년식` : "-"}
                      </td>

                      {/* 인승 / 등급 */}
                      <td className="px-4 py-3.5">
                        <div className="font-semibold text-slate-800">
                          {vehicle.capacity}인승
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {capacityLabel}
                        </div>
                      </td>

                      {/* 상태 */}
                      <td className="px-4 py-3.5">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border ${statusConf.badgeClass}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${statusConf.dotClass}`} />
                          {statusConf.label}
                        </span>
                      </td>

                      {/* 부가옵션 (와이파이, USB, 냉장고) */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {amenities.wifi && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-medium">
                              📶 와이파이
                            </span>
                          )}
                          {amenities.usb && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-medium">
                              🔌 USB 충전
                            </span>
                          )}
                          {amenities.fridge && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-cyan-50 text-cyan-700 border border-cyan-200 text-[10px] font-medium">
                              🧊 냉장고
                            </span>
                          )}
                          {!amenities.wifi && !amenities.usb && !amenities.fridge && (
                            <span className="text-[11px] text-slate-300">없음</span>
                          )}
                        </div>
                      </td>

                      {/* 액션 (수정 / 삭제) */}
                      <td className="px-4 py-3.5 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          {/* 수정 버튼 */}
                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(vehicle)}
                            className="px-2.5 py-1 text-xs font-semibold text-slate-700 hover:text-indigo-600 bg-slate-100 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-200 rounded-lg transition-colors"
                          >
                            수정
                          </button>

                          {/* 삭제 버튼 */}
                          <button
                            type="button"
                            onClick={() => handleDelete(vehicle)}
                            disabled={isDeleting === vehicle.id}
                            className="px-2.5 py-1 text-xs font-semibold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors disabled:opacity-50"
                          >
                            {isDeleting === vehicle.id ? "삭제중..." : "삭제"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 차량 등록/수정 모달 */}
      <VehicleFormModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedVehicle(null);
        }}
        initialData={selectedVehicle}
        onSuccess={() => {
          router.refresh();
        }}
      />
    </div>
  );
}
