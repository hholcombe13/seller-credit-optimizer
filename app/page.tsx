"use client";

import { Fragment, useMemo, useState } from "react";
import type { ScenarioInput, ScenarioOutput } from "@/types/mortgage";
import { getStandardFhaAnnualMipFactor } from "@/lib/fha";

type Insight = {
  name: string;
  program: ScenarioInput["program"];
  pros: string[];
  cons: string[];
};

function formatCurrency(value: number | undefined, fractionDigits = 2) {
  if (value == null || Number.isNaN(value)) return "?";
  return `$${value.toLocaleString(undefined, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  })}`;
}

function formatPercent(value: number | undefined, fractionDigits = 3) {
  if (value == null || Number.isNaN(value)) return "?";
  return `${value.toFixed(fractionDigits)}%`;
}

function formatNumber(
  value: number | undefined,
  options?: { fractionDigits?: number; suffix?: string },
) {
  if (value == null || Number.isNaN(value)) return "?";
  const fractionDigits = options?.fractionDigits ?? 0;
  const suffix = options?.suffix ?? "";
  return `${value.toLocaleString(undefined, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  })}${suffix}`;
}

const currency = (value: number, options?: { cents?: boolean }) =>
  value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: options?.cents ? 2 : 0,
    maximumFractionDigits: options?.cents ? 2 : 0,
  });

function analyzeScenarios(
  inputs: ScenarioInput[],
  outputs: ScenarioOutput[],
): Insight[] {
  if (!inputs.length || !outputs.length) return [];

  const paired = inputs
    .map((scenario, index) => ({ scenario, output: outputs[index] }))
    .filter(
      (item): item is { scenario: ScenarioInput; output: ScenarioOutput } =>
        !!item.output,
    );

  if (!paired.length) return [];

  const pitiValues = paired.map(({ output }) => output.pitiMonthly);
  const cashValues = paired.map(({ output }) => output.cashToClose);
  const aprValues = paired.map(({ output }) => output.aprEstimate);

  const minPiti = Math.min(...pitiValues);
  const maxPiti = Math.max(...pitiValues);
  const minCash = Math.min(...cashValues);
  const maxCash = Math.max(...cashValues);
  const minApr = Math.min(...aprValues);

  return paired.map(({ scenario, output }) => {
    const pros: string[] = [];
    const cons: string[] = [];

    const displayName = scenario.name?.trim() || scenario.program;
    const finalRate =
      output.finalRate ?? output.allocationSteps.at(-1)?.rate ?? scenario.noteRate;

    if (output.pitiMonthly === minPiti) {
      pros.push("Lowest estimated monthly housing payment in this comparison.");
    } else if (output.pitiMonthly - minPiti <= 75) {
      pros.push("Monthly payment stays close to the most affordable option.");
    }

    if (output.cashToClose === minCash) {
      pros.push("Minimizes estimated cash required at closing.");
    }

    if (output.aprEstimate === minApr) {
      pros.push("Most efficient estimated APR among the scenarios.");
    }

    if (output.appliedToPoints > 0) {
      pros.push(`Seller credit buys the rate down to about ${finalRate.toFixed(3)}%.`);
    }

    if (output.appliedToCosts > 0) {
      pros.push(`Seller credit is covering roughly ${currency(output.appliedToCosts)} of costs.`);
    }

    if (output.pmiMonthly === 0) {
      pros.push("No monthly mortgage insurance included in the payment.");
    }

    if (scenario.lockRate) {
      pros.push("Rate is locked so credits stay focused on costs instead of buydowns.");
    }

    if (
      output.breakEvenMonthsOnPoints &&
      output.breakEvenMonthsOnPoints <= 48
    ) {
      pros.push(
        `Point buydown breaks even in about ${output.breakEvenMonthsOnPoints} months.`,
      );
    }

    if (!output.warnings.length) {
      pros.push("No guideline warnings flagged for this setup.");
    }

    if (output.pitiMonthly === maxPiti) {
      cons.push("Highest estimated monthly payment in this set of options.");
    }

    if (output.cashToClose === maxCash) {
      cons.push("Requires the most estimated cash to close.");
    }

    if (output.pmiMonthly > 0) {
      cons.push(
        `Includes about ${currency(output.pmiMonthly, { cents: true })} in monthly mortgage insurance.`,
      );
    }

    if (
      output.breakEvenMonthsOnPoints &&
      output.breakEvenMonthsOnPoints > 60
    ) {
      cons.push(
        `Rate buydown takes roughly ${output.breakEvenMonthsOnPoints} months to break even.`,
      );
    }

    if (output.appliedSellerCredit < scenario.sellerCredit) {
      const unused = scenario.sellerCredit - output.appliedSellerCredit;
      if (unused > 0) {
        cons.push(
          `About ${currency(unused)} in seller credit cannot be used under the current structure.`,
        );
      }
    }

    output.warnings.forEach((warning) => cons.push(warning));

    if (scenario.program === "Jumbo" && (scenario.ltv ?? 0) > 0.8) {
      cons.push(
        "Higher-LTV jumbo loans often face tougher underwriting and reserve requirements.",
      );
    }

    if (scenario.program === "FHA" && (scenario.ltv ?? 0) > 0.96) {
      cons.push(
        "High-LTV FHA keeps both upfront and annual MIP in place for longer.",
      );
    }

    if (!pros.length) {
      pros.push(
        "Balanced trade-offs?focus on which lever (payment vs. cash) matters more to you.",
      );
    }

    if (!cons.length) {
      cons.push(
        "No major drawbacks flagged?verify program fit with underwriting guidelines.",
      );
    }

    return {
      name: displayName,
      program: scenario.program,
      pros,
      cons,
    };
  });
}

const blank: ScenarioInput = {
  name: "Option",
  price: 450000,
  ltv: 0.95,
  program: "Conventional",
  termMonths: 360,
  noteRate: 6.875,
  discountPointsPct: 0,
  closingCosts: 9000,
  sellerCredit: 12000,
  pmiType: "BPMI",
  pmiAnnualFactor: 0.006,
  taxesMonthly: 350,
  insuranceMonthly: 110,
  hoaMonthly: 0,
  lockRate: false,
};

const optionBadgeClass =
  "inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700";
const fieldLabelClass =
  "text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-slate-500";

function optionLabel(index: number) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let i = index;
  let label = "";

  do {
    label = alphabet[i % 26] + label;
    i = Math.floor(i / 26) - 1;
  } while (i >= 0);

  return `Option ${label}`;
}

export default function Home() {
  const [scenarios, setScenarios] = useState<ScenarioInput[]>([
    { ...blank, name: "Option A" },
    { ...blank, name: "Option B" },
  ]);
  const [results, setResults] = useState<ScenarioOutput[]>([]);
  const [chatInsights, setChatInsights] = useState<Insight[]>([]);
  const [isComparing, setIsComparing] = useState(false);

  const aggregate = useMemo(() => {
    const totalCredit = scenarios.reduce(
      (sum, scenario) => sum + (scenario.sellerCredit ?? 0),
      0,
    );
    const avgRate = scenarios.length
      ? scenarios.reduce((sum, scenario) => sum + (scenario.noteRate ?? 0), 0) /
        scenarios.length
      : 0;

    return {
      totalCredit,
      avgRate,
    };
  }, [scenarios]);

  const highlightCards = useMemo(() => {
    if (!results.length) {
      return [] as Array<{
        title: string;
        value: string;
        descriptor: string;
        option: string;
      }>;
    }

    const nameFor = (index: number) =>
      scenarios[index]?.name?.trim() || optionLabel(index);

    const lowestPitiIdx = results.reduce(
      (best, current, idx) =>
        current.pitiMonthly < results[best].pitiMonthly ? idx : best,
      0,
    );

    const lowestCashIdx = results.reduce(
      (best, current, idx) =>
        current.cashToClose < results[best].cashToClose ? idx : best,
      0,
    );

    const lowestAprIdx = results.reduce(
      (best, current, idx) =>
        current.aprEstimate < results[best].aprEstimate ? idx : best,
      0,
    );

    const breakEven = results
      .map((item, index) => ({ index, value: item.breakEvenMonthsOnPoints }))
      .filter((item) => typeof item.value === "number" && item.value > 0)
      .sort((a, b) => (a.value as number) - (b.value as number))[0];

    const summary = [
      {
        title: "Most Affordable Monthly",
        value: formatCurrency(results[lowestPitiIdx].pitiMonthly),
        descriptor: "Total monthly PITI",
        option: nameFor(lowestPitiIdx),
      },
      {
        title: "Lowest Cash to Close",
        value: formatCurrency(results[lowestCashIdx].cashToClose),
        descriptor: "Estimated funds required",
        option: nameFor(lowestCashIdx),
      },
      {
        title: "Best APR Estimate",
        value: formatPercent(results[lowestAprIdx].aprEstimate, 3),
        descriptor: "Annual percentage rate",
        option: nameFor(lowestAprIdx),
      },
    ];

    if (breakEven) {
      summary.push({
        title: "Fastest Points Break-even",
        value: formatNumber(breakEven.value, { suffix: " mo" }),
        descriptor: "Time to recover buydown",
        option: nameFor(breakEven.index),
      });
    }

    return summary;
  }, [results, scenarios]);

  const sections = useMemo(
    () =>
      [
        {
          title: "Scenario Overview",
          rows: [
            {
              label: "Purchase Price",
              formatter: (scenario: ScenarioInput | undefined) =>
                formatCurrency(scenario?.price, 0),
            },
            {
              label: "Program",
              formatter: (scenario: ScenarioInput | undefined) =>
                scenario?.program ?? "?",
            },
            {
              label: "LTV",
              formatter: (
                scenario: ScenarioInput | undefined,
                result: ScenarioOutput | undefined,
              ) => {
                const ratio =
                  typeof scenario?.ltv === "number"
                    ? scenario.ltv * 100
                    : scenario?.price && result?.loanAmount
                      ? (result.loanAmount / scenario.price) * 100
                      : undefined;
                return typeof ratio === "number"
                  ? formatPercent(ratio, 2)
                  : "?";
              },
            },
            {
              label: "Loan Amount",
              formatter: (_scenario, result: ScenarioOutput | undefined) =>
                formatCurrency(result?.loanAmount, 0),
            },
            {
              label: "Down Payment",
              formatter: (
                scenario: ScenarioInput | undefined,
                result: ScenarioOutput | undefined,
              ) => {
                if (!scenario?.price) return "?";
                const loan = result?.loanAmount ?? scenario.loanAmount;
                if (loan == null) return "?";
                return formatCurrency(scenario.price - loan, 0);
              },
            },
            {
              label: "Term",
              formatter: (scenario: ScenarioInput | undefined) => {
                if (!scenario?.termMonths) return "?";
                const years = scenario.termMonths / 12;
                return `${formatNumber(scenario.termMonths, { suffix: " mo" })} (${years.toFixed(1)} yr)`;
              },
            },
            {
              label: "Note Rate",
              formatter: (scenario: ScenarioInput | undefined) =>
                formatPercent(scenario?.noteRate, 3),
            },
            {
              label: "Effective Rate",
              formatter: (_scenario, result: ScenarioOutput | undefined) =>
                formatPercent(result?.finalRate, 3),
            },
            {
              label: "Discount Points",
              formatter: (scenario: ScenarioInput | undefined) =>
                formatPercent(scenario?.discountPointsPct, 3),
            },
            {
              label: "Points Cost",
              formatter: (_scenario, result: ScenarioOutput | undefined) =>
                formatCurrency(result?.pointsCost),
            },
            {
              label: "Closing Costs",
              formatter: (scenario: ScenarioInput | undefined) =>
                formatCurrency(scenario?.closingCosts),
            },
            {
              label: "Seller Credit",
              formatter: (scenario: ScenarioInput | undefined) =>
                formatCurrency(scenario?.sellerCredit),
            },
            {
              label: "PMI Type",
              formatter: (scenario: ScenarioInput | undefined) =>
                scenario?.pmiType ?? "?",
            },
            {
              label: "PMI Annual Factor",
              formatter: (scenario: ScenarioInput | undefined) =>
                scenario?.pmiAnnualFactor == null
                  ? "?"
                  : formatPercent(scenario.pmiAnnualFactor * 100, 2),
            },
            {
              label: "Lock Rate",
              formatter: (scenario: ScenarioInput | undefined) =>
                scenario?.lockRate ? "Yes" : "No",
            },
          ],
        },
        {
          title: "Recurring Costs",
          rows: [
            {
              label: "Principal & Interest",
              formatter: (_scenario, result: ScenarioOutput | undefined) =>
                formatCurrency(result?.pAndI),
            },
            {
              label: "PMI",
              formatter: (_scenario, result: ScenarioOutput | undefined) =>
                formatCurrency(result?.pmiMonthly),
            },
            {
              label: "Taxes",
              formatter: (scenario: ScenarioInput | undefined) =>
                formatCurrency(scenario?.taxesMonthly),
            },
            {
              label: "Insurance",
              formatter: (scenario: ScenarioInput | undefined) =>
                formatCurrency(scenario?.insuranceMonthly),
            },
            {
              label: "HOA",
              formatter: (scenario: ScenarioInput | undefined) =>
                formatCurrency(scenario?.hoaMonthly),
            },
            {
              label: "Total PITI",
              formatter: (_scenario, result: ScenarioOutput | undefined) =>
                formatCurrency(result?.pitiMonthly),
            },
          ],
        },
        {
          title: "Credits & Closing",
          rows: [
            {
              label: "Applied Seller Credit",
              formatter: (_scenario, result: ScenarioOutput | undefined) =>
                formatCurrency(result?.appliedSellerCredit),
            },
            {
              label: "? To Points",
              formatter: (_scenario, result: ScenarioOutput | undefined) =>
                formatCurrency(result?.appliedToPoints),
            },
            {
              label: "? To Costs",
              formatter: (_scenario, result: ScenarioOutput | undefined) =>
                formatCurrency(result?.appliedToCosts),
            },
            {
              label: "Cash to Close",
              formatter: (_scenario, result: ScenarioOutput | undefined) =>
                formatCurrency(result?.cashToClose),
            },
            {
              label: "APR (est)",
              formatter: (_scenario, result: ScenarioOutput | undefined) =>
                formatPercent(result?.aprEstimate, 3),
            },
            {
              label: "Pts Break-Even (mo)",
              formatter: (_scenario, result: ScenarioOutput | undefined) =>
                result?.breakEvenMonthsOnPoints != null
                  ? formatNumber(result.breakEvenMonthsOnPoints, { suffix: " mo" })
                  : "?",
            },
            {
              label: "Warnings",
              formatter: (_scenario, result: ScenarioOutput | undefined) =>
                result?.warnings?.length ? result.warnings.join("; ") : "?",
            },
          ],
        },
      ],
    [],
  );

  async function compare() {
    try {
      setIsComparing(true);
      const payload = scenarios.map((scenario) => ({ ...scenario }));
      const response = await fetch("/api/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error("Comparison request failed");
      }

      const data: ScenarioOutput[] = await response.json();
      setResults(data);
      setChatInsights(analyzeScenarios(payload, data));
    } catch (error) {
      console.error(error);
      setResults([]);
      setChatInsights([]);
    } finally {
      setIsComparing(false);
    }
  }

  function update(index: number, patch: Partial<ScenarioInput>) {
    setScenarios((previous) => {
      const next = [...previous];
      const current = next[index];
      const merged: ScenarioInput = { ...current, ...patch };

      const shouldAutoFhaPmi =
        merged.program === "FHA" &&
        !("pmiAnnualFactor" in patch) &&
        ("program" in patch ||
          "ltv" in patch ||
          "loanAmount" in patch ||
          "price" in patch ||
          "termMonths" in patch);

      if (shouldAutoFhaPmi) {
        const fhaFactor = getStandardFhaAnnualMipFactor(merged);
        if (fhaFactor !== undefined) {
          if (!("pmiType" in patch) && merged.pmiType !== "None") {
            merged.pmiType = merged.pmiType ?? "BPMI";
          }
          merged.pmiAnnualFactor = Number(fhaFactor.toFixed(4));
        }
      }

      next[index] = merged;
      return next;
    });
  }

  function addScenario() {
    setScenarios((previous) => [
      ...previous,
      { ...blank, name: optionLabel(previous.length) },
    ]);
  }

  return (
    <main className="relative">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 flex justify-center">
        <div className="h-64 w-[36rem] rounded-full bg-blue-200/40 blur-3xl" />
      </div>

      <div className="mx-auto flex max-w-7xl flex-col gap-8 px-4 pb-16 pt-10 sm:px-6 lg:px-8">
        <header className="rounded-3xl border border-white/70 bg-white/80 p-8 shadow-lg shadow-slate-900/5 backdrop-blur-xl">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl space-y-4">
              <span className="inline-flex items-center gap-2 rounded-full bg-blue-100/70 px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.3em] text-blue-700">
                Builder Lending Studio
              </span>
              <h1 className="text-3xl font-semibold text-slate-950 md:text-4xl">
                Mortgage Scenario Studio
              </h1>
              <p className="text-base text-slate-600">
                Craft side-by-side loan scenarios that put builder concessions to
                work. Model rate buydowns, closing cost coverage, and PMI options
                with production-ready clarity.
              </p>
            </div>

            <div className="flex flex-col gap-3 lg:items-end">
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={addScenario}
                  className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white/70 px-5 py-2.5 text-sm font-medium text-slate-700 transition hover:border-blue-200 hover:text-blue-700"
                >
                  Add Scenario
                </button>
                <button
                  onClick={compare}
                  disabled={isComparing}
                  className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-900/20 transition hover:from-blue-700 hover:to-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isComparing ? "Comparing?" : "Run Comparison"}
                </button>
              </div>
              <p className="text-xs text-slate-500">
                Scenarios are session-based and never store borrower PII.
              </p>
            </div>
          </div>

          <dl className="mt-6 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-slate-200/80 bg-white/70 px-4 py-3">
              <dt className="text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-slate-500">
                Active Scenarios
              </dt>
              <dd className="mt-1 text-2xl font-semibold text-slate-900">
                {scenarios.length.toString().padStart(2, "0")}
              </dd>
            </div>
            <div className="rounded-2xl border border-slate-200/80 bg-white/70 px-4 py-3">
              <dt className="text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-slate-500">
                Average Note Rate
              </dt>
              <dd className="mt-1 text-2xl font-semibold text-slate-900">
                {formatPercent(aggregate.avgRate, 3)}
              </dd>
            </div>
            <div className="rounded-2xl border border-slate-200/80 bg-white/70 px-4 py-3">
              <dt className="text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-slate-500">
                Builder Credits Modeled
              </dt>
              <dd className="mt-1 text-2xl font-semibold text-slate-900">
                {formatCurrency(aggregate.totalCredit, 0)}
              </dd>
            </div>
          </dl>
        </header>

        <section className="grid gap-6 lg:grid-cols-1">
          <div className="grid gap-6 lg:grid-cols-2">
            {scenarios.map((scenario, index) => (
              <article
                key={index}
                className="group rounded-3xl border border-slate-200/80 bg-white/80 p-6 shadow-sm shadow-slate-900/5 transition hover:border-blue-200 hover:shadow-lg hover:shadow-blue-900/10"
              >
                <div className="flex items-center gap-3 border-b border-slate-200/60 pb-4">
                  <label className="flex-1">
                    <span className="sr-only">Scenario Name</span>
                    <input
                      id={`scenario-name-${index}`}
                      className="w-full border-none bg-transparent px-0 text-lg font-semibold text-slate-950 placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-0"
                      placeholder={optionLabel(index)}
                      value={scenario.name ?? ""}
                      onChange={(event) =>
                        update(index, { name: event.target.value })
                      }
                    />
                  </label>
                  <span className={optionBadgeClass}>{scenario.program}</span>
                </div>

                <div className="grid gap-6 pt-4">
                  <div className="space-y-3">
                    <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                      Acquisition
                    </h3>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="flex flex-col gap-1 text-sm font-medium text-slate-600">
                        <span className={fieldLabelClass}>Purchase Price</span>
                        <input
                          type="number"
                          className="w-full"
                          value={scenario.price ?? 0}
                          onChange={(event) =>
                            update(index, { price: Number(event.target.value) })
                          }
                        />
                      </label>
                      <label className="flex flex-col gap-1 text-sm font-medium text-slate-600">
                        <span className={fieldLabelClass}>LTV</span>
                        <input
                          type="number"
                          step="0.01"
                          className="w-full"
                          value={scenario.ltv ?? 0}
                          onChange={(event) =>
                            update(index, { ltv: Number(event.target.value) })
                          }
                        />
                      </label>
                      <label className="flex flex-col gap-1 text-sm font-medium text-slate-600">
                        <span className={fieldLabelClass}>Program</span>
                        <select
                          className="w-full"
                          value={scenario.program}
                          onChange={(event) =>
                            update(index, {
                              program: event.target.value as ScenarioInput["program"],
                            })
                          }
                        >
                          <option>Conventional</option>
                          <option>FHA</option>
                          <option>VA</option>
                          <option>USDA</option>
                          <option>Jumbo</option>
                        </select>
                      </label>
                      <label className="flex flex-col gap-1 text-sm font-medium text-slate-600">
                        <span className={fieldLabelClass}>Term (Months)</span>
                        <input
                          type="number"
                          className="w-full"
                          value={scenario.termMonths ?? 0}
                          onChange={(event) =>
                            update(index, { termMonths: Number(event.target.value) })
                          }
                        />
                      </label>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                      Pricing
                    </h3>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="flex flex-col gap-1 text-sm font-medium text-slate-600">
                        <span className={fieldLabelClass}>Note Rate</span>
                        <input
                          type="number"
                          step="0.001"
                          className="w-full"
                          value={scenario.noteRate ?? 0}
                          onChange={(event) =>
                            update(index, { noteRate: Number(event.target.value) })
                          }
                        />
                      </label>
                      <label className="flex flex-col gap-1 text-sm font-medium text-slate-600">
                        <span className={fieldLabelClass}>Discount Points %</span>
                        <input
                          type="number"
                          step="0.125"
                          className="w-full"
                          value={scenario.discountPointsPct ?? 0}
                          onChange={(event) =>
                            update(index, {
                              discountPointsPct: Number(event.target.value),
                            })
                          }
                        />
                      </label>
                      <label className="flex flex-col gap-1 text-sm font-medium text-slate-600">
                        <span className={fieldLabelClass}>Closing Costs</span>
                        <input
                          type="number"
                          className="w-full"
                          value={scenario.closingCosts ?? 0}
                          onChange={(event) =>
                            update(index, {
                              closingCosts: Number(event.target.value),
                            })
                          }
                        />
                      </label>
                      <label className="flex flex-col gap-1 text-sm font-medium text-slate-600">
                        <span className={fieldLabelClass}>Seller Credit</span>
                        <input
                          type="number"
                          className="w-full"
                          value={scenario.sellerCredit ?? 0}
                          onChange={(event) =>
                            update(index, {
                              sellerCredit: Number(event.target.value),
                            })
                          }
                        />
                      </label>
                      <label className="flex flex-col gap-1 text-sm font-medium text-slate-600">
                        <span className={fieldLabelClass}>PMI Type</span>
                        <select
                          className="w-full"
                          value={scenario.pmiType}
                          onChange={(event) =>
                            update(index, {
                              pmiType: event.target.value as ScenarioInput["pmiType"],
                            })
                          }
                        >
                          <option>BPMI</option>
                          <option>SPMI</option>
                          <option>LPMI</option>
                          <option>None</option>
                        </select>
                      </label>
                      <label className="flex flex-col gap-1 text-sm font-medium text-slate-600">
                        <span className={fieldLabelClass}>PMI Annual Factor</span>
                        <input
                          type="number"
                          step="0.001"
                          className="w-full"
                          value={scenario.pmiAnnualFactor ?? 0}
                          onChange={(event) =>
                            update(index, {
                              pmiAnnualFactor: Number(event.target.value),
                            })
                          }
                        />
                      </label>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                      Monthly Carry
                    </h3>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="flex flex-col gap-1 text-sm font-medium text-slate-600">
                        <span className={fieldLabelClass}>Taxes</span>
                        <input
                          type="number"
                          className="w-full"
                          value={scenario.taxesMonthly ?? 0}
                          onChange={(event) =>
                            update(index, {
                              taxesMonthly: Number(event.target.value),
                            })
                          }
                        />
                      </label>
                      <label className="flex flex-col gap-1 text-sm font-medium text-slate-600">
                        <span className={fieldLabelClass}>Insurance</span>
                        <input
                          type="number"
                          className="w-full"
                          value={scenario.insuranceMonthly ?? 0}
                          onChange={(event) =>
                            update(index, {
                              insuranceMonthly: Number(event.target.value),
                            })
                          }
                        />
                      </label>
                      <label className="flex flex-col gap-1 text-sm font-medium text-slate-600">
                        <span className={fieldLabelClass}>HOA</span>
                        <input
                          type="number"
                          className="w-full"
                          value={scenario.hoaMonthly ?? 0}
                          onChange={(event) =>
                            update(index, {
                              hoaMonthly: Number(event.target.value),
                            })
                          }
                        />
                      </label>
                      <label className="flex flex-col gap-1 text-sm font-medium text-slate-600">
                        <span className={fieldLabelClass}>Lock Rate (No Buydown)</span>
                        <div className="flex items-center gap-2 rounded-xl border border-slate-200/80 bg-white/80 px-3 py-2">
                          <input
                            type="checkbox"
                            className="h-4 w-4"
                            checked={!!scenario.lockRate}
                            onChange={(event) =>
                              update(index, { lockRate: event.target.checked })
                            }
                          />
                          <span className="text-xs font-medium text-slate-600">
                            Preserve rate ? no buydown allowed
                          </span>
                        </div>
                      </label>
                    </div>
                  </div>
                </div>

                <p className="mt-5 text-xs text-slate-500">
                  Scenario worksheet for internal use only. Figures are
                  directional and subject to formal underwriting.
                </p>
              </article>
            ))}
          </div>
        </section>

        {results.length > 0 && (
          <section className="space-y-6">
            {!!highlightCards.length && (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {highlightCards.map((item) => (
                  <div
                    key={`${item.title}-${item.option}`}
                    className="rounded-3xl border border-blue-200/60 bg-gradient-to-br from-white/95 via-white/70 to-blue-50/50 p-5 shadow-sm shadow-blue-900/10"
                  >
                    <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-blue-700">
                      {item.title}
                    </p>
                    <p className="mt-3 text-2xl font-semibold text-slate-950">
                      {item.value}
                    </p>
                    <p className="mt-1 text-xs font-medium text-slate-500">
                      {item.option} ? {item.descriptor}
                    </p>
                  </div>
                ))}
              </div>
            )}

            <div className="overflow-hidden rounded-3xl border border-white/70 bg-white/85 shadow-xl shadow-slate-900/10 backdrop-blur">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead className="bg-slate-900 text-slate-100">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.2em]">
                        Metric
                      </th>
                      {results.map((_, index) => (
                        <th
                          key={index}
                          className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.2em]"
                        >
                          {scenarios[index]?.name?.trim() || optionLabel(index)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100/80">
                    {sections.map((section) => (
                      <Fragment key={section.title}>
                        <tr className="bg-slate-100/75">
                          <td
                            colSpan={1 + results.length}
                            className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-slate-600"
                          >
                            {section.title}
                          </td>
                        </tr>
                        {section.rows.map((row) => (
                          <tr key={row.label} className="even:bg-slate-50/60">
                            <td className="px-4 py-3 text-sm font-semibold text-slate-600">
                              {row.label}
                            </td>
                            {results.map((result, index) => (
                              <td
                                key={`${row.label}-${index}`}
                                className="px-4 py-3 text-sm text-slate-900"
                              >
                                {row.formatter(scenarios[index], result)}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {!!chatInsights.length && (
              <div className="rounded-3xl border border-slate-200/70 bg-white/90 p-6 shadow-md shadow-slate-900/5 backdrop-blur">
                <header className="flex items-center gap-4 border-b border-slate-200/60 pb-4">
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-900 text-sm font-semibold uppercase tracking-wide text-white">
                    AI
                  </span>
                  <div>
                    <h2 className="text-base font-semibold text-slate-900">
                      Mortgage Expert Chatbot
                    </h2>
                    <p className="text-xs text-slate-500">
                      Pros and cons tailored to each scenario you just compared.
                    </p>
                  </div>
                </header>

                <div className="mt-4 grid gap-4 lg:grid-cols-2">
                  {chatInsights.map(({ name, program, pros, cons }) => (
                    <article
                      key={`${name}-${program}`}
                      className="rounded-2xl border border-slate-200/70 bg-slate-50/70 p-4 shadow-sm"
                    >
                      <h3 className="text-sm font-semibold text-slate-900">
                        {name} <span className="font-normal text-slate-500">({program})</span>
                      </h3>
                      <div className="mt-3 grid gap-4 sm:grid-cols-2">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                            Pros
                          </p>
                          <ul className="mt-1 list-disc space-y-1 pl-4 text-xs text-slate-700">
                            {pros.map((pro, idx) => (
                              <li key={idx}>{pro}</li>
                            ))}
                          </ul>
                        </div>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-rose-700">
                            Cons
                          </p>
                          <ul className="mt-1 list-disc space-y-1 pl-4 text-xs text-slate-700">
                            {cons.map((con, idx) => (
                              <li key={idx}>{con}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>

                <p className="mt-4 text-xs text-slate-500">
                  Assistant uses rules of thumb for illustration only?confirm with
                  current pricing and underwriting.
                </p>
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  );
}
