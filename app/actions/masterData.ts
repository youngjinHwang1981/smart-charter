"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { CapacityType } from "@prisma/client";
import { z } from "zod";

// --- Zod 유효성 검사 스키마 ---
const routeMasterInputSchema = z.object({
  name: z.string().min(2, "노선명을 2자 이상 입력해 주세요.").trim(),
  departure: z.string().min(2, "출발지를 2자 이상 입력해 주세요.").trim(),
  destination: z.string().min(2, "도착지를 2자 이상 입력해 주세요.").trim(),
  estimatedDistance: z.coerce.number().min(0.1, "예상 주행거리는 0.1km 이상이어야 합니다."),
  defaultTollFee: z.coerce.number().min(0, "통행료는 0원 이상이어야 합니다.").default(0),
  isActive: z.boolean().default(true),
});

const pricingRuleInputSchema = z.object({
  startDate: z.string().or(z.date()),
  capacityType: z.nativeEnum(CapacityType),
  baseRate: z.coerce.number().min(0, "기본단가는 0원 이상이어야 합니다."),
  extraFuelCostPerKm: z.coerce.number().min(0, "추가유류비는 0원 이상이어야 합니다.").default(0),
  weekendSurgeRate: z.coerce.number().min(1.0, "주말할증비율은 1.0(할증 없음) 이상이어야 합니다.").default(1.0),
  isActive: z.boolean().default(true),
});

export type RouteMasterInput = z.infer<typeof routeMasterInputSchema>;
export type PricingRuleInput = z.infer<typeof pricingRuleInputSchema>;

export type ActionResponse<T = any> = {
  success: boolean;
  data?: T;
  error?: string;
};

// 기본 회사 ID 조회 헬퍼
async function getDefaultCompanyId(): Promise<string> {
  let company = await prisma.company.findFirst();
  if (!company) {
    company = await prisma.company.create({
      data: {
        name: "스마트투어 본사",
      },
    });
  }
  return company.id;
}

// ==========================================
// 1. RouteMaster (노선 마스터) Server Actions
// ==========================================

/**
 * 노선 마스터 전체 목록 조회 (GET)
 */
export async function getRouteMasters(): Promise<ActionResponse<any[]>> {
  try {
    const routes = await prisma.routeMaster.findMany({
      include: {
        company: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: [
        { isActive: "desc" },
        { createdAt: "desc" },
      ],
    });

    return {
      success: true,
      data: routes,
    };
  } catch (err: any) {
    console.error("[getRouteMasters Error]:", err);
    return {
      success: false,
      error: "노선 마스터 목록을 불러오는 중 오류가 발생했습니다.",
    };
  }
}

/**
 * 신규 노선 마스터 등록 (POST)
 */
export async function createRouteMaster(rawInput: RouteMasterInput): Promise<ActionResponse> {
  try {
    const parsed = routeMasterInputSchema.safeParse(rawInput);
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message || "입력값이 올바르지 않습니다.";
      return { success: false, error: firstError };
    }

    const data = parsed.data;
    const companyId = await getDefaultCompanyId();

    // 동일 출발지-도착지 동일 노선명 중복 체크
    const existing = await prisma.routeMaster.findFirst({
      where: {
        companyId,
        name: data.name,
      },
    });

    if (existing) {
      return {
        success: false,
        error: `이미 동일한 이름의 노선이 존재합니다: [${data.name}]`,
      };
    }

    const newRoute = await prisma.routeMaster.create({
      data: {
        companyId,
        name: data.name,
        departure: data.departure,
        destination: data.destination,
        estimatedDistance: data.estimatedDistance,
        defaultTollFee: data.defaultTollFee,
        isActive: data.isActive,
      },
    });

    revalidatePath("/admin/master-data/route");

    return {
      success: true,
      data: newRoute,
    };
  } catch (err: any) {
    console.error("[createRouteMaster Error]:", err);
    return {
      success: false,
      error: err.message || "노선 마스터 등록에 실패했습니다.",
    };
  }
}

// ==========================================
// 2. PricingRule (급여/정산 기준 단가) Server Actions
// ==========================================

/**
 * 요금/급여 산정 기준 규칙 목록 조회 (GET)
 * - 최초 조회 시 등록된 단가 기준이 0건이면 표준 전세버스 차종별 단가 기준을 자동 시딩합니다.
 */
export async function getPricingRules(): Promise<ActionResponse<any[]>> {
  try {
    let rules = await prisma.pricingRule.findMany({
      include: {
        company: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: [
        { isActive: "desc" },
        { startDate: "desc" },
        { capacityType: "asc" },
      ],
    });

    if (rules.length === 0) {
      const companyId = await getDefaultCompanyId();
      const defaultStartDate = new Date("2026-01-01T00:00:00.000Z");

      await prisma.pricingRule.createMany({
        data: [
          {
            companyId,
            startDate: defaultStartDate,
            capacityType: CapacityType.STANDARD_45,
            baseRate: 70000,
            extraFuelCostPerKm: 500,
            weekendSurgeRate: 1.1,
            isActive: true,
          },
          {
            companyId,
            startDate: defaultStartDate,
            capacityType: CapacityType.PREMIUM_28,
            baseRate: 80000,
            extraFuelCostPerKm: 600,
            weekendSurgeRate: 1.15,
            isActive: true,
          },
          {
            companyId,
            startDate: defaultStartDate,
            capacityType: CapacityType.COMPACT_25,
            baseRate: 60000,
            extraFuelCostPerKm: 400,
            weekendSurgeRate: 1.1,
            isActive: true,
          },
        ],
      });

      rules = await prisma.pricingRule.findMany({
        include: {
          company: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: [
          { isActive: "desc" },
          { startDate: "desc" },
          { capacityType: "asc" },
        ],
      });
    }

    return {
      success: true,
      data: rules,
    };
  } catch (err: any) {
    console.error("[getPricingRules Error]:", err);
    return {
      success: false,
      error: "요금 산정 기준 목록을 불러오는 중 오류가 발생했습니다.",
    };
  }
}

/**
 * 신규 요금/급여 산정 기준 규칙 등록 또는 동일 차종 단가 갱신 (POST)
 */
export async function createPricingRule(rawInput: PricingRuleInput): Promise<ActionResponse> {
  try {
    const parsed = pricingRuleInputSchema.safeParse(rawInput);
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message || "입력값이 올바르지 않습니다.";
      return { success: false, error: firstError };
    }

    const data = parsed.data;
    const companyId = await getDefaultCompanyId();

    const newRule = await prisma.pricingRule.create({
      data: {
        companyId,
        startDate: new Date(data.startDate),
        capacityType: data.capacityType,
        baseRate: data.baseRate,
        extraFuelCostPerKm: data.extraFuelCostPerKm,
        weekendSurgeRate: data.weekendSurgeRate,
        isActive: data.isActive,
      },
    });

    revalidatePath("/admin/master-data/route");
    revalidatePath("/admin/master-data/pricing");
    revalidatePath("/settlement");
    revalidatePath("/driver/[driverId]", "page");

    return {
      success: true,
      data: newRule,
    };
  } catch (err: any) {
    console.error("[createPricingRule Error]:", err);
    return {
      success: false,
      error: err.message || "단가 기준 등록에 실패했습니다.",
    };
  }
}

/**
 * 단가 기준 삭제 액션
 */
export async function deletePricingRule(ruleId: string): Promise<ActionResponse> {
  try {
    if (!ruleId) {
      return { success: false, error: "유효하지 않은 단가 기준 ID입니다." };
    }

    await prisma.pricingRule.delete({
      where: { id: ruleId },
    });

    revalidatePath("/admin/master-data/route");
    revalidatePath("/settlement");
    revalidatePath("/driver/[driverId]", "page");

    return { success: true };
  } catch (err: any) {
    console.error("[deletePricingRule Error]:", err);
    return {
      success: false,
      error: "단가 기준 삭제 중 오류가 발생했습니다.",
    };
  }
}
