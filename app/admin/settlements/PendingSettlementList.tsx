import React from "react";
import { connection } from "next/server";
import { prisma } from "@/lib/prisma";
import SettlementApprovalModal, {
  type PendingSettlementItemProps,
} from "./SettlementApprovalModal";

/**
 * 서버 컴포넌트 안전한 영수증 이미지 URL 배열 파서
 * ("use client" 모듈의 함수를 서버 컴포넌트에서 직접 호출하면 RSC 런타임 에러가 발생하므로 별도 분리)
 */
function parseReceiptImageArrayServer(raw: string | null | undefined): string[] {
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
 * 미정산 내역(PENDING_SETTLEMENT) 조회 및 승인 관리 서버 컴포넌트
 * 경로: app/admin/settlements/PendingSettlementList.tsx
 */
export default async function PendingSettlementList() {
  await connection();

  const pendingDispatches = await prisma.dispatch.findMany({
    where: {
      status: "PENDING_SETTLEMENT",
    },
    include: {
      route: {
        select: {
          name: true,
          clientName: true,
        },
      },
      routeMaster: {
        select: {
          name: true,
        },
      },
      assignments: {
        include: {
          driver: {
            select: {
              id: true,
              name: true,
            },
          },
          vehicle: {
            select: {
              plateNumber: true,
            },
          },
        },
      },
    },
    orderBy: {
      date: "desc",
    },
  });

  const serializedItems: PendingSettlementItemProps[] = pendingDispatches.map(
    (d) => {
      const primaryAssignment = d.assignments[0];
      return {
        dispatchId: d.id,
        date: d.date.toISOString().slice(0, 10),
        routeName: d.routeMaster?.name || d.route?.name || "일반 대절",
        clientName: d.route?.clientName || "일반 고객",
        driverName: primaryAssignment?.driver?.name || "미지정 기사",
        plateNumber: primaryAssignment?.vehicle?.plateNumber || "미배정",
        actualDistance: d.actualDistance ?? 0,
        actualTollFee: d.actualTollFee ?? 0,
        parkingFee: d.parkingFee ?? 0,
        receiptImageUrl: d.receiptImageUrl ?? null,
      };
    }
  );

  return (
    <section className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/60">
        <div className="flex items-center gap-2.5">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
          <h2 className="text-base font-extrabold text-slate-900 tracking-tight">
            기사 제출 정산 승인 대기 목록 (PENDING_SETTLEMENT)
          </h2>
        </div>
        <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 border border-amber-200 text-xs font-extrabold">
          대기 {serializedItems.length}건
        </span>
      </div>

      {serializedItems.length === 0 ? (
        <div className="p-10 text-center text-sm text-slate-400">
          현재 승인 대기 중인 일반 대절 미정산 건이 없습니다.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-100/80 text-slate-600 border-b border-slate-200 font-bold">
                <th className="py-3 px-4 whitespace-nowrap">운행일자</th>
                <th className="py-3 px-4 whitespace-nowrap">노선 / 단체명</th>
                <th className="py-3 px-4 whitespace-nowrap">운행 기사</th>
                <th className="py-3 px-4 whitespace-nowrap">차량번호</th>
                <th className="py-3 px-4 whitespace-nowrap text-right">
                  제출 주행거리
                </th>
                <th className="py-3 px-4 whitespace-nowrap text-center">
                  영수증 증빙
                </th>
                <th className="py-3 px-4 whitespace-nowrap text-center">
                  관리 액션
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/80 text-slate-700">
              {serializedItems.map((item) => (
                <tr
                  key={item.dispatchId}
                  className="hover:bg-slate-50/80 transition"
                >
                  <td className="py-3.5 px-4 font-mono font-semibold text-slate-900 whitespace-nowrap">
                    {item.date}
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="font-bold text-slate-900">
                      {item.routeName}
                    </div>
                    <div className="text-[11px] text-slate-400">
                      고객사: {item.clientName}
                    </div>
                  </td>
                  <td className="py-3.5 px-4 font-semibold whitespace-nowrap">
                    {item.driverName}
                  </td>
                  <td className="py-3.5 px-4 font-semibold text-slate-600 whitespace-nowrap">
                    {item.plateNumber}호
                  </td>
                  <td className="py-3.5 px-4 text-right font-extrabold text-blue-600 whitespace-nowrap">
                    {item.actualDistance > 0 ? (
                      `${item.actualDistance.toLocaleString("ko-KR")} km`
                    ) : (
                      <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 text-[11px] font-bold">
                        📷 사진 판독 필요
                      </span>
                    )}
                  </td>
                  <td className="py-3.5 px-4 text-center whitespace-nowrap">
                    {(() => {
                      const imgs = parseReceiptImageArrayServer(item.receiptImageUrl);
                      if (imgs.length > 0) {
                        return (
                          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 text-[11px] font-bold">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={imgs[0]}
                              alt="증빙 썸네일"
                              className="w-7 h-7 rounded object-cover border border-blue-200"
                            />
                            <span>사진 {imgs.length}장 확인</span>
                          </div>
                        );
                      }
                      if (item.receiptImageUrl) {
                        return (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200 text-[11px] font-bold">
                            📎 파일 첨부됨
                          </span>
                        );
                      }
                      return <span className="text-[11px] text-slate-400">미첨부</span>;
                    })()}
                  </td>
                  <td className="py-3.5 px-4 text-center whitespace-nowrap">
                    <SettlementApprovalModal item={item} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

