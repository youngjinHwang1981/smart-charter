"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/lib/auth";
import { z } from "zod";

// Zod 기반 엄격한 도메인 입력값 검증 스키마 (음수, 초과값, 비정상 용량 차단)
const approveSettlementSchema = z.object({
  dispatchId: z.string().min(1, "유효하지 않은 배차 ID입니다.").max(128),
  expenseData: z.object({
    actualDistance: z.coerce
      .number()
      .finite("유효한 숫자를 입력해 주세요.")
      .min(0, "주행거리는 0km 이상이어야 합니다.")
      .max(3000, "1회 운행 주행거리는 3,000km를 초과할 수 없습니다.")
      .optional(),
    actualTollFee: z.coerce
      .number()
      .int("통행료는 정수(원 단위)여야 합니다.")
      .min(0, "통행료는 0원 이상이어야 합니다.")
      .max(1_000_000, "1회 통행료는 100만 원을 초과할 수 없습니다.")
      .optional(),
    parkingFee: z.coerce
      .number()
      .int("주차비는 정수(원 단위)여야 합니다.")
      .min(0, "주차비는 0원 이상이어야 합니다.")
      .max(1_000_000, "1회 주차비/실비는 100만 원을 초과할 수 없습니다.")
      .optional(),
    receiptImageUrl: z
      .string()
      .max(6_000_000, "첨부 이미지 데이터 용량이 허용치(약 4.5MB)를 초과했습니다.")
      .nullable()
      .optional(),
  }),
});

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
 * 관리자 전용 세션 및 RBAC(Role-Based Access Control) 검증 헬퍼
 */
async function requireAdminSession() {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string } | undefined)?.role;

  if (!session?.user || role !== "ADMIN") {
    throw new Error("UNAUTHORIZED_ADMIN");
  }
  return session.user;
}

/**
 * 관리자 정산 승인 Server Action
 * - 관리자 세션 인가 검증 + Zod 수치/용량 검증 + 원자적 CAS(Compare-And-Swap) 트랜잭션으로
 *   더블 클릭 및 동시성(Race Condition) 중복 승인을 원천 차단합니다.
 */
export async function approvePendingSettlement(
  dispatchId: string,
  expenseData: ApproveSettlementInput
): Promise<ApproveSettlementResponse> {
  try {
    // 1. 관리자 세션 및 권한 검증 (미들웨어 우회 직접 POST 호출 방어)
    try {
      await requireAdminSession();
    } catch {
      return {
        success: false,
        error: "관리자 권한이 없거나 로그인 세션이 만료되었습니다.",
      };
    }

    // 2. 입력값 무결성 검증 (음수, 오버플로우, 초과 용량 방어)
    const parsed = approveSettlementSchema.safeParse({ dispatchId, expenseData });
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message || "입력값이 유효하지 않습니다.";
      return { success: false, error: firstError };
    }

    const validData = parsed.data.expenseData;

    // 3. 원자적 상태 전이 트랜잭션 (Compare-And-Swap 멱등성 보장)
    await prisma.$transaction(async (tx) => {
      const current = await tx.dispatch.findUnique({
        where: { id: dispatchId },
        select: {
          id: true,
          status: true,
          actualDistance: true,
          actualTollFee: true,
          parkingFee: true,
        },
      });

      if (!current) {
        throw new Error("NOT_FOUND");
      }

      if (current.status === "COMPLETED") {
        throw new Error("ALREADY_COMPLETED");
      }

      const finalDistance = validData.actualDistance ?? current.actualDistance ?? 0;
      const finalTollFee = validData.actualTollFee ?? current.actualTollFee ?? 0;
      const finalParkingFee = validData.parkingFee ?? current.parkingFee ?? 0;

      // status가 아직 COMPLETED가 아닌 경우에만 1건 원자적 업데이트
      const updated = await tx.dispatch.updateMany({
        where: {
          id: dispatchId,
          status: { not: "COMPLETED" },
        },
        data: {
          actualDistance: finalDistance,
          actualTollFee: finalTollFee,
          parkingFee: finalParkingFee,
          ...(validData.receiptImageUrl !== undefined
            ? { receiptImageUrl: validData.receiptImageUrl }
            : {}),
          status: "COMPLETED",
        },
      });

      if (updated.count === 0) {
        throw new Error("ALREADY_COMPLETED");
      }

      await tx.dispatchAssignment.updateMany({
        where: { dispatchId },
        data: {
          status: "COMPLETED",
        },
      });
    });

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
    if (err.message === "NOT_FOUND") {
      return { success: false, error: "해당 배차 내역을 찾을 수 없습니다." };
    }
    if (err.message === "ALREADY_COMPLETED") {
      return {
        success: false,
        error: "이미 최종 승인 완료된 배차입니다. (중복 처리 방지됨)",
      };
    }

    console.error("[approvePendingSettlement Error]:", err);
    return {
      success: false,
      error: err.message || "정산 승인 처리 중 오류가 발생했습니다.",
    };
  }
}

