"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { CapacityType, VehicleStatus } from "@prisma/client";
import { z } from "zod";

// Zod 검증 스키마 (use server 파일에서는 객체 export 금지, async function만 허용)
const vehicleInputSchema = z.object({
  plateNumber: z
    .string()
    .min(2, "차량번호를 최소 2자 이상 입력해 주세요.")
    .max(20, "차량번호는 20자 이하여야 합니다.")
    .trim(),
  capacity: z.coerce.number().min(1, "인승(탑승 인원)은 최소 1명 이상이어야 합니다."),
  capacityType: z.nativeEnum(CapacityType),
  modelName: z.string().trim().optional(),
  manufactureYear: z.coerce
    .number()
    .min(1990, "1990년 이후 연식을 입력해 주세요.")
    .max(new Date().getFullYear() + 2, "유효한 연식을 입력해 주세요.")
    .optional()
    .nullable(),
  status: z.nativeEnum(VehicleStatus).default(VehicleStatus.AVAILABLE),
  amenities: z
    .object({
      wifi: z.boolean().default(false),
      usb: z.boolean().default(false),
      fridge: z.boolean().default(false),
    })
    .default({ wifi: false, usb: false, fridge: false }),
  isMarketplaceVisible: z.boolean().default(false),
  dailyRentalPrice: z.coerce.number().optional().nullable(),
  mileage: z.coerce.number().optional().nullable(),
});

export type VehicleInput = z.infer<typeof vehicleInputSchema>;

export type ActionResponse<T = any> = {
  success: boolean;
  data?: T;
  error?: string;
};

/**
 * 1. 차량 목록 조회 (GET)
 */
export async function getVehicles(): Promise<ActionResponse<any[]>> {
  try {
    const vehicles = await prisma.vehicle.findMany({
      include: {
        company: {
          select: {
            id: true,
            name: true,
          },
        },
        _count: {
          select: {
            assignments: true,
          },
        },
      },
      orderBy: [
        { status: "asc" },
        { createdAt: "desc" },
      ],
    });

    return {
      success: true,
      data: vehicles,
    };
  } catch (err: any) {
    console.error("[getVehicles Error]:", err);
    return {
      success: false,
      error: "차량 목록을 불러오는 중 오류가 발생했습니다.",
    };
  }
}

/**
 * 2. 신규 차량 등록 (POST)
 * - plateNumber 중복 검사 로직 포함
 */
export async function createVehicle(rawInput: VehicleInput): Promise<ActionResponse> {
  try {
    // 1) Zod 입력값 검증
    const parsed = vehicleInputSchema.safeParse(rawInput);
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message || "입력값이 올바르지 않습니다.";
      return { success: false, error: firstError };
    }

    const data = parsed.data;

    // 2) 소속 회사(Company) 확인 - 시스템 기본 회사 또는 첫 번째 회사 자동 연동
    let company = await prisma.company.findFirst();
    if (!company) {
      company = await prisma.company.create({
        data: {
          name: "스마트투어 본사",
        },
      });
    }

    // 3) 차량번호(plateNumber) 중복 검사
    const existingVehicle = await prisma.vehicle.findFirst({
      where: {
        plateNumber: data.plateNumber,
        companyId: company.id,
      },
    });

    if (existingVehicle) {
      return {
        success: false,
        error: `이미 등록된 차량번호입니다: [${data.plateNumber}]`,
      };
    }

    // 4) 신규 차량 생성
    const newVehicle = await prisma.vehicle.create({
      data: {
        companyId: company.id,
        plateNumber: data.plateNumber,
        capacity: data.capacity,
        capacityType: data.capacityType,
        modelName: data.modelName || null,
        manufactureYear: data.manufactureYear || null,
        status: data.status,
        amenities: data.amenities,
        isMarketplaceVisible: data.isMarketplaceVisible,
        dailyRentalPrice: data.dailyRentalPrice || null,
        mileage: data.mileage || null,
      },
    });

    // 5) 화면 캐시 갱신
    revalidatePath("/admin/vehicles");

    return {
      success: true,
      data: newVehicle,
    };
  } catch (err: any) {
    console.error("[createVehicle Error]:", err);
    if (err.code === "P2002") {
      return {
        success: false,
        error: `동일한 차량번호가 이미 존재합니다.`,
      };
    }
    return {
      success: false,
      error: err.message || "차량 등록에 실패했습니다.",
    };
  }
}

/**
 * 3. 차량 정보 수정 (PATCH)
 * - 수정 시에도 본인을 제외한 plateNumber 중복 검사 수행
 */
export async function updateVehicle(
  id: string,
  rawInput: Partial<VehicleInput>
): Promise<ActionResponse> {
  try {
    if (!id) {
      return { success: false, error: "차량 ID가 필요합니다." };
    }

    // 기존 차량 조회
    const current = await prisma.vehicle.findUnique({
      where: { id },
    });
    if (!current) {
      return { success: false, error: "수정하려는 차량을 찾을 수 없습니다." };
    }

    // 1) Zod 부분 검증
    const parsed = vehicleInputSchema.partial().safeParse(rawInput);
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message || "입력값이 올바르지 않습니다.";
      return { success: false, error: firstError };
    }

    const data = parsed.data;

    // 2) 차량번호가 변경되는 경우 중복 검사 (본인 제외)
    if (data.plateNumber && data.plateNumber !== current.plateNumber) {
      const duplicate = await prisma.vehicle.findFirst({
        where: {
          plateNumber: data.plateNumber,
          companyId: current.companyId,
          NOT: { id },
        },
      });

      if (duplicate) {
        return {
          success: false,
          error: `이미 사용 중인 차량번호입니다: [${data.plateNumber}]`,
        };
      }
    }

    // 3) 업데이트 수행
    const updated = await prisma.vehicle.update({
      where: { id },
      data: {
        ...(data.plateNumber && { plateNumber: data.plateNumber }),
        ...(data.capacity !== undefined && { capacity: data.capacity }),
        ...(data.capacityType && { capacityType: data.capacityType }),
        ...(data.modelName !== undefined && { modelName: data.modelName || null }),
        ...(data.manufactureYear !== undefined && { manufactureYear: data.manufactureYear || null }),
        ...(data.status && { status: data.status }),
        ...(data.amenities !== undefined && { amenities: data.amenities }),
        ...(data.isMarketplaceVisible !== undefined && {
          isMarketplaceVisible: data.isMarketplaceVisible,
        }),
        ...(data.dailyRentalPrice !== undefined && {
          dailyRentalPrice: data.dailyRentalPrice || null,
        }),
        ...(data.mileage !== undefined && { mileage: data.mileage || null }),
      },
    });

    // 4) 캐시 갱신
    revalidatePath("/admin/vehicles");

    return {
      success: true,
      data: updated,
    };
  } catch (err: any) {
    console.error("[updateVehicle Error]:", err);
    if (err.code === "P2002") {
      return {
        success: false,
        error: `동일한 차량번호가 이미 존재합니다.`,
      };
    }
    return {
      success: false,
      error: err.message || "차량 정보 수정에 실패했습니다.",
    };
  }
}

/**
 * 4. 차량 삭제 (DELETE)
 */
export async function deleteVehicle(id: string): Promise<ActionResponse> {
  try {
    if (!id) {
      return { success: false, error: "삭제할 차량 ID가 지정되지 않았습니다." };
    }

    // 배차 할당 이력 조회
    const assignmentCount = await prisma.dispatchAssignment.count({
      where: { vehicleId: id },
    });

    if (assignmentCount > 0) {
      return {
        success: false,
        error: `해당 차량은 현재 ${assignmentCount}건의 배차 기록이 연결되어 있어 삭제할 수 없습니다. 대신 상태를 '비가동(INACTIVE)'으로 변경해 주세요.`,
      };
    }

    await prisma.vehicle.delete({
      where: { id },
    });

    revalidatePath("/admin/vehicles");

    return {
      success: true,
    };
  } catch (err: any) {
    console.error("[deleteVehicle Error]:", err);
    return {
      success: false,
      error: err.message || "차량 삭제 중 오류가 발생했습니다.",
    };
  }
}
