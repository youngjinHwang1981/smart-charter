/**
 * 기사 급여 세금 자동 공제 및 실지급액 계산 유틸리티
 * (기존 엑셀 '급여계산_소득세자동.xlsx' 산식 대체)
 */

export interface PayrollTaxConfig {
  /** 소득세율 (기본값: 0.03 = 3.0%) */
  incomeTaxRate?: number;
  /** 지방소득세율 (기본값: 0.003 = 0.3%) */
  localIncomeTaxRate?: number;
  /** 
   * 기타 4대 보험 등 추가 공제율 (예: 0.009 = 고용보험 0.9% 등, 기본값: 0)
   */
  additionalDeductionRate?: number;
  /** 기타 고정 추가 공제액 (기본값: 0원) */
  additionalFixedDeduction?: number;
  /** 10원 미만 절사 여부 (국세징수법 제47조 국고금단수계산법 기준 기본값: true) */
  truncateTenWonUnit?: boolean;
}

export interface PayrollCalculationResult {
  /** 요구사항 한글 키: 총액 (세전) */
  총액: number;
  /** 요구사항 한글 키: 공제액 (소득세 + 지방소득세 + 추가 공제) */
  공제액: number;
  /** 요구사항 한글 키: 실지급액 (세후 차인지급액) */
  실지급액: number;

  /** 영문 프로퍼티 병행 지원 */
  grossPay: number;
  totalDeductions: number;
  netPay: number;

  /** 세부 공제 내역 */
  details: {
    /** 소득세 (3%) */
    incomeTax: number;
    /** 지방소득세 (0.3%) */
    localIncomeTax: number;
    /** 원천징수 소득세 합계 (3.3%) */
    withholdingTaxTotal: number;
    /** 추가 공제액 (4대보험 요율 적용액) */
    additionalRateDeduction: number;
    /** 고정 추가 공제액 */
    additionalFixedDeduction: number;
    /** 적용된 총 소득세율 (소득세 + 지방소득세, 예: 3.3%) */
    effectiveTaxRatePercent: number;
  };
}

/** 기본 3.3% 프리랜서/사업소득 원천징수 기본 설정 */
export const DEFAULT_PAYROLL_CONFIG: Required<PayrollTaxConfig> = {
  incomeTaxRate: 0.03, // 소득세 3.0%
  localIncomeTaxRate: 0.003, // 지방소득세 0.3% (소득세의 10%)
  additionalDeductionRate: 0, // 기타 4대보험 등 추가 공제율
  additionalFixedDeduction: 0, // 고정 공제액
  truncateTenWonUnit: true, // 10원 미만 절사
};

/**
 * 10원 미만 단위 절사 함수 (세법 기본 규정)
 * 예: 13,548원 -> 13,540원
 */
function truncateToTenWon(amount: number): number {
  return Math.floor(amount / 10) * 10;
}

/**
 * 기사 급여액(총 지급 원금)에서 소득세 및 추가 공제액을 자동 계산하여 실지급액을 산출합니다.
 *
 * @param grossPayout 총 지급 원금 (세전 급여/수당)
 * @param customConfig 세금 및 공제율 커스텀 설정 (옵션)
 * @returns { 총액, 공제액, 실지급액, grossPay, totalDeductions, netPay, details }
 */
export function calculatePayroll(
  grossPayout: number,
  customConfig?: PayrollTaxConfig
): PayrollCalculationResult {
  const amount = Math.max(0, Math.round(grossPayout || 0));
  const config = { ...DEFAULT_PAYROLL_CONFIG, ...customConfig };

  if (amount === 0) {
    return {
      총액: 0,
      공제액: 0,
      실지급액: 0,
      grossPay: 0,
      totalDeductions: 0,
      netPay: 0,
      details: {
        incomeTax: 0,
        localIncomeTax: 0,
        withholdingTaxTotal: 0,
        additionalRateDeduction: 0,
        additionalFixedDeduction: 0,
        effectiveTaxRatePercent: +(
          (config.incomeTaxRate + config.localIncomeTaxRate) *
          100
        ).toFixed(2),
      },
    };
  }

  // 1. 소득세 계산 (3%)
  let rawIncomeTax = amount * config.incomeTaxRate;
  let incomeTax = config.truncateTenWonUnit
    ? truncateToTenWon(rawIncomeTax)
    : Math.floor(rawIncomeTax);

  // 2. 지방소득세 계산 (0.3% = 소득세의 10%)
  let rawLocalIncomeTax = amount * config.localIncomeTaxRate;
  let localIncomeTax = config.truncateTenWonUnit
    ? truncateToTenWon(rawLocalIncomeTax)
    : Math.floor(rawLocalIncomeTax);

  // 3. 소득세 합계 (3.3%)
  const withholdingTaxTotal = incomeTax + localIncomeTax;

  // 4. 기타 4대 보험 등 추가 공제율 설정 반영
  let rawAdditional = amount * (config.additionalDeductionRate || 0);
  let additionalRateDeduction = config.truncateTenWonUnit
    ? truncateToTenWon(rawAdditional)
    : Math.floor(rawAdditional);

  const additionalFixedDeduction = Math.max(
    0,
    config.additionalFixedDeduction || 0
  );

  // 5. 총 공제액 및 실지급액 산출
  const totalDeductions =
    withholdingTaxTotal + additionalRateDeduction + additionalFixedDeduction;
  const netPay = Math.max(0, amount - totalDeductions);

  const effectiveTaxRatePercent = +(
    (config.incomeTaxRate + config.localIncomeTaxRate) *
    100
  ).toFixed(2);

  return {
    총액: amount,
    공제액: totalDeductions,
    실지급액: netPay,
    grossPay: amount,
    totalDeductions,
    netPay,
    details: {
      incomeTax,
      localIncomeTax,
      withholdingTaxTotal,
      additionalRateDeduction,
      additionalFixedDeduction,
      effectiveTaxRatePercent,
    },
  };
}

/**
 * 고용 형태에 따른 추천 세무 룰 적용 계산기
 * - OWN (직영): 근로소득 또는 4대보험 공제 가능 (기본 소득세 3.3% or 4대보험)
 * - AFFILIATED (지입): 사업소득세 3.3% 원천징수
 * - OUTSOURCED (용차): 사업소득세 3.3% 원천징수
 */
export function calculatePayrollByEmploymentType(
  grossPayout: number,
  employmentType: string = "AFFILIATED",
  customConfig?: PayrollTaxConfig
): PayrollCalculationResult {
  let config: PayrollTaxConfig = { ...customConfig };

  switch (employmentType) {
    case "OWN":
      // 직영의 경우 필요시 4대보험 등 추가 설정 가능 (기본 3.3% 유지하되 설정 주입 가능)
      break;
    case "AFFILIATED":
    case "OUTSOURCED":
    default:
      // 지입/용차: 3.3% 사업소득 원천징수 기본
      break;
  }

  return calculatePayroll(grossPayout, config);
}

export interface PricingRuleItem {
  capacityType: string;
  baseRate: number;
  extraFuelCostPerKm: number;
  weekendSurgeRate: number;
  isActive?: boolean;
}

export interface DispatchPayoutInput {
  routePayoutPrice?: number | null;
  status?: string | null;
  actualDistance?: number | null;
  estimatedDistance?: number | null;
  actualTollFee?: number | null;
  defaultTollFee?: number | null;
  parkingFee?: number | null;
  date?: Date | string | null;
  capacityType?: string | null;
  pricingRules?: PricingRuleItem[];
}

export const DEFAULT_PRICING_RULES: PricingRuleItem[] = [
  {
    capacityType: "STANDARD_45",
    baseRate: 70000,
    extraFuelCostPerKm: 500,
    weekendSurgeRate: 1.1,
    isActive: true,
  },
  {
    capacityType: "PREMIUM_28",
    baseRate: 80000,
    extraFuelCostPerKm: 600,
    weekendSurgeRate: 1.15,
    isActive: true,
  },
  {
    capacityType: "COMPACT_25",
    baseRate: 60000,
    extraFuelCostPerKm: 400,
    weekendSurgeRate: 1.1,
    isActive: true,
  },
];

/**
 * 배차 1건의 기사 지급 수당(운행수당 + 거리단가 + 주말할증 + 승인 실비)을 자동 산출합니다.
 * - 노선에 고정 지급단가(routePayoutPrice > 0)가 있으면 해당 단가를 우선 적용합니다.
 * - 고정 지급단가가 0원인 일반 대절/신규 노선은 PricingRule(단가 기준표)의
 *   [차종별 기본단가 + (주행거리 × km당 단가)] × 주말할증 + 실비(톨비·주차비)로 자동 계산합니다.
 */
export function calculateDispatchPayout(input: DispatchPayoutInput): number {
  const baseRoutePayout = input.routePayoutPrice ?? 0;
  const status = input.status ?? "PENDING";
  const distanceKm =
    input.actualDistance && input.actualDistance > 0
      ? input.actualDistance
      : input.estimatedDistance && input.estimatedDistance > 0
      ? input.estimatedDistance
      : 0;

  // 실비(통행료 + 주차비)
  const toll =
    status === "COMPLETED"
      ? input.actualTollFee ?? input.defaultTollFee ?? 0
      : status === "PENDING_SETTLEMENT"
      ? input.actualTollFee ?? 0
      : 0;
  const parking =
    status === "COMPLETED" || status === "PENDING_SETTLEMENT"
      ? input.parkingFee ?? 0
      : 0;
  const extraExpenses = Math.max(0, toll + parking);

  // 1) 노선에 고정 지급 단가가 설정된 경우
  if (baseRoutePayout > 0) {
    return baseRoutePayout + extraExpenses;
  }

  // 2) 고정 지급 단가가 0원인 경우: 운행 완료/정산 대기 상태이거나 주행거리가 입력된 경우 단가 기준표 적용
  const isSettledOrSubmitted =
    status === "COMPLETED" ||
    status === "PENDING_SETTLEMENT" ||
    distanceKm > 0;

  if (!isSettledOrSubmitted) {
    return 0;
  }

  const rules =
    input.pricingRules && input.pricingRules.length > 0
      ? input.pricingRules.filter((r) => r.isActive !== false)
      : DEFAULT_PRICING_RULES;

  const targetCapacity = input.capacityType || "STANDARD_45";
  const matchedRule =
    rules.find((r) => r.capacityType === targetCapacity) ||
    rules.find((r) => r.capacityType === "STANDARD_45") ||
    rules[0] ||
    DEFAULT_PRICING_RULES[0];

  // 주말(토=6, 일=0) 여부 판별
  let isWeekend = false;
  if (input.date) {
    const d = typeof input.date === "string" ? new Date(input.date) : input.date;
    if (!isNaN(d.getTime())) {
      const day = d.getUTCDay();
      isWeekend = day === 0 || day === 6;
    }
  }

  const rawAllowance =
    matchedRule.baseRate + distanceKm * matchedRule.extraFuelCostPerKm;
  const surgeMultiplier = isWeekend ? matchedRule.weekendSurgeRate || 1.0 : 1.0;

  // 100원 단위 반올림
  const calculatedAllowance =
    Math.round((rawAllowance * surgeMultiplier) / 100) * 100;

  return calculatedAllowance + extraExpenses;
}
