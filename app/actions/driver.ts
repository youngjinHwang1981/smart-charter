"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export interface CompleteDispatchManualInput {
  actualDistance?: number;
  actualTollFee?: number;
  receiptImageUrl?: string | null;
}

export interface CompleteDispatchResponse {
  success: boolean;
  status?: "COMPLETED" | "PENDING_SETTLEMENT";
  message?: string;
  error?: string;
}

/**
 * 기사 운행 종료 및 투 트랙(Two-Track) 자동 정산 Server Action
 * - FIXED_ROUTE (고정 노선): 연결된 RouteMaster의 estimatedDistance, defaultTollFee를
 *   Dispatch의 actualDistance, actualTollFee에 자동 반영하고 상태를 'COMPLETED'로 변경
 * - CUSTOM_CHARTER (일반 대절): 기사가 입력한 실제 주행거리(actualDistance), 통행료, 영수증 사진 URL을
 *   저장하고 상태를 'PENDING_SETTLEMENT'(정산 대기)로 변경
 */
export async function completeDispatch(
  dispatchId: string,
  manualInput?: CompleteDispatchManualInput
): Promise<CompleteDispatchResponse> {
  try {
    if (!dispatchId) {
      return { success: false, error: "유효하지 않은 배차 ID입니다." };
    }

    // 1. 배차 및 연결된 노선 마스터(RouteMaster) 조회
    const dispatch = await prisma.dispatch.findUnique({
      where: { id: dispatchId },
      include: {
        routeMaster: {
          select: {
            id: true,
            name: true,
            estimatedDistance: true,
            defaultTollFee: true,
          },
        },
      },
    });

    if (!dispatch) {
      return { success: false, error: "배차 내역을 찾을 수 없습니다." };
    }

    const isCustomCharter =
      dispatch.routeType === "CUSTOM_CHARTER" ||
      (!dispatch.routeMasterId && dispatch.type !== "FIXED") ||
      manualInput?.actualDistance !== undefined ||
      Boolean(manualInput?.receiptImageUrl);
    const routeType = isCustomCharter ? "CUSTOM_CHARTER" : "FIXED_ROUTE";

    // 2-A. 고정 노선(FIXED_ROUTE): 노선 마스터 기준 자동 정산 완료 처리
    if (routeType === "FIXED_ROUTE") {
      const expectedDistance = dispatch.routeMaster?.estimatedDistance ?? 0;
      const baseTollFee = dispatch.routeMaster?.defaultTollFee ?? 0;

      await prisma.$transaction([
        prisma.dispatch.update({
          where: { id: dispatchId },
          data: {
            actualDistance: expectedDistance,
            actualTollFee: baseTollFee,
            status: "COMPLETED",
          },
        }),
        prisma.dispatchAssignment.updateMany({
          where: { dispatchId },
          data: { status: "COMPLETED" },
        }),
      ]);

      revalidatePath("/driver/[driverId]", "page");
      revalidatePath("/schedule");
      revalidatePath("/settlement");
      revalidatePath("/admin/settlements");

      return {
        success: true,
        status: "COMPLETED",
        message: `고정 노선 자동 정산 완료 (${expectedDistance}km / 통행료 ${baseTollFee.toLocaleString()}원)`,
      };
    }

    // 2-B. 일반 대절(CUSTOM_CHARTER): 기사 수동 입력 또는 Camera-Only(사진 전용) 데이터 저장 및 정산 대기 처리
    const rawDistance =
      manualInput?.actualDistance !== undefined && manualInput?.actualDistance !== null
        ? Number(manualInput.actualDistance)
        : 0;
    const actualDistance = isNaN(rawDistance) || rawDistance < 0 ? 0 : rawDistance;
    const actualTollFee =
      manualInput?.actualTollFee !== undefined
        ? Number(manualInput.actualTollFee)
        : 0;
    const receiptImageUrl = manualInput?.receiptImageUrl ?? null;

    // Camera-Only 지원: 사진이 첨부되었거나 주행거리가 0보다 크면 제출 허용
    if (actualDistance <= 0 && !receiptImageUrl) {
      return {
        success: false,
        error: "영수증/계기판 사진을 첨부하거나 실제 주행거리(km)를 입력해 주세요.",
      };
    }

    await prisma.$transaction([
      prisma.dispatch.update({
        where: { id: dispatchId },
        data: {
          actualDistance,
          actualTollFee: isNaN(actualTollFee) ? 0 : actualTollFee,
          receiptImageUrl,
          status: "PENDING_SETTLEMENT",
        },
      }),
      prisma.dispatchAssignment.updateMany({
        where: { dispatchId },
        data: { status: "PENDING_SETTLEMENT" },
      }),
    ]);

    revalidatePath("/");
    revalidatePath("/driver/[driverId]", "page");
    revalidatePath("/schedule");
    revalidatePath("/settlement");
    revalidatePath("/admin/settlements");

    return {
      success: true,
      status: "PENDING_SETTLEMENT",
      message: "운행 종료 및 영수증 증빙이 제출되었습니다. (관리자 정산 대기)",
    };
  } catch (err: any) {
    console.error("[completeDispatch Error]:", err);
    return {
      success: false,
      error: err.message || "운행 종료 처리 중 오류가 발생했습니다.",
    };
  }
}

