"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CalendarDays, Filter, Search, ShieldCheck, Trash2, Wallet, X, type LucideIcon } from "lucide-react";
import { AppSelect } from "@/modules/shared/Components/Form";
import { QUOTA_CONCEPTS, QUOTA_CURRENCIES } from "./quotaUi";

export type QuotaFilterValues = Record<string, string>;

const PRIMARY_KEYS = ["search", "category", "financialStatus"] as const;
const ADVANCED_KEYS = ["membershipStatus", "year", "yearFrom", "yearTo", "currency", "concept", "accountingStatus", "pendingMin", "pendingMax", "hasIncidences", "sort", "direction"] as const;
type AdvancedKey = (typeof ADVANCED_KEYS)[number];
type AdvancedDraft = Record<AdvancedKey, string>;

const categoryOptions = [
  { value: "A", label: "Activo" },
  { value: "E", label: "Estudiante" },
  { value: "F", label: "Fallecido" },
  { value: "H", label: "Honorario" },
  { value: "R", label: "Renunciante" },
  { value: "T", label: "Adherente" },
  { value: "U", label: "Anulado" },
  { value: "V", label: "Vitalicio" },
  { value: "X", label: "Separado" },
];

const financialStatusOptions = [
  { value: "WITH_INFO", label: "Con información" },
  { value: "NO_INFO", label: "Sin información" },
  { value: "NOT_FOUND", label: "No encontrado en SIE" },
  { value: "FAILED", label: "Con incidencia" },
];

const membershipOptions = [
  { value: "ACTIVE", label: "Activo" },
  { value: "STUDENT", label: "Estudiante" },
  { value: "Fallecido", label: "Fallecido" },
  { value: "Honorario", label: "Honorario" },
  { value: "Renunciante", label: "Renunciante" },
  { value: "Adherente", label: "Adherente" },
  { value: "Anulado", label: "Anulado" },
  { value: "Vitalicio", label: "Vitalicio" },
  { value: "Separado", label: "Separado" },
];

const sortOptions = [
  { value: "name", label: "Nombre" },
  { value: "institutionalCode", label: "Código institucional" },
  { value: "pendingPen", label: "Pendiente PEN" },
  { value: "pendingUsd", label: "Pendiente USD" },
  { value: "pendingCount", label: "Cantidad pendiente" },
  { value: "lastSync", label: "Última sincronización" },
];

const categorySelectOptions = [{ value: "", label: "Todas las categorías" }, ...categoryOptions];
const financialSelectOptions = [{ value: "", label: "Todo estado financiero" }, ...financialStatusOptions];
const membershipSelectOptions = [{ value: "", label: "Todos" }, ...membershipOptions];
const currencySelectOptions = [{ value: "", label: "Todas las monedas" }, ...QUOTA_CURRENCIES.map((currency) => ({ value: currency, label: currency === "S/" ? "Soles (PEN)" : "Dólares (USD)" }))];
const conceptSelectOptions = (defaultConcept: string) => [...(defaultConcept === "" ? [{ value: "", label: "Todos los conceptos" }] : []), ...QUOTA_CONCEPTS.map((option) => ({ value: option.value, label: option.label }))];
const accountingStatusSelectOptions = [{ value: "", label: "Todos" }, { value: "FACTURADO", label: "Facturado" }, { value: "PENDIENTE", label: "Pendiente" }];
const hasIncidencesSelectOptions = [{ value: "", label: "Todas" }, { value: "true", label: "Solo con incidencias" }];
const directionSelectOptions = [{ value: "asc", label: "Ascendente" }, { value: "desc", label: "Descendente" }];

type AdvancedTabId = "periodo" | "financiero" | "cobertura";
const ADVANCED_TABS: Array<{ id: AdvancedTabId; label: string; description: string; icon: LucideIcon; keys: AdvancedKey[] }> = [
  { id: "periodo", label: "Período", description: "Año exacto o rango de años.", icon: CalendarDays, keys: ["year", "yearFrom", "yearTo"] },
  { id: "financiero", label: "Financiero", description: "Moneda, concepto, estado contable e importes.", icon: Wallet, keys: ["currency", "concept", "accountingStatus", "pendingMin", "pendingMax"] },
  { id: "cobertura", label: "Cobertura y orden", description: "Membresía, incidencias y orden del listado.", icon: ShieldCheck, keys: ["membershipStatus", "hasIncidences", "sort", "direction"] },
];

const defaultsFor = (concept: string): QuotaFilterValues => (concept ? { concept } : {});

function advancedDefaults(defaultConcept: string): AdvancedDraft {
  return { membershipStatus: "", year: "", yearFrom: "", yearTo: "", currency: "", concept: defaultConcept, accountingStatus: "", pendingMin: "", pendingMax: "", hasIncidences: "", sort: "name", direction: "asc" };
}

export function serializeFilters(values: QuotaFilterValues): string {
  return JSON.stringify(Object.fromEntries(Object.entries(values).filter(([, value]) => value !== "").sort(([a], [b]) => a.localeCompare(b))));
}

function serializePrimary(values: QuotaFilterValues): string {
  return JSON.stringify(Object.fromEntries(PRIMARY_KEYS.filter((key) => values[key]).map((key) => [key, values[key]]).sort(([a], [b]) => a.localeCompare(b))));
}

function isDefaultAdvanced(key: AdvancedKey, value: string, defaultConcept: string): boolean {
  if (key === "concept") return !value || value === defaultConcept;
  if (key === "sort") return !value || value === "name";
  if (key === "direction") return !value || value === "asc";
  return !value;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1.5 block text-[11px] font-semibold text-[#504539]">{label}</span>{children}</label>;
}

const inputClass = "h-10 w-full rounded-lg border border-[#E4E2E0] bg-white px-3 text-sm font-medium text-slate-700 outline-none transition focus:border-[#C39254] focus:ring-2 focus:ring-[#C39254]/15";

function labelFor(key: AdvancedKey, value: string): string {
  if (key === "membershipStatus") return membershipOptions.find((option) => option.value === value)?.label ?? value;
  if (key === "concept") return QUOTA_CONCEPTS.find((option) => option.value === value)?.label ?? value;
  if (key === "accountingStatus") return value === "FACTURADO" ? "Facturado" : value === "PENDIENTE" ? "Pendiente" : value;
  if (key === "currency") return value === "S/" ? "Soles (PEN)" : value === "US$" ? "Dólares (USD)" : value;
  if (key === "hasIncidences") return "Solo con incidencias";
  if (key === "sort") return sortOptions.find((option) => option.value === value)?.label ?? value;
  if (key === "direction") return value === "desc" ? "Descendente" : "Ascendente";
  return value;
}

type Props = {
  values: QuotaFilterValues;
  loading?: boolean;
  onApply: (values: QuotaFilterValues) => void;
  onClear: () => void;
  showConcept?: boolean;
  defaultConcept?: string;
};

export function QuotasFilterBar({ values, loading = false, onApply, onClear, showConcept = true, defaultConcept = "CUOTA" }: Props) {
  const [draft, setDraft] = useState<QuotaFilterValues>({ ...defaultsFor(defaultConcept), ...values });
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [activeTab, setActiveTab] = useState<AdvancedTabId>("periodo");
  const [advancedDraft, setAdvancedDraft] = useState<AdvancedDraft>(() => advancedDefaults(defaultConcept));
  const [mounted, setMounted] = useState(false);
  const firstApply = useRef(true);
  const appliedSerialized = serializeFilters(values);
  const appliedPrimary = serializePrimary(values);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    setDraft((current) => serializeFilters(current) === appliedSerialized ? current : { ...defaultsFor(defaultConcept), ...values });
  }, [appliedSerialized, values, defaultConcept]);

  useEffect(() => {
    if (firstApply.current) { firstApply.current = false; return; }
    if (serializePrimary(draft) === appliedPrimary) return;
    const timer = window.setTimeout(() => onApply(draft), 420);
    return () => window.clearTimeout(timer);
  }, [draft, appliedPrimary, onApply]);

  useEffect(() => {
    if (!showAdvanced) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setShowAdvanced(false); };
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = previous; document.removeEventListener("keydown", onKey); };
  }, [showAdvanced]);

  const setPrimary = (key: string, value: string) => setDraft((current) => ({ ...current, [key]: value }));
  const advancedCount = ADVANCED_KEYS.filter((key) => !isDefaultAdvanced(key, values[key] ?? "", defaultConcept)).length;
  const draftAdvancedCount = ADVANCED_KEYS.filter((key) => !isDefaultAdvanced(key, advancedDraft[key], defaultConcept)).length;
  const activeTabConfig = ADVANCED_TABS.find((tab) => tab.id === activeTab) ?? ADVANCED_TABS[0];

  const openAdvanced = () => {
    const next = advancedDefaults(defaultConcept);
    for (const key of ADVANCED_KEYS) {
      const current = values[key];
      if (current != null) next[key] = current;
    }
    setAdvancedDraft(next);
    setActiveTab("periodo");
    setShowAdvanced(true);
  };

  const setAdvanced = (key: AdvancedKey, value: string) => setAdvancedDraft((current) => ({ ...current, [key]: value }));

  const applyAdvanced = () => {
    const merged: QuotaFilterValues = { ...draft };
    for (const key of ADVANCED_KEYS) {
      if (isDefaultAdvanced(key, advancedDraft[key], defaultConcept)) delete merged[key];
      else merged[key] = advancedDraft[key];
    }
    onApply(merged);
    setShowAdvanced(false);
  };

  const clearAll = () => {
    setDraft(defaultsFor(defaultConcept));
    setAdvancedDraft(advancedDefaults(defaultConcept));
    onClear();
  };

  const activeChips = ADVANCED_KEYS
    .filter((key) => !isDefaultAdvanced(key, advancedDraft[key], defaultConcept))
    .map((key) => ({ key, label: labelFor(key, advancedDraft[key]), value: advancedDraft[key] }));

  return <div className="relative z-20 w-full">
    <div className="flex flex-col gap-3 px-5 py-3 xl:flex-row xl:items-center">
      <div className="flex flex-1 flex-wrap items-center gap-3">
        <label className="relative block min-w-[220px] flex-1 xl:max-w-lg">
          <span className="sr-only">Buscar asociado</span>
          <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={draft.search ?? ""} onChange={(event) => setPrimary("search", event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") onApply(draft); }} placeholder="Buscar por nombre, documento o código institucional" className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-10 text-sm font-medium text-slate-700 outline-none transition-all placeholder:text-slate-400 focus:border-[#C5A059] focus:ring-1 focus:ring-[#C5A059]" />
          {draft.search ? <button type="button" aria-label="Limpiar búsqueda" onClick={() => setPrimary("search", "")} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-400 hover:bg-slate-200"><X size={14} /></button> : null}
        </label>
        <AppSelect aria-label="Categoría" value={draft.category ?? ""} options={categorySelectOptions} onChange={(value) => setPrimary("category", value)} searchable portal className="min-w-[160px] flex-1 sm:flex-none" />
        <AppSelect aria-label="Estado financiero" value={draft.financialStatus ?? ""} options={financialSelectOptions} onChange={(value) => setPrimary("financialStatus", value)} searchable portal className="min-w-[180px] flex-1 sm:flex-none" />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={openAdvanced} className={`relative flex h-10 items-center gap-2 rounded-xl border px-4 text-sm font-semibold transition-colors ${advancedCount > 0 || showAdvanced ? "border-[#E8D09E] bg-[#FDFBF8] text-[#7F561E]" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}>
          <Filter size={16} /> Avanzados
          {advancedCount > 0 && <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#C5A059] text-[10px] font-bold text-white">{advancedCount}</span>}
        </button>
        <button type="button" onClick={() => onApply(draft)} disabled={loading} className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-[#C5A059] px-4 text-xs font-bold text-white shadow-sm transition-colors hover:bg-[#A3722A] disabled:opacity-60"><Filter size={14} /> Aplicar</button>
        <button type="button" onClick={clearAll} disabled={loading} className="flex h-10 items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 text-sm font-semibold text-red-600 shadow-sm transition-all hover:bg-red-500 hover:text-white disabled:opacity-50"><Trash2 size={16} /> Limpiar</button>
      </div>
    </div>

    {mounted && showAdvanced && createPortal(<div className="fixed inset-0 z-[999999] flex items-center justify-center bg-slate-950/65 p-3 backdrop-blur-sm sm:p-6" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowAdvanced(false); }}>
      <section role="dialog" aria-modal="true" aria-label="Filtros avanzados de cuotas" className="flex h-[92vh] max-h-[720px] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-[#E4E2E0] bg-white shadow-[0_30px_120px_-20px_rgba(15,23,42,0.55)]">
        <header className="flex items-start justify-between gap-4 border-b border-[#F1F0EE] px-6 py-5">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#FDFBF8] text-[#A3722A]"><Filter size={20} /></span>
            <div><h2 className="text-lg font-semibold tracking-tight text-[#1a1c1c]">Filtros avanzados</h2><p className="mt-1 text-xs font-medium text-[#5F5E5D]">Acota el listado por período, información financiera y cobertura.</p></div>
          </div>
          <div className="flex items-center gap-3">
            {draftAdvancedCount > 0 && <span className="hidden rounded-full border border-[#E8D09E] bg-[#FDFBF8] px-3 py-1.5 text-[11px] font-semibold text-[#7F561E] sm:inline-flex">{draftAdvancedCount} filtro{draftAdvancedCount === 1 ? "" : "s"} seleccionado{draftAdvancedCount === 1 ? "" : "s"}</span>}
            <button type="button" onClick={() => setShowAdvanced(false)} aria-label="Cerrar filtros avanzados" className="rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"><X size={18} /></button>
          </div>
        </header>
        <div className="flex min-h-0 flex-1 flex-col md:flex-row">
          <aside className="shrink-0 border-b border-[#F1F0EE] bg-[#FAFAF8] p-3 md:w-60 md:border-b-0 md:border-r">
            <div className="flex gap-2 overflow-x-auto md:flex-col md:overflow-visible">
              {ADVANCED_TABS.map((tab) => {
                const Icon = tab.icon;
                const count = tab.keys.filter((key) => !isDefaultAdvanced(key, advancedDraft[key], defaultConcept)).length;
                const selected = activeTab === tab.id;
                return <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)} className={`flex shrink-0 items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors md:w-full ${selected ? "border-[#E8D09E] bg-white text-[#7F561E] shadow-sm" : "border-transparent text-slate-500 hover:border-[#E4E2E0] hover:bg-white"}`}>
                  <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${selected ? "bg-[#FDFBF8] text-[#A3722A]" : "bg-slate-100 text-slate-400"}`}><Icon size={16} /></span>
                  <span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{tab.label}</span><span className="hidden text-[10px] font-medium text-slate-400 md:block">{tab.description}</span></span>
                  {count > 0 && <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#C5A059] text-[10px] font-bold text-white">{count}</span>}
                </button>;
              })}
            </div>
          </aside>
          <section className="flex min-h-0 flex-1 flex-col">
            <div className="px-6 pb-2 pt-5"><h3 className="text-base font-semibold text-[#1a1c1c]">{activeTabConfig.label}</h3><p className="mt-0.5 text-xs font-medium text-[#5F5E5D]">{activeTabConfig.description}</p></div>
            {activeChips.length > 0 && <div className="flex flex-wrap gap-2 px-6 pb-3">{activeChips.map((chip) => <button key={chip.key} type="button" onClick={() => setAdvanced(chip.key, advancedDefaults(defaultConcept)[chip.key])} className="inline-flex items-center gap-1.5 rounded-md border border-[#E4E2E0] bg-[#F9F9F9] px-2.5 py-1 text-[11px] font-semibold text-slate-600 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600" title={`Quitar ${chip.label}`}><span className="max-w-[180px] truncate">{chip.label}: {chip.value}</span><X size={12} /></button>)}</div>}
            <div className="flex-1 overflow-y-auto px-6 pb-6">
              {activeTab === "periodo" && <div className="grid max-w-3xl grid-cols-1 gap-4 sm:grid-cols-3">
                <Field label="Año exacto"><input type="number" min={1900} max={2100} value={advancedDraft.year} onChange={(event) => setAdvanced("year", event.target.value)} className={inputClass} /></Field>
                <Field label="Desde año"><input type="number" min={1900} max={2100} value={advancedDraft.yearFrom} onChange={(event) => setAdvanced("yearFrom", event.target.value)} className={inputClass} /></Field>
                <Field label="Hasta año"><input type="number" min={1900} max={2100} value={advancedDraft.yearTo} onChange={(event) => setAdvanced("yearTo", event.target.value)} className={inputClass} /></Field>
              </div>}
              {activeTab === "financiero" && <div className="grid max-w-4xl grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Moneda"><AppSelect aria-label="Moneda" value={advancedDraft.currency} options={currencySelectOptions} onChange={(value) => setAdvanced("currency", value)} searchable portal className="mt-1" /></Field>
                {showConcept && <Field label="Concepto"><AppSelect aria-label="Concepto" value={advancedDraft.concept} options={conceptSelectOptions(defaultConcept)} onChange={(value) => setAdvanced("concept", value)} searchable portal className="mt-1" /></Field>}
                <Field label="Estado contable"><AppSelect aria-label="Estado contable" value={advancedDraft.accountingStatus} options={accountingStatusSelectOptions} onChange={(value) => setAdvanced("accountingStatus", value)} searchable portal className="mt-1" /></Field>
                <div />
                <Field label="Importe pendiente mínimo"><input type="number" min={0} step="0.01" value={advancedDraft.pendingMin} onChange={(event) => setAdvanced("pendingMin", event.target.value)} className={inputClass} /></Field>
                <Field label="Importe pendiente máximo"><input type="number" min={0} step="0.01" value={advancedDraft.pendingMax} onChange={(event) => setAdvanced("pendingMax", event.target.value)} className={inputClass} /></Field>
              </div>}
              {activeTab === "cobertura" && <div className="grid max-w-3xl grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Estado de membresía"><AppSelect aria-label="Estado de membresía" value={advancedDraft.membershipStatus} options={membershipSelectOptions} onChange={(value) => setAdvanced("membershipStatus", value)} searchable portal className="mt-1" /></Field>
                <Field label="Incidencias"><AppSelect aria-label="Incidencias" value={advancedDraft.hasIncidences} options={hasIncidencesSelectOptions} onChange={(value) => setAdvanced("hasIncidences", value)} searchable portal className="mt-1" /></Field>
                <Field label="Ordenar por"><AppSelect aria-label="Ordenar por" value={advancedDraft.sort} options={sortOptions} onChange={(value) => setAdvanced("sort", value)} searchable portal className="mt-1" /></Field>
                <Field label="Dirección"><AppSelect aria-label="Dirección" value={advancedDraft.direction} options={directionSelectOptions} onChange={(value) => setAdvanced("direction", value)} searchable portal className="mt-1" /></Field>
              </div>}
            </div>
          </section>
        </div>
        <footer className="flex flex-col gap-3 border-t border-[#F1F0EE] bg-[#FAFAF8] px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <button type="button" onClick={() => setAdvancedDraft(advancedDefaults(defaultConcept))} disabled={draftAdvancedCount === 0} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-[#E4E2E0] bg-white px-4 text-sm font-semibold text-slate-600 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:pointer-events-none disabled:opacity-40"><Trash2 size={15} /> Limpiar selección</button>
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => setShowAdvanced(false)} className="h-10 flex-1 rounded-lg border border-[#E4E2E0] bg-white px-4 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-100 sm:flex-none">Cancelar</button>
            <button type="button" onClick={applyAdvanced} className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-lg bg-[#C5A059] px-6 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#A3722A] sm:flex-none"><Filter size={15} /> Aplicar filtros</button>
          </div>
        </footer>
      </section>
    </div>, document.body)}
  </div>;
}
