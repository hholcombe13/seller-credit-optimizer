"use client";
import { useState } from "react";
import type { ScenarioInput } from "@/types/mortgage";

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
  const [results, setResults] = useState<any[]>([]);

  async function compare(){
    const res = await fetch("/api/compare", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(scenarios)
    });
    setResults(await res.json());
  }

  function update(i:number, patch:Partial<ScenarioInput>){
    setScenarios(prev=>{
      const next=[...prev]; next[i] = {...next[i], ...patch}; return next;
    });
  }

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
                {results.map((_:any,i:number)=>(<th key={i} className="p-2 text-left">{scenarios[i]?.name||`Option ${i+1}`}</th>))}
              </tr>
            </thead>
            <tbody>
              {[
                ["APR (est)", (r:any)=> `${r.aprEstimate.toFixed(3)}%`],
                ["Loan Amount", (r:any)=> `$${r.loanAmount.toLocaleString()}`],
                ["P&I", (r:any)=> `$${r.pAndI.toLocaleString()}`],
                ["PMI", (r:any)=> `$${r.pmiMonthly.toLocaleString()}`],
                ["PITI", (r:any)=> `$${r.pitiMonthly.toLocaleString()}`],
                ["Applied Seller Credit", (r:any)=> `$${r.appliedSellerCredit.toLocaleString()}`],
                ["→ To Points", (r:any)=> `$${r.appliedToPoints.toLocaleString()}`],
                ["→ To Costs", (r:any)=> `$${r.appliedToCosts.toLocaleString()}`],
                ["Cash to Close (est)", (r:any)=> `$${r.cashToClose.toLocaleString()}`],
                ["Pts Break-Even (mo)", (r:any)=> r.breakEvenMonthsOnPoints ?? "—"],
                ["Warnings", (r:any)=> (r.warnings||[]).join("; ") || "—"],
              ].map(([label, fmt])=>(
                <tr key={label as string}>
                  <td className="p-2 font-medium">{label}</td>
                  {results.map((r:any,i:number)=>(<td key={i} className="p-2">{(fmt as any)(r)}</td>))}
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </main>
  );
}
