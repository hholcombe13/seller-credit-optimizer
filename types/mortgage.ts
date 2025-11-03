export type Program = "Conventional" | "FHA" | "VA" | "USDA" | "Jumbo";

export interface ScenarioInput {
  name?: string;
  price: number;
  ltv?: number;
  loanAmount?: number;
  program: Program;
  termMonths: number;
  noteRate: number;
  discountPointsPct: number;
  closingCosts: number;
  sellerCredit: number;
  pmiType?: "BPMI" | "SPMI" | "LPMI" | "None";
  pmiAnnualFactor?: number;
  taxesMonthly?: number;
  insuranceMonthly?: number;
  hoaMonthly?: number;
  lockRate?: boolean;
}

export interface ScenarioOutput {
  loanAmount: number;
  pointsCost: number;
  appliedSellerCredit: number;
  appliedToPoints: number;
  appliedToCosts: number;
  finalRate: number;
  pAndI: number;
  pmiMonthly: number;
  pitiMonthly: number;
  cashToClose: number;
  aprEstimate: number;
  breakEvenMonthsOnPoints?: number;
  warnings: string[];
  allocationSteps: Array<{ rate: number; pointsCost: number; monthlySave: number; breakEven: number }>;
}

export interface LoanTemplate {
  id: string;
  title: string;
  program: Program;
  termMonths: number;
  price: number;
  ltv?: number | null;
  loanAmount?: number | null;
  noteRate: number;
  discountPointsPct: number;
  closingCosts: number;
  sellerCredit: number;
  pmiType?: ScenarioInput["pmiType"];
  pmiAnnualFactor?: number | null;
  taxesMonthly?: number | null;
  insuranceMonthly?: number | null;
  hoaMonthly?: number | null;
  lockRate?: boolean | null;
  createdAt: string;
  updatedAt: string;
}

export interface LoanTemplatePayload {
  title: string;
  scenario: ScenarioInput;
}
