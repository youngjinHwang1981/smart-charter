"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { AgGridReact } from "ag-grid-react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin, { type DateClickArg } from "@fullcalendar/interaction";
import type { EventClickArg, EventContentArg, EventInput } from "@fullcalendar/core";
import koLocale from "@fullcalendar/core/locales/ko";
import { AllCommunityModule, ModuleRegistry } from "ag-grid-community";
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-quartz.css";
import Navbar from "../components/Navbar";
import { getDispatchSchedule, updateDispatchRecord } from "../actions";
import {
  createDispatch,
  getCalendarDispatches,
  getScheduleMasterData,
  type CalendarDispatch,
  type DispatchType,
} from "./actions";
import DispatchEditModal from "./DispatchEditModal";

// AG Grid v32+ 필수 모듈 등록 (셀 편집, 필터 등 활성화)
ModuleRegistry.registerModules([AllCommunityModule]);

interface RouteOption {
  id: string;
  name: string;
  clientName: string;
}

interface DriverOption {
  id: string;
  name: string;
  employmentType: string;
}

interface VehicleOption {
  id: string;
  plateNumber: string;
  capacity: number;
}

type ViewMode = "calendar" | "grid";

// 배차 구분별 카드 스타일 (고정 / 일반 노선 식별용)
const DISPATCH_TYPE_STYLE: Record<DispatchType, { label: string; bg: string; border: string }> = {
  FIXED: { label: "고정", bg: "#4f46e5", border: "#4338ca" }, // indigo
  NORMAL: { label: "일반", bg: "#d97706", border: "#b45309" }, // amber
};

// FullCalendar eventContent: 배차 카드 커스텀 렌더링
function DispatchCard({ arg }: { arg: EventContentArg }) {
  const d = arg.event.extendedProps.dispatch as CalendarDispatch;
  const style = DISPATCH_TYPE_STYLE[d.type];
  const unassigned = !d.driverName || !d.plateNumber;

  return (
    <div className="w-full px-2 py-1.5 text-white leading-tight whitespace-normal overflow-hidden">
      {/* 좌측 상단: 고정/일반 뱃지 */}
      <div className="flex items-center justify-between gap-1">
        <span className="inline-flex items-center px-1.5 py-px rounded-md bg-white/25 ring-1 ring-white/30 text-[10px] font-extrabold tracking-wide">
          {style.label}
        </span>
        {unassigned && (
          <span className="px-1.5 py-px rounded-md bg-rose-500/90 text-[9.5px] font-bold">미배정</span>
        )}
      </div>

      {/* 중앙: 노선명 */}
      <div className="mt-1 text-[12px] font-bold truncate" title={`${d.routeName} (${d.clientName})`}>
        {d.routeName}
      </div>

      {/* 하단: 기사명 및 차량번호 */}
      <div className="mt-0.5 flex items-center gap-1.5 text-[10.5px] font-medium text-white/85 truncate">
        <span className="truncate">👤 {d.driverName ?? "—"}</span>
        <span className="opacity-60">|</span>
        <span className="truncate">🚌 {d.plateNumber ?? "—"}</span>
      </div>
    </div>
  );
}

export default function DispatchSchedulerPage() {
  // 화면 렌더링 모드: 캘린더 뷰 / 대량 수정(그리드) 뷰
  const [viewMode, setViewMode] = useState<ViewMode>("calendar");
  const [rowData, setRowData] = useState<any[]>([]);
  // 캘린더용 Dispatch 원본 데이터 (1건 = 카드 1장)
  const [calendarDispatches, setCalendarDispatches] = useState<CalendarDispatch[]>([]);
  // 카드 클릭 시 수정 모달 대상
  const [editTarget, setEditTarget] = useState<CalendarDispatch | null>(null);
  const [columnDefs, setColumnDefs] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // 모달 제어 및 마스터 데이터 상태
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [routes, setRoutes] = useState<RouteOption[]>([]);
  const [drivers, setDrivers] = useState<DriverOption[]>([]);
  const [vehicles, setVehicles] = useState<VehicleOption[]>([]);
  const [loadingMaster, setLoadingMaster] = useState<boolean>(false);

  // 모달 폼 필드 상태
  const [formDate, setFormDate] = useState<string>("");
  const [formRouteId, setFormRouteId] = useState<string>("");
  const [formDriverId, setFormDriverId] = useState<string>("");
  const [formVehicleId, setFormVehicleId] = useState<string>("");
  const [formType, setFormType] = useState<DispatchType>("FIXED");
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // 토스트 알림 상태
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // 오늘 날짜 문자열 반환 (YYYY-MM-DD)
  const getTodayString = () => {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, "0");
    const d = String(today.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  };

  // DB 데이터 Fetch 및 전체 노선 일자 컬럼 동적 생성
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [data, dispatchList] = await Promise.all([getDispatchSchedule(), getCalendarDispatches()]);
      setRowData(data);
      setCalendarDispatches(dispatchList);

      if (data.length > 0) {
        const baseCols = [
          { field: "route", headerName: "호차 및 노선명", pinned: "left", width: 230 },
          { field: "client", headerName: "발주처", pinned: "left", width: 110 },
        ];

        // 모든 노선의 데이터 키를 순회하여 존재하는 모든 날짜 컬럼을 수집
        const dateKeySet = new Set<string>();
        data.forEach((row) => {
          Object.keys(row).forEach((key) => {
            if (key !== "routeId" && key !== "route" && key !== "client") {
              dateKeySet.add(key);
            }
          });
        });

        const dateKeys = Array.from(dateKeySet).sort();

        const dateCols = dateKeys.map((date) => ({
          field: date,
          headerName: date.substring(5), // "MM-DD" 형태로 헤더 표시
          editable: true,
          cellEditor: "agTextCellEditor",
          width: 140,
        }));

        setColumnDefs([...baseCols, ...dateCols]);
      }
    } catch (err) {
      console.error("배차 데이터 로드 실패:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  // 마스터 데이터(노선, 기사, 차량 목록) 로드
  const loadMasterData = async () => {
    try {
      setLoadingMaster(true);
      const res = await getScheduleMasterData();
      setRoutes(res.routes);
      setDrivers(res.drivers);
      setVehicles(res.vehicles);
    } catch (err) {
      console.error("마스터 데이터 조회 실패:", err);
    } finally {
      setLoadingMaster(false);
    }
  };

  // 초기 로드
  useEffect(() => {
    loadData();
    loadMasterData();
    setFormDate(getTodayString());
  }, [loadData]);

  // 셀 편집 시 서버 업데이트 전송
  const onCellValueChanged = async (params: any) => {
    const routeId = params.data.routeId;
    const dateField = params.colDef.field;
    const newDriverName = params.newValue;

    const result = await updateDispatchRecord(routeId, dateField, newDriverName);
    if (result.success) {
      setToastMessage(`${dateField} 배차 정보가 업데이트되었습니다.`);
      setTimeout(() => setToastMessage(null), 3000);
      // 그리드 수정 내용을 캘린더 데이터에도 반영
      getCalendarDispatches().then(setCalendarDispatches).catch(console.error);
    }
  };

  // 모달 열기 핸들러 (캘린더 날짜 클릭 시 해당 일자 프리셋)
  const handleOpenModal = (presetDate?: string) => {
    setModalError(null);
    if (presetDate) setFormDate(presetDate);
    else if (!formDate) setFormDate(getTodayString());
    setIsModalOpen(true);
  };

  // 서버 Dispatch 데이터 → FullCalendar events 배열 매핑
  const calendarEvents = useMemo<EventInput[]>(
    () =>
      calendarDispatches.map((d) => {
        const style = DISPATCH_TYPE_STYLE[d.type];
        return {
          id: d.id,
          title: d.routeName,
          start: d.date,
          allDay: true,
          backgroundColor: style.bg,
          borderColor: style.border,
          textColor: "#ffffff",
          // 고정 노선 우선 정렬용
          extendedProps: { dispatch: d, typeOrder: d.type === "FIXED" ? 0 : 1 },
        };
      }),
    [calendarDispatches]
  );

  const handleDateClick = (arg: DateClickArg) => {
    handleOpenModal(arg.dateStr.substring(0, 10));
  };

  // 배차 카드 클릭 → 상세 수정 모달 오픈
  const handleEventClick = (arg: EventClickArg) => {
    arg.jsEvent.preventDefault();
    setEditTarget(arg.event.extendedProps.dispatch as CalendarDispatch);
  };

  // 수정/삭제 완료 후 공통 처리
  const handleEditSaved = async (message: string) => {
    setEditTarget(null);
    setToastMessage(message);
    setTimeout(() => setToastMessage(null), 3000);
    await loadData();
  };

  // 신규 배차 등록 서브밋 핸들러
  const handleSubmitDispatch = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);

    if (!formDate || !formRouteId) {
      setModalError("배차 일자와 노선은 필수 입력 항목입니다.");
      return;
    }

    try {
      setSubmitting(true);
      const res = await createDispatch({
        date: formDate,
        routeId: formRouteId,
        driverId: formDriverId,
        vehicleId: formVehicleId,
        type: formType,
      });

      if (!res.success) {
        setModalError(res.error || "배차 등록에 실패했습니다.");
        return;
      }

      // 등록 성공 시 팝업 닫기 및 폼 초기화
      setIsModalOpen(false);
      setFormRouteId("");
      setFormDriverId("");
      setFormVehicleId("");

      setToastMessage("🎉 신규 배차가 성공적으로 등록되었습니다!");
      setTimeout(() => setToastMessage(null), 3500);

      // AG Grid 실시간 데이터 동기화
      await loadData();
    } catch (err: any) {
      console.error("신규 배차 등록 에러:", err);
      setModalError("배차 등록 중 통신 오류가 발생했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  // 고용 형태 라벨 매핑
  const formatEmploymentType = (type: string) => {
    switch (type) {
      case "OWN":
        return "직영";
      case "AFFILIATED":
        return "지입";
      case "OUTSOURCED":
        return "용차";
      default:
        return type;
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-gray-800">
      {/* 1. 상단 글로벌 네비게이션 바 */}
      <Navbar />

      <main className="p-6 flex-1 flex flex-col max-w-7xl w-full mx-auto">
        {/* 토스트 성공 알림 */}
        {toastMessage && (
          <div className="fixed bottom-6 right-6 z-50 bg-gray-900/95 backdrop-blur-sm text-white px-5 py-3 rounded-2xl shadow-xl flex items-center gap-3 text-sm font-semibold border border-gray-700 animate-fade-in">
            <span>✨</span>
            <span>{toastMessage}</span>
          </div>
        )}

        {/* 2. 헤더 안내 및 액션 제어부 (모바일: flex-col, 데스크탑: flex-row) */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center pb-4 border-b border-gray-200 mb-6 gap-4">
          <div>
            <div className="flex items-center gap-3">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
                배차 관리
              </span>
              <h1 className="text-xl md:text-2xl font-bold text-gray-900">전세버스 일일 배차 스케줄러</h1>
            </div>
            <p className="text-xs md:text-sm text-gray-500 mt-1">
              신규 배차를 등록하거나, 셀을 더블 클릭하여 기사 및 차량을 실시간으로 배정 수정할 수 있습니다.
            </p>
          </div>

          {/* 버튼 컨트롤 패널 (모바일: flex-col, 데스크탑: flex-row gap-2) */}
          <div className="flex flex-col md:flex-row gap-2 w-full md:w-auto">
            {/* [+ 신규 배차 등록] 버튼 */}
            <button
              type="button"
              onClick={() => handleOpenModal()}
              className="px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-sm font-bold rounded-xl shadow-md shadow-blue-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer transform active:scale-95 w-full md:w-auto"
            >
              <span className="text-base font-black leading-none">＋</span>
              <span>신규 배차 등록</span>
            </button>

            <Link
              href="/settlement"
              className="px-3.5 py-2 border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 text-sm font-semibold rounded-xl shadow-2xs transition flex items-center justify-center gap-1.5 w-full md:w-auto"
            >
              <span>📊</span>
              <span>월간 정산</span>
            </Link>
            <Link
              href="/payroll"
              className="px-3.5 py-2 border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 text-sm font-semibold rounded-xl shadow-2xs transition flex items-center justify-center gap-1.5 w-full md:w-auto"
            >
              <span>👨‍✈️</span>
              <span>기사 급여</span>
            </Link>
          </div>
        </div>

        {/* 3. 뷰 전환 토글 ([캘린더 뷰] / [대량 수정 뷰]) */}
        <div className="mb-4 inline-flex p-1 bg-gray-200/70 rounded-xl" role="tablist" aria-label="배차 화면 전환">
          {([
            { key: "calendar", label: "🗓️ 캘린더 뷰" },
            { key: "grid", label: "📋 대량 수정 뷰" },
          ] as const).map((tab) => (
            <button
              key={tab.key}
              id={`view-toggle-${tab.key}`}
              type="button"
              role="tab"
              aria-selected={viewMode === tab.key}
              onClick={() => setViewMode(tab.key)}
              className={`px-4 py-2 text-xs md:text-sm font-bold rounded-lg transition-all cursor-pointer ${
                viewMode === tab.key
                  ? "bg-white text-blue-700 shadow-sm"
                  : "text-gray-500 hover:text-gray-800"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* 4. 배차 스케줄러 본문 (viewMode에 따른 조건부 렌더링) */}
        <div className="flex-1 flex flex-col bg-white border border-gray-300 rounded-2xl shadow-sm overflow-hidden min-h-[550px]">
          <div className="px-4 md:px-5 py-3.5 border-b border-gray-200 flex flex-col md:flex-row md:items-center justify-between bg-gray-50/80 gap-2">
            <h2 className="text-sm font-bold text-gray-800 flex items-center gap-2">
              <span>{viewMode === "calendar" ? "🗓️ 월간 배차 캘린더" : "📅 노선별 일일 배차 현황"}</span>
              <span className="text-xs font-medium text-gray-500 bg-gray-200/60 px-2 py-0.5 rounded-full">
                {rowData.length}개 노선
              </span>
            </h2>
            <div className="flex flex-col md:flex-row items-start md:items-center gap-2 md:gap-3 text-xs text-gray-500">
              {viewMode === "calendar" && (
                <span className="flex items-center gap-2 text-gray-600 font-semibold">
                  {(Object.keys(DISPATCH_TYPE_STYLE) as DispatchType[]).map((t) => (
                    <span key={t} className="flex items-center gap-1">
                      <span
                        className="w-2.5 h-2.5 rounded-sm"
                        style={{ backgroundColor: DISPATCH_TYPE_STYLE[t].bg }}
                      />
                      {DISPATCH_TYPE_STYLE[t].label}
                    </span>
                  ))}
                </span>
              )}
              <span className="flex items-center gap-1">
                <span>💡</span>
                <span>
                  {viewMode === "calendar"
                    ? "카드 클릭 시 상세 수정 · 빈 날짜 클릭 시 신규 등록"
                    : "날짜 셀 더블 클릭 시 기사(차량) 수정 가능"}
                </span>
              </span>
            </div>
          </div>

          {/* 캘린더 및 테이블 부모 컨테이너: overflow-x-auto whitespace-nowrap 적용으로 모바일 세로 텍스트 깨짐 방지 및 가로 스크롤 보장 */}
          {viewMode === "calendar" ? (
            <div className="p-2 md:p-4 schedule-calendar overflow-x-auto whitespace-nowrap">
              <div className="min-w-[720px]">
                {loading && calendarDispatches.length === 0 ? (
                  <div className="h-[600px] flex items-center justify-center text-sm text-gray-500">
                    배차 스케줄 데이터를 불러오는 중입니다...
                  </div>
                ) : (
                  <FullCalendar
                    plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
                    initialView="dayGridMonth"
                    locale={koLocale}
                    height="auto"
                    headerToolbar={{
                      left: "prev,next today",
                      center: "title",
                      right: "dayGridMonth,timeGridWeek,timeGridDay",
                    }}
                    buttonText={{ today: "오늘", month: "월", week: "주", day: "일" }}
                    events={calendarEvents}
                    eventContent={(arg) => <DispatchCard arg={arg} />}
                    eventOrder="typeOrder,title"
                    eventDisplay="block"
                    dayMaxEvents={3}
                    moreLinkText={(n) => `+${n}건 더보기`}
                    dateClick={handleDateClick}
                    eventClick={handleEventClick}
                  />
                )}
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto whitespace-nowrap">
              <div className="ag-theme-quartz w-full min-w-[720px] h-[600px]">
                <AgGridReact
                  modules={[AllCommunityModule]}
                  rowData={rowData}
                  columnDefs={columnDefs}
                  onCellValueChanged={onCellValueChanged}
                  stopEditingWhenCellsLoseFocus={true}
                  defaultColDef={{
                    sortable: false,
                    filter: true,
                    resizable: true,
                    minWidth: 140,
                  }}
                  overlayLoadingTemplate={`<span class="p-4 text-gray-500 text-sm font-medium">배차 스케줄 데이터를 불러오는 중입니다...</span>`}
                />
              </div>
            </div>
          )}
        </div>
      </main>

      {/* 5. 배차 카드 상세 수정 모달 */}
      {editTarget && (
        <DispatchEditModal
          key={editTarget.id}
          dispatch={editTarget}
          routeOptions={routes.map((r) => ({ id: r.id, label: `${r.name} (${r.clientName})` }))}
          driverOptions={drivers.map((d) => ({
            id: d.id,
            label: `${d.name} (${formatEmploymentType(d.employmentType)})`,
          }))}
          vehicleOptions={vehicles.map((v) => ({ id: v.id, label: `${v.plateNumber}호 (${v.capacity}인승)` }))}
          onClose={() => setEditTarget(null)}
          onSaved={handleEditSaved}
        />
      )}

      {/* 6. 신규 배차 등록 모달 팝업 */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget && !submitting) {
              setIsModalOpen(false);
            }
          }}
        >
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-gray-100 overflow-hidden transform transition-all animate-scale-up">
            {/* 모달 상단 헤더 */}
            <div className="px-6 py-5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="text-2xl">🚌</span>
                <div>
                  <h3 className="text-lg font-extrabold tracking-tight">신규 배차 등록</h3>
                  <p className="text-xs text-blue-100 mt-0.5">
                    운행 일자, 노선, 담당 기사 및 차량을 선택하여 스케줄을 배정합니다.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => !submitting && setIsModalOpen(false)}
                className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white text-sm font-bold transition cursor-pointer"
                aria-label="닫기"
              >
                ✕
              </button>
            </div>

            {/* 모달 본문 폼 */}
            <form onSubmit={handleSubmitDispatch} className="p-6 space-y-4">
              {/* 에러 메시지 안내 */}
              {modalError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-semibold flex items-center gap-2">
                  <span>⚠️</span>
                  <span>{modalError}</span>
                </div>
              )}

              {/* 0. 배차 구분 (고정/일반) */}
              <div>
                <span className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wider">
                  배차 구분
                </span>
                <div className="grid grid-cols-2 gap-2">
                  {(
                    [
                      { key: "FIXED", label: "📌 고정 노선", active: "bg-indigo-600 text-white border-indigo-600" },
                      { key: "NORMAL", label: "🚌 일반 노선", active: "bg-amber-500 text-white border-amber-500" },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.key}
                      id={`create-type-${opt.key.toLowerCase()}`}
                      type="button"
                      onClick={() => setFormType(opt.key)}
                      className={`py-2.5 rounded-xl border text-sm font-bold transition cursor-pointer ${
                        formType === opt.key ? opt.active : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 1. 배차 일자 선택 */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wider">
                  배차 일자 <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={formDate}
                  onChange={(e) => setFormDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm font-medium text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                />
              </div>

              {/* 2. 노선 선택 */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wider">
                  운행 노선 <span className="text-rose-500">*</span>
                </label>
                <select
                  required
                  value={formRouteId}
                  onChange={(e) => setFormRouteId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm font-medium text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                >
                  <option value="">노선을 선택해 주세요</option>
                  {routes.map((route) => (
                    <option key={route.id} value={route.id}>
                      {route.name} ({route.clientName})
                    </option>
                  ))}
                </select>
                {routes.length === 0 && !loadingMaster && (
                  <p className="text-[11px] text-gray-400 mt-1">등록된 노선 데이터가 없습니다.</p>
                )}
              </div>

              {/* 3. 기사 선택 */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wider">
                  담당 기사 <span className="text-gray-400 font-normal">(선택)</span>
                </label>
                <select
                  value={formDriverId}
                  onChange={(e) => setFormDriverId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm font-medium text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                >
                  <option value="">기사를 선택해 주세요 (미배정 가능)</option>
                  {drivers.map((driver) => (
                    <option key={driver.id} value={driver.id}>
                      {driver.name} ({formatEmploymentType(driver.employmentType)})
                    </option>
                  ))}
                </select>
              </div>

              {/* 4. 차량 선택 */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wider">
                  배차 차량 <span className="text-gray-400 font-normal">(선택)</span>
                </label>
                <select
                  value={formVehicleId}
                  onChange={(e) => setFormVehicleId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm font-medium text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                >
                  <option value="">차량을 선택해 주세요 (미배정 가능)</option>
                  {vehicles.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.plateNumber}호 ({v.capacity}인승)
                    </option>
                  ))}
                </select>
              </div>

              {/* 모달 하단 버튼 제어부 (모바일: flex-col, 데스크탑: flex-row gap-2) */}
              <div className="pt-4 border-t border-gray-100 flex flex-col md:flex-row items-stretch md:items-center justify-end gap-2">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 border border-gray-300 text-gray-700 hover:bg-gray-50 rounded-xl text-sm font-semibold transition cursor-pointer justify-center"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-sm font-bold shadow-md shadow-blue-500/20 transition cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {submitting ? (
                    <>
                      <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                      </svg>
                      <span>등록 처리 중...</span>
                    </>
                  ) : (
                    <span>배차 등록하기</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
