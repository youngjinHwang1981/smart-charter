"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { z } from "zod";

// 영수증 이미지(단일 Data URL/경로 또는 최대 6장 JSON 배열) 검증 헬퍼
function isValidReceiptPayload(val: string | null | undefined): boolean {
  if (!val) return true;
  const trimmed = val.trim();
  if (
    trimmed.startsWith("data:image/") ||
    trimmed.startsWith("http") ||
    trimmed.startsWith("/")
  ) {
    return true;
  }
  if (trimmed.startsWith("[")) {
    try {
      const arr = JSON.parse(trimmed);
      return (
        Array.isArray(arr) &&
        arr.length <= 6 &&
        arr.every(
          (item) =>
            typeof item === "string" &&
            (item.startsWith("data:image/") ||
              item.startsWith("http") ||
              item.startsWith("/"))
        )
      );
    } catch {
      return false;
    }
  }
  return false;
}

const completeDispatchSchema = z.object({
  dispatchId: z.string().min(1, "유효하지 않은 배차 ID입니다.").max(128),
  driverId: z.string().min(1).max(128).optional(),
  manualInput: z
    .object({
      actualDistance: z.coerce
        .number()
        .finite("유효한 주행거리를 입력해 주세요.")
        .min(0, "주행거리는 0km 이상이어야 합니다.")
        .max(3000, "1회 운행 주행거리는 3,000km를 초과할 수 없습니다.")
        .optional(),
      actualTollFee: z.coerce
        .number()
        .int("통행료는 정수(원 단위)여야 합니다.")
        .min(0, "통행료는 0원 이상이어야 합니다.")
        .max(1_000_000, "통행료는 100만 원을 초과할 수 없습니다.")
        .optional(),
      receiptImageUrl: z
        .string()
        .max(6_000_000, "첨부 사진 용량이 허용치를 초과했습니다.")
        .refine(isValidReceiptPayload, "유효하지 않은 영수증 이미지 형식입니다.")
        .nullable()
        .optional(),
    })
    .optional(),
});

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
 * - 보안 강화: Zod 수치/용량 검증 + 배정 기사 소유권(IDOR) 검증 + 완료 건 재덮어쓰기 차단
 */
export async function completeDispatch(
  dispatchId: string,
  manualInput?: CompleteDispatchManualInput,
  driverId?: string
): Promise<CompleteDispatchResponse> {
  try {
    // 1. Zod 스키마 기반 입력값 검증
    const parsed = completeDispatchSchema.safeParse({
      dispatchId,
      driverId,
      manualInput,
    });

    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message || "입력값이 올바르지 않습니다.";
      return { success: false, error: firstError };
    }

    const validManual = parsed.data.manualInput;

    // 2. 배차 및 배정 기사(assignments), 노선 마스터(RouteMaster) 조회
    const dispatch = await prisma.dispatch.findUnique({
      where: { id: dispatchId },
      include: {
        assignments: {
          select: {
            driverId: true,
          },
        },
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

    // 3. 이미 최종 정산 승인 완료(COMPLETED)된 건은 기사가 재제출하여 덮어쓸 수 없도록 방어
    if (dispatch.status === "COMPLETED") {
      return {
        success: false,
        error: "이미 최종 정산이 완료된 운행 건은 변경할 수 없습니다.",
      };
    }

    // 4. 배차 소유권 검증 (driverId가 전달된 경우 본인 배차 여부 확인)
    if (driverId && dispatch.assignments.length > 0) {
      const isAssigned = dispatch.assignments.some((a) => a.driverId === driverId);
      if (!isAssigned) {
        return {
          success: false,
          error: "본인에게 배정된 운행 건만 종료 보고할 수 있습니다.",
        };
      }
    }

    const isCustomCharter =
      dispatch.routeType === "CUSTOM_CHARTER" ||
      (!dispatch.routeMasterId && dispatch.type !== "FIXED") ||
      validManual?.actualDistance !== undefined ||
      Boolean(validManual?.receiptImageUrl);
    const routeType = isCustomCharter ? "CUSTOM_CHARTER" : "FIXED_ROUTE";

    // 5-A. 고정 노선(FIXED_ROUTE): 노선 마스터 기준 자동 정산 완료 처리 (원자적 CAS 적용)
    if (routeType === "FIXED_ROUTE") {
      const expectedDistance = dispatch.routeMaster?.estimatedDistance ?? 0;
      const baseTollFee = dispatch.routeMaster?.defaultTollFee ?? 0;

      const updated = await prisma.$transaction(async (tx) => {
        const res = await tx.dispatch.updateMany({
          where: {
            id: dispatchId,
            status: { not: "COMPLETED" },
          },
          data: {
            actualDistance: expectedDistance,
            actualTollFee: baseTollFee,
            status: "COMPLETED",
          },
        });

        if (res.count === 0) return false;

        await tx.dispatchAssignment.updateMany({
          where: { dispatchId },
          data: { status: "COMPLETED" },
        });
        return true;
      });

      if (!updated) {
        return {
          success: false,
          error: "이미 정산 완료 처리된 운행 건입니다.",
        };
      }

      revalidatePath("/");
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

    // 5-B. 일반 대절(CUSTOM_CHARTER): 기사 수동 입력 또는 Camera-Only(사진 전용) 데이터 저장 및 정산 대기 처리
    const actualDistance = validManual?.actualDistance ?? 0;
    const actualTollFee = validManual?.actualTollFee ?? 0;
    const receiptImageUrl = validManual?.receiptImageUrl ?? null;

    // Camera-Only 지원: 사진이 첨부되었거나 주행거리가 0보다 크면 제출 허용
    if (actualDistance <= 0 && !receiptImageUrl) {
      return {
        success: false,
        error: "영수증/계기판 사진을 첨부하거나 실제 주행거리(km)를 입력해 주세요.",
      };
    }

    const updated = await prisma.$transaction(async (tx) => {
      const res = await tx.dispatch.updateMany({
        where: {
          id: dispatchId,
          status: { not: "COMPLETED" },
        },
        data: {
          actualDistance,
          actualTollFee,
          receiptImageUrl,
          status: "PENDING_SETTLEMENT",
        },
      });

      if (res.count === 0) return false;

      await tx.dispatchAssignment.updateMany({
        where: { dispatchId },
        data: { status: "PENDING_SETTLEMENT" },
      });
      return true;
    });

    if (!updated) {
      return {
        success: false,
        error: "이미 관리자가 정산 승인을 완료한 운행 건입니다.",
      };
    }

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

