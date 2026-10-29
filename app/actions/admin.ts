"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export interface ApproveSettlementInput {
  actualDistance?: number;
  actualTollFee?: number;
  parkingFee?: number;
  receiptImageUrl?: string | null;
}

export interface ApproveSettlementResponse {
  success: boolean;
  message?: string;
  error?: string;
}

/**
 * 관리자 정산 승인 Server Action
 * - 기사가 제출한 PENDING_SETTLEMENT 상태의 배차를 검토 후
 *   실비(톨게이트비 actualTollFee, 주차비 parkingFee, 확정 주행거리 actualDistance)를 반영하고
 *   상태를 'COMPLETED'로 최종 승인 처리합니다.
 */
export async function approvePendingSettlement(
  dispatchId: string,
  expenseData: ApproveSettlementInput
): Promise<ApproveSettlementResponse> {
  try {
    if (!dispatchId) {
      return { success: false, error: "유효하지 않은 배차 ID입니다." };
    }

    const dispatch = await prisma.dispatch.findUnique({
      where: { id: dispatchId },
      select: {
        id: true,
        actualDistance: true,
        actualTollFee: true,
        parkingFee: true,
      },
    });

    if (!dispatch) {
      return { success: false, error: "해당 배차 내역을 찾을 수 없습니다." };
    }

    const finalDistance =
      expenseData.actualDistance !== undefined && !isNaN(Number(expenseData.actualDistance))
        ? Number(expenseData.actualDistance)
        : dispatch.actualDistance ?? 0;

    const finalTollFee =
      expenseData.actualTollFee !== undefined && !isNaN(Number(expenseData.actualTollFee))
        ? Number(expenseData.actualTollFee)
        : dispatch.actualTollFee ?? 0;

    const finalParkingFee =
      expenseData.parkingFee !== undefined && !isNaN(Number(expenseData.parkingFee))
        ? Number(expenseData.parkingFee)
        : dispatch.parkingFee ?? 0;

    await prisma.$transaction([
      prisma.dispatch.update({
        where: { id: dispatchId },
        data: {
          actualDistance: finalDistance,
          actualTollFee: finalTollFee,
          parkingFee: finalParkingFee,
          ...(expenseData.receiptImageUrl !== undefined
            ? { receiptImageUrl: expenseData.receiptImageUrl }
            : {}),
          status: "COMPLETED",
        },
      }),
      prisma.dispatchAssignment.updateMany({
        where: { dispatchId },
        data: {
          status: "COMPLETED",
        },
      }),
    ]);

    revalidatePath("/");
    revalidatePath("/admin/settlements");
    revalidatePath("/settlement");
    revalidatePath("/schedule");
    revalidatePath("/driver/[driverId]", "page");

    return {
      success: true,
      message: "최종 정산 승인이 완료되었습니다.",
    };
  } catch (err: any) {
    console.error("[approvePendingSettlement Error]:", err);
    return {
      success: false,
      error: err.message || "정산 승인 처리 중 오류가 발생했습니다.",
    };
  }
}

