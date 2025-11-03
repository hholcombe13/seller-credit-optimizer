import type { ScenarioInput, ScenarioOutput, Program } from "@/types/mortgage";
import { getStandardFhaAnnualMipFactor } from "@/lib/fha";

const DEFAULT_CAPS: Record<Program, (ltv: number)=>number> = {
  Conventional: (ltv)=> ltv > 0.90 ? 0.03 : (ltv > 0.75 ? 0.06 : 0.09),
  FHA: (ltv)=> {
    void ltv;
    return 0.06;
  },
  VA: (ltv)=> {
    void ltv;
    return 0.04;
  },
  USDA: (ltv)=> {
    void ltv;
    return 0.06;
  },
  Jumbo: (ltv)=> {
    void ltv;
    return 0.03;
  },
};

function amortPayment(loan: number, ratePct: number, termMonths: number){
  const r = (ratePct/100)/12;
  if (r === 0) return loan/termMonths;
  const pow = Math.pow(1+r, termMonths);
  return loan * (r * pow) / (pow - 1);
}

function pmiMonthly(pmiType: string|undefined, factor: number|undefined, loan: number): number{
  if (!pmiType || pmiType === "None") return 0;
  if (pmiType === "BPMI" && factor) return (factor * loan) / 12;
  return 0;
}

export function computeScenario(s: ScenarioInput): ScenarioOutput {
  const loanAmount = s.loanAmount ?? (s.price * (s.ltv ?? 0));
  const pointsCost = loanAmount * (s.discountPointsPct/100);

  const pctCap = DEFAULT_CAPS[s.program]( (s.ltv ?? (loanAmount/s.price)) );
  const programCapDollars = s.price * pctCap;

  const eligibleCosts = pointsCost + s.closingCosts;
  const maxUsableCredit = Math.min(s.sellerCredit, programCapDollars, eligibleCosts);

  // Buydown heuristic: each 0.125% ≈ 0.50 pts (placeholder; replace with real pricing grid later)
  let appliedToPoints = 0;
  let newRate = s.noteRate;
  const steps: ScenarioOutput["allocationSteps"] = [];
  if (!s.lockRate) {
    let remaining = maxUsableCredit;
    let candidateRate = s.noteRate;
    const stepRate = 0.125;
    const stepPointsPct = 0.50;

    while (remaining > 0) {
      const stepCost = loanAmount * (stepPointsPct/100);
      if (stepCost > remaining) break;
      const before = amortPayment(loanAmount, candidateRate, s.termMonths);
      const after  = amortPayment(loanAmount, candidateRate - stepRate, s.termMonths);
      const monthlySave = Math.max(0, before - after);
      const breakEven = monthlySave > 0 ? Math.ceil(stepCost / monthlySave) : Infinity;
      if (!isFinite(breakEven) || breakEven > 84) break;

      remaining -= stepCost;
      appliedToPoints += stepCost;
      candidateRate -= stepRate;
      steps.push({ rate: candidateRate, pointsCost: stepCost, monthlySave, breakEven });
    }
    newRate = candidateRate;
  }

  const pni = amortPayment(loanAmount, newRate, s.termMonths);
  const fhaDefaultMip = s.program === "FHA" ? getStandardFhaAnnualMipFactor(s) : undefined;
  const pmiAnnualFactor = s.pmiAnnualFactor ?? fhaDefaultMip;
  const pmi = pmiMonthly(s.pmiType, pmiAnnualFactor, loanAmount);

  const appliedSellerCredit = appliedToPoints + Math.min(
    s.closingCosts,
    (maxUsableCredit - appliedToPoints)
  );
  const appliedToCosts = appliedSellerCredit - appliedToPoints;

  const piti = pni + pmi + (s.taxesMonthly ?? 0) + (s.insuranceMonthly ?? 0) + (s.hoaMonthly ?? 0);
  const cashToClose = (s.price - loanAmount) + (s.closingCosts - appliedToCosts);

  // crude APR-ish illustration
  const aprEstimate = Math.max(newRate, newRate + ((appliedToPoints/loanAmount) * 100) * (30/360));

  const warnings: string[] = [];
  if (s.sellerCredit > programCapDollars) warnings.push(`Seller credit exceeds typical ${s.program} cap (~${(pctCap*100).toFixed(1)}%).`);
  if (appliedSellerCredit < s.sellerCredit) warnings.push(`Not all seller credit usable given current costs/points.`);

  const breakEvenMonthsOnPoints = steps.length
    ? Math.round((appliedToPoints) / (steps.reduce((a,b)=>a+b.monthlySave,0) || 1))
    : undefined;

  return {
    loanAmount,
    pointsCost,
    appliedSellerCredit,
    appliedToPoints,
    appliedToCosts,
    pAndI: Number(pni.toFixed(2)),
    pmiMonthly: Number(pmi.toFixed(2)),
    pitiMonthly: Number(piti.toFixed(2)),
    cashToClose: Number(cashToClose.toFixed(2)),
    aprEstimate: Number(aprEstimate.toFixed(3)),
    breakEvenMonthsOnPoints,
    warnings,
    allocationSteps: steps
  };
}
