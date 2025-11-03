import type { ScenarioInput } from "@/types/mortgage";

const FHA_HIGH_BALANCE_THRESHOLD = 726200;

type ScenarioLike = Pick<ScenarioInput, "termMonths" | "ltv" | "loanAmount" | "price">;

function normalizeLtv(s: ScenarioLike): number | undefined {
  if (typeof s.ltv === "number" && isFinite(s.ltv) && s.ltv > 0) {
    return s.ltv;
  }
  if (typeof s.loanAmount === "number" && isFinite(s.loanAmount) && s.loanAmount > 0 && s.price > 0) {
    return s.loanAmount / s.price;
  }
  return undefined;
}

function normalizeLoanAmount(s: ScenarioLike, ltv: number | undefined): number | undefined {
  if (typeof s.loanAmount === "number" && isFinite(s.loanAmount) && s.loanAmount > 0) {
    return s.loanAmount;
  }
  if (ltv !== undefined && s.price > 0) {
    return s.price * ltv;
  }
  return undefined;
}

export function getStandardFhaAnnualMipFactor(s: ScenarioLike): number | undefined {
  const ltv = normalizeLtv(s);
  const loanAmount = normalizeLoanAmount(s, ltv);
  const termMonths = s.termMonths;

  if (ltv === undefined || loanAmount === undefined || !termMonths) {
    return undefined;
  }

  const highBalance = loanAmount > FHA_HIGH_BALANCE_THRESHOLD;
  const ltvPct = ltv;

  const overFifteenYears = termMonths > 180;

  if (overFifteenYears) {
    if (highBalance) {
      if (ltvPct <= 0.90) return 0.0055;
      return 0.0060;
    }
    if (ltvPct <= 0.90) return 0.0050;
    return 0.0055;
  }

  if (highBalance) {
    if (ltvPct <= 0.90) return 0.0040;
    return 0.0065;
  }

  if (ltvPct <= 0.90) return 0.0015;
  return 0.0040;
}
