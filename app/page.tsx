"use client";
import { useState } from "react";
import type { ScenarioInput, ScenarioOutput } from "@/types/mortgage";
import { getStandardFhaAnnualMipFactor } from "@/lib/fha";

type Insight = {
  name: string;
  program: ScenarioInput["program"];
  pros: string[];
  cons: string[];
};

const currency = (value: number, options?: { cents?: boolean }) =>
  value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: options?.cents ? 2 : 0,
    maximumFractionDigits: options?.cents ? 2 : 0
  });

function analyzeScenarios(inputs: ScenarioInput[], outputs: ScenarioOutput[]): Insight[] {
  if (!inputs.length || !outputs.length) return [];

  const paired = inputs
    .map((scenario, index) => ({ scenario, output: outputs[index] }))
    .filter((item): item is { scenario: ScenarioInput; output: ScenarioOutput } => !!item.output);

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
    const finalRate = output.allocationSteps.at(-1)?.rate ?? scenario.noteRate;

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

    if (output.breakEvenMonthsOnPoints && output.breakEvenMonthsOnPoints <= 48) {
      pros.push(`Point buydown breaks even in about ${output.breakEvenMonthsOnPoints} months.`);
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
      cons.push(`Includes about ${currency(output.pmiMonthly, { cents: true })} in monthly mortgage insurance.`);
    }

    if (output.breakEvenMonthsOnPoints && output.breakEvenMonthsOnPoints > 60) {
      cons.push(`Rate buydown takes roughly ${output.breakEvenMonthsOnPoints} months to break even.`);
    }

    if (output.appliedSellerCredit < scenario.sellerCredit) {
      const unused = scenario.sellerCredit - output.appliedSellerCredit;
      if (unused > 0) cons.push(`About ${currency(unused)} in seller credit cannot be used under the current structure.`);
    }

    output.warnings.forEach((warning) => cons.push(warning));

    if (scenario.program === "Jumbo" && (scenario.ltv ?? 0) > 0.8) {
      cons.push("Higher-LTV jumbo loans often face tougher underwriting and reserve requirements.");
    }

    if (scenario.program === "FHA" && (scenario.ltv ?? 0) > 0.96) {
      cons.push("High-LTV FHA keeps both upfront and annual MIP in place for longer.");
    }

    if (!pros.length) {
      pros.push("Balanced trade-offs—focus on which lever (payment vs. cash) matters more to you.");
    }

    if (!cons.length) {
      cons.push("No major drawbacks flagged—verify program fit with underwriting guidelines.");
    }

    return {
      name: displayName,
      program: scenario.program,
      pros,
      cons
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
  lockRate: false
};

export default function Home(){
  const [scenarios, setScenarios] = useState<ScenarioInput[]>([{...blank, name:"Option A"}, {...blank, name:"Option B"}]);
  const [results, setResults] = useState<ScenarioOutput[]>([]);
  const [insights, setInsights] = useState<Insight[]>([]);

  async function compare(){
    const payload = scenarios.map((scenario)=>({ ...scenario }));
    const res = await fetch("/api/compare", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data: ScenarioOutput[] = await res.json();
    setResults(data);
    setInsights(analyzeScenarios(payload, data));
  }

  function update(i:number, patch:Partial<ScenarioInput>){
    setScenarios(prev=>{
      const next = [...prev];
      const current = next[i];
      const merged: ScenarioInput = { ...current, ...patch };

      const shouldAutoFhaPmi =
        merged.program === "FHA" &&
        !("pmiAnnualFactor" in patch) &&
        (
          "program" in patch ||
          "ltv" in patch ||
          "loanAmount" in patch ||
          "price" in patch ||
          "termMonths" in patch
        );

      if (shouldAutoFhaPmi) {
        const fhaFactor = getStandardFhaAnnualMipFactor(merged);
        if (fhaFactor !== undefined) {
          if (!("pmiType" in patch) && merged.pmiType !== "None") {
            merged.pmiType = merged.pmiType ?? "BPMI";
          }
          merged.pmiAnnualFactor = Number(fhaFactor.toFixed(4));
        }
      }

      next[i] = merged;
      return next;
    });
  }

  const metricRows: Array<[string, (r: ScenarioOutput)=>string | number]> = [
    ["APR (est)", (r)=> `${r.aprEstimate.toFixed(3)}%`],
    ["Loan Amount", (r)=> `$${r.loanAmount.toLocaleString()}`],
    ["P&I", (r)=> `$${r.pAndI.toLocaleString()}`],
    ["PMI", (r)=> `$${r.pmiMonthly.toLocaleString()}`],
    ["PITI", (r)=> `$${r.pitiMonthly.toLocaleString()}`],
    ["Applied Seller Credit", (r)=> `$${r.appliedSellerCredit.toLocaleString()}`],
    ["→ To Points", (r)=> `$${r.appliedToPoints.toLocaleString()}`],
    ["→ To Costs", (r)=> `$${r.appliedToCosts.toLocaleString()}`],
    ["Cash to Close (est)", (r)=> `$${r.cashToClose.toLocaleString()}`],
    ["Pts Break-Even (mo)", (r)=> r.breakEvenMonthsOnPoints ?? "—"],
    ["Warnings", (r)=> (r.warnings||[]).join("; ") || "—"],
  ];

  return (
    <main className="p-6 space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Seller Credit Optimizer (Builder LO)</h1>
        <div className="space-x-2">
          <button className="px-3 py-2 border rounded" onClick={()=>setScenarios([...scenarios, {...blank, name:`Option ${String.fromCharCode(65+scenarios.length)}` }])}>New Scenario</button>
          <button className="px-3 py-2 bg-black text-white rounded" onClick={compare}>Compare</button>
        </div>
      </header>

      <section className="grid md:grid-cols-2 gap-4">
        {scenarios.map((s,i)=>(
          <div key={i} className="rounded border p-4 space-y-2">
            <input className="w-full border rounded p-2" value={s.name||""} onChange={e=>update(i,{name:e.target.value})}/>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-sm">Price
                <input type="number" className="w-full border rounded p-2" value={s.price} onChange={e=>update(i,{price:+e.target.value})}/>
              </label>
              <label className="text-sm">LTV
                <input type="number" step="0.01" className="w-full border rounded p-2" value={s.ltv ?? 0} onChange={e=>update(i,{ltv:+e.target.value})}/>
              </label>
              <label className="text-sm">Program
                <select className="w-full border rounded p-2" value={s.program} onChange={e=>update(i,{program:e.target.value as ScenarioInput["program"]})}>
                  <option>Conventional</option><option>FHA</option><option>VA</option><option>USDA</option><option>Jumbo</option>
                </select>
              </label>
              <label className="text-sm">Term (mo)
                <input type="number" className="w-full border rounded p-2" value={s.termMonths} onChange={e=>update(i,{termMonths:+e.target.value})}/>
              </label>
              <label className="text-sm">Rate (%)
                <input type="number" step="0.001" className="w-full border rounded p-2" value={s.noteRate} onChange={e=>update(i,{noteRate:+e.target.value})}/>
              </label>
              <label className="text-sm">Discount Pts (%)
                <input type="number" step="0.125" className="w-full border rounded p-2" value={s.discountPointsPct} onChange={e=>update(i,{discountPointsPct:+e.target.value})}/>
              </label>
              <label className="text-sm">Closing Costs ($)
                <input type="number" className="w-full border rounded p-2" value={s.closingCosts} onChange={e=>update(i,{closingCosts:+e.target.value})}/>
              </label>
              <label className="text-sm">Seller Credit ($)
                <input type="number" className="w-full border rounded p-2" value={s.sellerCredit} onChange={e=>update(i,{sellerCredit:+e.target.value})}/>
              </label>
              <label className="text-sm">PMI Type
                <select className="w-full border rounded p-2" value={s.pmiType} onChange={e=>update(i,{pmiType:e.target.value as ScenarioInput["pmiType"]})}>
                  <option>BPMI</option><option>SPMI</option><option>LPMI</option><option>None</option>
                </select>
              </label>
              <label className="text-sm">PMI Annual Factor
                <input type="number" step="0.001" className="w-full border rounded p-2" value={s.pmiAnnualFactor ?? 0} onChange={e=>update(i,{pmiAnnualFactor:+e.target.value})}/>
              </label>
              <label className="text-sm">Taxes ($/mo)
                <input type="number" className="w-full border rounded p-2" value={s.taxesMonthly ?? 0} onChange={e=>update(i,{taxesMonthly:+e.target.value})}/>
              </label>
              <label className="text-sm">Insurance ($/mo)
                <input type="number" className="w-full border rounded p-2" value={s.insuranceMonthly ?? 0} onChange={e=>update(i,{insuranceMonthly:+e.target.value})}/>
              </label>
              <label className="text-sm">HOA ($/mo)
                <input type="number" className="w-full border rounded p-2" value={s.hoaMonthly ?? 0} onChange={e=>update(i,{hoaMonthly:+e.target.value})}/>
              </label>
              <label className="text-sm flex items-center gap-2">
                <input type="checkbox" checked={!!s.lockRate} onChange={e=>update(i,{lockRate:e.target.checked})}/> Lock Rate (no buydown)
              </label>
            </div>
            <p className="text-xs text-gray-500">Scenario tool — estimates only. No borrower PII.</p>
          </div>
        ))}
      </section>

      {!!results.length && (
        <section className="space-y-6">
          <div className="overflow-x-auto">
            <table className="min-w-full border text-sm">
              <thead>
                <tr className="bg-gray-50">
                  <th className="p-2 text-left">Metric</th>
                  {results.map((result, i)=>(<th key={i} className="p-2 text-left">{scenarios[i]?.name||`Option ${i+1}`}</th>))}
                </tr>
              </thead>
              <tbody>
                {metricRows.map(([label, format])=>(
                  <tr key={label}>
                    <td className="p-2 font-medium">{label}</td>
                    {results.map((r, i)=>(<td key={i} className="p-2">{format(r)}</td>))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {!!insights.length && (
            <div className="space-y-4 rounded-lg border bg-white p-4 shadow-sm">
              <header className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-black text-sm font-semibold uppercase tracking-tight text-white">AI</span>
                <div>
                  <h2 className="text-base font-semibold">Mortgage Expert Chatbot</h2>
                  <p className="text-xs text-gray-500">Pros and cons tailored to each scenario you just compared.</p>
                </div>
              </header>

              <div className="space-y-4">
                {insights.map(({ name, program, pros, cons }) => (
                  <div key={name + program} className="rounded-md border border-gray-200 bg-gray-50 p-3">
                    <h3 className="text-sm font-semibold">{name} <span className="font-normal text-gray-500">({program})</span></h3>
                    <div className="mt-2 grid gap-4 md:grid-cols-2">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-green-700">Pros</p>
                        <ul className="mt-1 list-disc space-y-1 pl-4 text-sm text-gray-700">
                          {pros.map((pro, index) => (
                            <li key={index}>{pro}</li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-red-700">Cons</p>
                        <ul className="mt-1 list-disc space-y-1 pl-4 text-sm text-gray-700">
                          {cons.map((con, index) => (
                            <li key={index}>{con}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <p className="text-xs text-gray-500">Assistant uses rules of thumb for illustration only—confirm with current pricing and underwriting.</p>
            </div>
          )}
        </section>
      )}
    </main>
  );
}
