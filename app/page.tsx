"use client";
import { useCallback, useEffect, useState } from "react";
import type { LoanTemplate, ScenarioInput } from "@/types/mortgage";

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
  const [templates, setTemplates] = useState<LoanTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [templateError, setTemplateError] = useState<string|null>(null);
  const [templateMessage, setTemplateMessage] = useState<string|null>(null);
  const [savingTemplateIndex, setSavingTemplateIndex] = useState<number|null>(null);
  const [deletingTemplateId, setDeletingTemplateId] = useState<string|null>(null);

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

  const loadTemplates = useCallback(async ()=>{
    setTemplatesLoading(true);
    setTemplateError(null);
    try {
      const res = await fetch("/api/templates");
      const payload = await res.json().catch(()=>null);
      if (!res.ok) {
        throw new Error(getErrorMessage(payload, "Unable to load templates"));
      }
      setTemplates(Array.isArray(payload) ? payload : []);
    } catch (err) {
      setTemplateError(err instanceof Error ? err.message : "Unable to load templates");
    } finally {
      setTemplatesLoading(false);
    }
  }, []);

  useEffect(()=>{
    void loadTemplates();
  }, [loadTemplates]);

  async function saveTemplate(index: number){
    const scenario = scenarios[index];
    if (!scenario) return;

    const defaultTitle = scenario.name?.trim() || `${scenario.program} ${scenario.noteRate.toFixed(3)}%`;
    const input = window.prompt("Template title", defaultTitle);
    if (input === null) return;
    const title = input.trim();
    if (!title) {
      setTemplateError("Template title is required.");
      return;
    }

    setSavingTemplateIndex(index);
    setTemplateError(null);
    setTemplateMessage(null);

    try {
      const res = await fetch("/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, scenario }),
      });
      const payload = await res.json().catch(()=>null);
      if (!res.ok || !payload) {
        throw new Error(getErrorMessage(payload, "Failed to save template"));
      }
      const saved = payload as LoanTemplate;
      setTemplates(prev=>[saved, ...prev.filter(t=>t.id !== saved.id)]);
      setTemplateMessage(`Saved "${saved.title}" template.`);
    } catch (err) {
      setTemplateError(err instanceof Error ? err.message : "Failed to save template");
    } finally {
      setSavingTemplateIndex(null);
    }
  }

  async function deleteTemplate(id: string){
    const template = templates.find(t=>t.id === id);
    if (!template) return;
    if (!window.confirm(`Delete template "${template.title}"?`)) return;

    setDeletingTemplateId(id);
    setTemplateError(null);
    setTemplateMessage(null);

    try {
      const res = await fetch(`/api/templates/${id}`, { method: "DELETE" });
      if (!res.ok && res.status !== 204) {
        const payload = await res.json().catch(()=>null);
        throw new Error(getErrorMessage(payload, "Failed to delete template"));
      }
      setTemplates(prev=>prev.filter(t=>t.id !== id));
      setTemplateMessage(`Deleted "${template.title}" template.`);
    } catch (err) {
      setTemplateError(err instanceof Error ? err.message : "Failed to delete template");
    } finally {
      setDeletingTemplateId(null);
    }
  }

  function importTemplate(template: LoanTemplate){
    setTemplateError(null);
    setTemplateMessage(null);
    setScenarios(prev=>[...prev, templateToScenario(template, prev)]);
    setTemplateMessage(`Imported "${template.title}" into scenarios.`);
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

      <section className="rounded border p-4 space-y-3 bg-white">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Saved Templates</h2>
          <button className="px-3 py-1 text-sm border rounded" onClick={()=>void loadTemplates()} disabled={templatesLoading}>
            {templatesLoading ? "Loading..." : "Refresh"}
          </button>
        </div>
        {templateError && <p className="text-sm text-red-600">{templateError}</p>}
        {templateMessage && <p className="text-sm text-green-600">{templateMessage}</p>}
        {templatesLoading && !templates.length ? (
          <p className="text-sm text-gray-500">Loading templates...</p>
        ) : templates.length ? (
          <ul className="space-y-2">
            {templates.map(t=>(
              <li key={t.id} className="flex items-center justify-between rounded border p-3">
                <div>
                  <p className="font-medium">{t.title}</p>
                  <p className="text-xs text-gray-500">{t.program} - {t.noteRate.toFixed(3)}% rate</p>
                </div>
                <div className="flex items-center gap-2">
                  <button className="px-2 py-1 text-sm border rounded" onClick={()=>importTemplate(t)}>Import</button>
                  <button
                    className="px-2 py-1 text-sm border rounded text-red-600"
                    onClick={()=>deleteTemplate(t.id)}
                    disabled={deletingTemplateId === t.id}
                  >
                    {deletingTemplateId === t.id ? "Deleting..." : "Delete"}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-gray-500">No templates saved yet.</p>
        )}
      </section>

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
            <p className="text-xs text-gray-500">Scenario tool ? estimates only. No borrower PII.</p>
            <div className="flex justify-end">
              <button
                type="button"
                className="px-3 py-1 text-sm border rounded"
                onClick={()=>saveTemplate(i)}
                disabled={savingTemplateIndex === i}
              >
                {savingTemplateIndex === i ? "Saving..." : "Save as Template"}
              </button>
            </div>
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
                ["? To Points", (r:any)=> `$${r.appliedToPoints.toLocaleString()}`],
                ["? To Costs", (r:any)=> `$${r.appliedToCosts.toLocaleString()}`],
                ["Cash to Close (est)", (r:any)=> `$${r.cashToClose.toLocaleString()}`],
                ["Pts Break-Even (mo)", (r:any)=> r.breakEvenMonthsOnPoints ?? "?"],
                ["Warnings", (r:any)=> (r.warnings||[]).join("; ") || "?"],
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

function templateToScenario(template: LoanTemplate, existing: ScenarioInput[]): ScenarioInput {
  const name = deriveUniqueName(template.title, existing);

  return {
    name,
    price: template.price,
    ltv: template.ltv ?? undefined,
    loanAmount: template.loanAmount ?? undefined,
    program: template.program,
    termMonths: template.termMonths,
    noteRate: template.noteRate,
    discountPointsPct: template.discountPointsPct,
    closingCosts: template.closingCosts,
    sellerCredit: template.sellerCredit,
    pmiType: template.pmiType ?? undefined,
    pmiAnnualFactor: template.pmiAnnualFactor ?? undefined,
    taxesMonthly: template.taxesMonthly ?? undefined,
    insuranceMonthly: template.insuranceMonthly ?? undefined,
    hoaMonthly: template.hoaMonthly ?? undefined,
    lockRate: template.lockRate ?? false,
  };
}

function deriveUniqueName(base: string, existing: ScenarioInput[]): string {
  const fallback = "Imported Option";
  const trimmed = base.trim() || fallback;
  const existingNames = new Set(
    existing
      .map(s => (s.name ?? "").trim())
      .filter(Boolean),
  );
  if (!existingNames.has(trimmed)) return trimmed;
  let counter = 2;
  let candidate = `${trimmed} (${counter})`;
  while (existingNames.has(candidate)) {
    counter += 1;
    candidate = `${trimmed} (${counter})`;
  }
  return candidate;
}

function getErrorMessage(payload: any, fallback: string): string {
  if (!payload) return fallback;
  if (typeof payload === "string") return payload;
  if (typeof payload.error === "string") return payload.error;
  if (typeof payload.message === "string") return payload.message;
  if (payload.error && typeof payload.error === "object") {
    const errors = Array.isArray(payload.error._errors) ? payload.error._errors : [];
    if (errors.length) return errors.join(", ");
  }
  return fallback;
}
