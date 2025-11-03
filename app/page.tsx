"use client";
import { Fragment, useState } from "react";
import type { ScenarioInput, ScenarioOutput } from "@/types/mortgage";

function formatCurrency(value: number | undefined, fractionDigits = 2){
  if (value == null || Number.isNaN(value)) return "—";
  return `$${value.toLocaleString(undefined, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits
  })}`;
}

function formatPercent(value: number | undefined, fractionDigits = 3){
  if (value == null || Number.isNaN(value)) return "—";
  return `${value.toFixed(fractionDigits)}%`;
}

function formatNumber(value: number | undefined, options?: { fractionDigits?: number; suffix?: string }){
  if (value == null || Number.isNaN(value)) return "—";
  const fractionDigits = options?.fractionDigits ?? 0;
  const suffix = options?.suffix ?? "";
  return `${value.toLocaleString(undefined, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits
  })}${suffix}`;
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

  async function compare(){
    const res = await fetch("/api/compare", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(scenarios)
    });
    const data: ScenarioOutput[] = await res.json();
    setResults(data);
  }

  function update(i:number, patch:Partial<ScenarioInput>){
    setScenarios(prev=>{
      const next=[...prev]; next[i] = {...next[i], ...patch}; return next;
    });
  }

  const sections: Array<{
    title: string;
    rows: Array<{ label: string; formatter: (scenario: ScenarioInput | undefined, result: ScenarioOutput | undefined) => string }>;
  }> = [
    {
      title: "Scenario Overview",
      rows: [
        {
          label: "Purchase Price",
          formatter: (s)=> formatCurrency(s?.price, 0)
        },
        {
          label: "Program",
          formatter: (s)=> s?.program ?? "—"
        },
        {
          label: "LTV",
          formatter: (s, r)=>{
            const ratio = typeof s?.ltv === "number"
              ? s.ltv * 100
              : (s?.price && r?.loanAmount ? (r.loanAmount / s.price) * 100 : undefined);
            return typeof ratio === "number" ? formatPercent(ratio, 2) : "—";
          }
        },
        {
          label: "Loan Amount",
          formatter: (_s, r)=> formatCurrency(r?.loanAmount, 0)
        },
        {
          label: "Down Payment",
          formatter: (s, r)=>{
            if (!s?.price) return "—";
            const loan = r?.loanAmount ?? s.loanAmount;
            if (loan == null) return "—";
            const down = s.price - loan;
            return formatCurrency(down, 0);
          }
        },
        {
          label: "Term",
          formatter: (s)=>{
            if (!s?.termMonths) return "—";
            const years = s.termMonths / 12;
            return `${formatNumber(s.termMonths, { suffix: " mo" })} (${years.toFixed(1)} yr)`;
          }
        },
        {
          label: "Note Rate",
          formatter: (s)=> formatPercent(s?.noteRate, 3)
        },
        {
          label: "Effective Rate",
          formatter: (_s, r)=> formatPercent(r?.finalRate, 3)
        },
        {
          label: "Discount Points",
          formatter: (s)=> formatPercent(s?.discountPointsPct, 3)
        },
        {
          label: "Points Cost",
          formatter: (_s, r)=> formatCurrency(r?.pointsCost)
        },
        {
          label: "Closing Costs",
          formatter: (s)=> formatCurrency(s?.closingCosts)
        },
        {
          label: "Seller Credit",
          formatter: (s)=> formatCurrency(s?.sellerCredit)
        },
        {
          label: "PMI Type",
          formatter: (s)=> s?.pmiType ?? "—"
        },
        {
          label: "PMI Annual Factor",
          formatter: (s)=>{
            if (s?.pmiAnnualFactor == null) return "—";
            return formatPercent(s.pmiAnnualFactor * 100, 2);
          }
        },
        {
          label: "Lock Rate",
          formatter: (s)=> s?.lockRate ? "Yes" : "No"
        }
      ]
    },
    {
      title: "Recurring Costs",
      rows: [
        {
          label: "Principal & Interest",
          formatter: (_s, r)=> formatCurrency(r?.pAndI)
        },
        {
          label: "PMI",
          formatter: (_s, r)=> formatCurrency(r?.pmiMonthly)
        },
        {
          label: "Taxes",
          formatter: (s)=> formatCurrency(s?.taxesMonthly)
        },
        {
          label: "Insurance",
          formatter: (s)=> formatCurrency(s?.insuranceMonthly)
        },
        {
          label: "HOA",
          formatter: (s)=> formatCurrency(s?.hoaMonthly)
        },
        {
          label: "Total PITI",
          formatter: (_s, r)=> formatCurrency(r?.pitiMonthly)
        }
      ]
    },
    {
      title: "Credits & Closing",
      rows: [
        {
          label: "Applied Seller Credit",
          formatter: (_s, r)=> formatCurrency(r?.appliedSellerCredit)
        },
        {
          label: "→ To Points",
          formatter: (_s, r)=> formatCurrency(r?.appliedToPoints)
        },
        {
          label: "→ To Costs",
          formatter: (_s, r)=> formatCurrency(r?.appliedToCosts)
        },
        {
          label: "Cash to Close",
          formatter: (_s, r)=> formatCurrency(r?.cashToClose)
        },
        {
          label: "APR (est)",
          formatter: (_s, r)=> formatPercent(r?.aprEstimate, 3)
        },
        {
          label: "Pts Break-Even (mo)",
          formatter: (_s, r)=> r?.breakEvenMonthsOnPoints != null ? formatNumber(r.breakEvenMonthsOnPoints, { suffix: " mo" }) : "—"
        },
        {
          label: "Warnings",
          formatter: (_s, r)=> r?.warnings?.length ? r.warnings.join("; ") : "—"
        }
      ]
    }
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
                <select className="w-full border rounded p-2" value={s.program} onChange={e=>update(i,{program:e.target.value as any})}>
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
                <select className="w-full border rounded p-2" value={s.pmiType} onChange={e=>update(i,{pmiType:e.target.value as any})}>
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
        <section className="overflow-x-auto">
          <table className="min-w-full border text-sm">
            <thead>
              <tr className="bg-gray-50">
                <th className="p-2 text-left">Metric</th>
                {results.map((_,i)=>(<th key={i} className="p-2 text-left">{scenarios[i]?.name||`Option ${i+1}`}</th>))}
              </tr>
            </thead>
            <tbody>
              {sections.map(section=>(
                <Fragment key={section.title}>
                  <tr className="bg-gray-100">
                    <td className="p-2 font-semibold" colSpan={1 + results.length}>{section.title}</td>
                  </tr>
                  {section.rows.map(row=>(
                    <tr key={row.label}>
                      <td className="p-2 font-medium">{row.label}</td>
                      {results.map((result, i)=>{
                        const scenario = scenarios[i];
                        return (
                          <td key={i} className="p-2">
                            {row.formatter(scenario, result)}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </main>
  );
}
