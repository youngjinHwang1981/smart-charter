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
