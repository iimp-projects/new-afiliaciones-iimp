"use client";
/* eslint-disable @typescript-eslint/no-explicit-any -- contrato genérico de dropdowns y filtros de URL. */

import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import {
  Search,
  Filter,
  Trash2,
  ChevronDown,
  ArrowDownUp,
  X,
  UserRound,
  GraduationCap,
  ShieldCheck,
  CalendarDays,
  type LucideIcon,
} from "lucide-react";
import { AppSelect, type AppSelectOption } from "@/modules/shared/Components/Form";

const MODALIDADES = [
  { value: "ALL", label: "Todos los tipos" },
  { value: "ACTIVE", label: "Asociado Activo" },
  { value: "STUDENT", label: "Asociado Estudiante" },
  { value: "V", label: "Asociado Vitalicio" },
  { value: "H", label: "Asociado Honorario" },
  { value: "T", label: "Asociado Adherente" },
  { value: "X", label: "Separado" },
  { value: "R", label: "Renunciante" },
  { value: "U", label: "Anulado" },
  { value: "F", label: "Fallecido" },
];

const NON_VIGENTE_TYPES = ["X", "R", "U", "F"];

const ORDENAR_POR = [
  { value: "desc", label: "Más recientes" },
  { value: "asc", label: "Más antiguos" },
];

const GENEROS = [
  { value: "Todos", label: "Todos los géneros" },
  { value: "MALE", label: "Masculino" },
  { value: "FEMALE", label: "Femenino" },
  { value: "OTHER", label: "Otro" },
  { value: "PREFER_NOT_TO_SAY", label: "Prefiero no decirlo" },
];

const ESTADOS_CUENTA = [
  { value: "Todos", label: "Todos los estados" },
  { value: "ACTIVE", label: "Activo" },
  { value: "PENDING", label: "Pendiente" },
  { value: "INACTIVE", label: "Inactivo" },
  { value: "BLOCKED", label: "Bloqueado" },
];

const ADVANCED_DEFAULTS = {
  gender: "Todos",
  country: "Todos",
  university: "Todos",
  company: "Todos",
  status: "Todos",
  from: "",
  to: "",
};

type AdvancedKey = keyof typeof ADVANCED_DEFAULTS;
type AdvancedTabId = "persona" | "formacion" | "membresia" | "fechas";

const ADVANCED_KEYS = Object.keys(ADVANCED_DEFAULTS) as AdvancedKey[];

const ADVANCED_TABS: { id: AdvancedTabId; label: string; description: string; icon: LucideIcon; keys: AdvancedKey[] }[] = [
  { id: "persona", label: "Persona", description: "Sexo y país de residencia.", icon: UserRound, keys: ["gender", "country"] },
  { id: "formacion", label: "Formación y trabajo", description: "Universidad y empresa del asociado.", icon: GraduationCap, keys: ["university", "company"] },
  { id: "membresia", label: "Membresía", description: "Estado de la cuenta de acceso.", icon: ShieldCheck, keys: ["status"] },
  { id: "fechas", label: "Fechas", description: "Rango de última actualización.", icon: CalendarDays, keys: ["from", "to"] },
];

const isActiveValue = (value: string) => Boolean(value) && value !== "Todos";

const toSelectOptions = (options: { value: string; label: string }[]): AppSelectOption[] =>
  options.map((option) => ({ value: option.value, label: option.label }));

const CustomDropdown = ({ value, options, onChange, topLabel, className = "", heightClass = "h-10", disabled = false }: any) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) setIsOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedOption = options.find((option: any) => option.value === value) || options[0];

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {topLabel && (
        <span className="absolute -top-2 left-3 z-10 bg-white px-1 text-[10px] font-medium uppercase tracking-widest text-slate-400">
          {topLabel}
        </span>
      )}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className={`flex w-full ${heightClass} items-center justify-between rounded-xl border border-slate-200 bg-white pl-4 pr-10 text-sm font-medium text-slate-700 transition-all focus:border-[#C5A059] focus:outline-none focus:ring-1 focus:ring-[#C5A059] disabled:opacity-50`}
      >
        <span className="truncate">{selectedOption?.label || "Seleccionar"}</span>
        <ChevronDown size={16} className={`absolute right-3.5 transition-transform duration-300 ${isOpen ? "rotate-180 text-[#C5A059]" : "text-slate-400"}`} />
      </button>

      {isOpen && !disabled && (
        <div className="absolute left-0 top-full z-[100] mt-1.5 max-h-60 w-full overflow-y-auto rounded-xl border border-slate-100 bg-white py-1.5 shadow-xl animate-in fade-in zoom-in-95">
          {options.map((option: any) => (
            <button
              key={option.value}
              type="button"
              onClick={() => { onChange(option.value); setIsOpen(false); }}
              className={`w-full border-l-2 px-4 py-2.5 text-left text-sm font-medium transition-colors focus:outline-none ${
                value === option.value
                  ? "border-[#C5A059] bg-[#C5A059]/10 text-[#C5A059]"
                  : "border-transparent text-slate-600 hover:bg-[#fdfaf5] hover:text-[#C5A059]"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

function DateField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
      {label}
      <input
        type="date"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition focus:border-[#C5A059] focus:ring-1 focus:ring-[#C5A059]"
      />
    </label>
  );
}

export function AsociadosFilterBar({ total, currentQuery, currentType, currentSort }: { total: number; currentQuery: string; currentType: string; currentSort: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [searchTerm, setSearchTerm] = useState(currentQuery);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<AdvancedTabId>("persona");
  const [draft, setDraft] = useState({ ...ADVANCED_DEFAULTS });
  const [countries, setCountries] = useState<{ id: number; name: string }[]>([]);
  const [universities, setUniversities] = useState<{ id: number; name: string }[]>([]);
  const [companies, setCompanies] = useState<{ id: number; name: string }[]>([]);
  const [isLoadingOptions, setIsLoadingOptions] = useState(false);
  const [includeInactive, setIncludeInactive] = useState(false);

  useEffect(() => setIsMounted(true), []);

  const updateFilters = useCallback((name: string, value: string, mode: "push" | "replace" = "push") => {
    const params = new URLSearchParams(searchParams.toString());
    if (value && value !== "ALL" && value !== "") params.set(name, value);
    else params.delete(name);
    params.set("page", "1");
    const url = `${pathname}?${params.toString()}`;
    if (mode === "replace") router.replace(url);
    else router.push(url);
  }, [searchParams, pathname, router]);

  useEffect(() => {
    const trimmed = searchTerm.trim();
    if (trimmed === currentQuery) return;
    const timer = setTimeout(() => updateFilters("q", trimmed, "replace"), 400);
    return () => clearTimeout(timer);
  }, [searchTerm, currentQuery, updateFilters]);

  const advancedFromUrl = (): typeof ADVANCED_DEFAULTS => ({
    gender: searchParams.get("gender") ?? ADVANCED_DEFAULTS.gender,
    country: searchParams.get("country") ?? ADVANCED_DEFAULTS.country,
    university: searchParams.get("university") ?? ADVANCED_DEFAULTS.university,
    company: searchParams.get("company") ?? ADVANCED_DEFAULTS.company,
    status: searchParams.get("status") ?? ADVANCED_DEFAULTS.status,
    from: searchParams.get("from") ?? ADVANCED_DEFAULTS.from,
    to: searchParams.get("to") ?? ADVANCED_DEFAULTS.to,
  });

  const openAdvanced = () => {
    setDraft(advancedFromUrl());
    setIncludeInactive(searchParams.get("inactivos") === "1");
    setActiveTab("persona");
    setShowAdvanced(true);
    if (countries.length === 0) {
      setIsLoadingOptions(true);
      void Promise.all([
        fetch("/api/catalogs/countries").then((response) => response.json()),
        fetch("/api/catalogs/universities").then((response) => response.json()),
        fetch("/api/catalogs/companies").then((response) => response.json()),
      ]).then(([countryRows, universityRows, companyRows]) => {
        setCountries(countryRows);
        setUniversities(universityRows);
        setCompanies(companyRows);
      }).catch(() => undefined).finally(() => setIsLoadingOptions(false));
    }
  };

  const setAdvanced = (key: AdvancedKey, value: string) => setDraft((current) => ({ ...current, [key]: value }));

  const applyAdvanced = () => {
    const params = new URLSearchParams(searchParams.toString());
    for (const key of ADVANCED_KEYS) {
      if (isActiveValue(draft[key])) params.set(key, draft[key]);
      else params.delete(key);
    }
    if (includeInactive) params.set("inactivos", "1");
    else params.delete("inactivos");
    const type = params.get("type") ?? "";
    if (!includeInactive && NON_VIGENTE_TYPES.includes(type)) params.delete("type");
    params.set("page", "1");
    router.push(`${pathname}?${params.toString()}`);
    setShowAdvanced(false);
  };

  const changeType = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value && value !== "ALL") params.set("type", value);
    else params.delete("type");
    if (NON_VIGENTE_TYPES.includes(value)) params.set("inactivos", "1");
    params.set("page", "1");
    router.push(`${pathname}?${params.toString()}`);
  };

  const clearAll = () => {
    setSearchTerm("");
    router.push(pathname);
  };

  const hasActiveFilters = Boolean(searchParams.get("q")) || Boolean(searchParams.get("type")) || searchParams.has("inactivos") || ADVANCED_KEYS.some((key) => searchParams.has(key));
  const advancedActiveCount = ADVANCED_KEYS.filter((key) => searchParams.has(key)).length + (searchParams.get("inactivos") === "1" ? 1 : 0);
  const draftAdvancedCount = ADVANCED_KEYS.filter((key) => isActiveValue(draft[key])).length + (includeInactive ? 1 : 0);

  const countryOptions = [{ value: "Todos", label: "Todos los países" }, ...countries.map((item) => ({ value: String(item.id), label: item.name }))];
  const universityOptions = [{ value: "Todos", label: "Todas las universidades" }, ...universities.map((item) => ({ value: String(item.id), label: item.name }))];
  const companyOptions = [{ value: "Todos", label: "Todas las empresas" }, ...companies.map((item) => ({ value: String(item.id), label: item.name }))];

  const activeChips = ([
    { key: "gender" as AdvancedKey, label: "Sexo", options: GENEROS },
    { key: "country" as AdvancedKey, label: "País", options: countryOptions },
    { key: "university" as AdvancedKey, label: "Universidad", options: universityOptions },
    { key: "company" as AdvancedKey, label: "Empresa", options: companyOptions },
    { key: "status" as AdvancedKey, label: "Estado", options: ESTADOS_CUENTA },
    { key: "from" as AdvancedKey, label: "Desde", options: [] as { value: string; label: string }[] },
    { key: "to" as AdvancedKey, label: "Hasta", options: [] as { value: string; label: string }[] },
  ])
    .filter((chip) => isActiveValue(draft[chip.key]))
    .map((chip) => ({ ...chip, display: chip.options.find((option) => option.value === draft[chip.key])?.label ?? draft[chip.key] }));

  const activeTabConfig = ADVANCED_TABS.find((tab) => tab.id === activeTab) ?? ADVANCED_TABS[0];

  return (
    <div className="relative z-20 flex w-full flex-col">
      <div className="flex flex-col gap-4 px-5 py-4 xl:flex-row">
        <div className="relative w-full min-w-[200px] flex-1 xl:max-w-lg">
          <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por DNI, Nombre o Correo..."
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-12 pr-10 text-sm font-medium transition-all placeholder:text-slate-400 focus:border-[#C5A059] focus:outline-none focus:ring-1 focus:ring-[#C5A059]"
          />
          {searchTerm && (
            <button type="button" onClick={() => setSearchTerm("")} aria-label="Limpiar búsqueda" className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-600">
              <X size={14} strokeWidth={2.5} />
            </button>
          )}
        </div>

        <div className="flex w-full flex-wrap items-center gap-3 xl:w-auto">
          <CustomDropdown options={MODALIDADES} value={currentType} onChange={changeType} topLabel="Membresía" className="min-w-[190px] z-[50]" heightClass="h-11" />

          <button
            type="button"
            onClick={openAdvanced}
            className={`ml-auto flex h-11 items-center gap-2 rounded-xl border px-5 text-sm font-bold outline-none transition-all lg:ml-0 ${advancedActiveCount > 0 || showAdvanced ? "border-[#E8D09E] bg-[#fdfaf5] text-[#7f561e]" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}
          >
            <Filter size={16} /> Avanzados
            {advancedActiveCount > 0 && <span className="ml-1 flex h-5 w-5 items-center justify-center rounded-full bg-[#C5A059] text-[10px] text-white">{advancedActiveCount}</span>}
          </button>

          {hasActiveFilters && (
            <button type="button" onClick={clearAll} className="ml-auto flex h-11 items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 text-sm font-medium text-red-600 shadow-sm outline-none transition-all hover:bg-red-500 hover:text-white xl:ml-0">
              <Trash2 size={16} /> Limpiar
            </button>
          )}
        </div>
      </div>

      <div className="flex h-[46px] flex-row items-center justify-between rounded-b-2xl border-t border-slate-100 bg-slate-50/50 px-6 py-2.5">
        <span className="flex items-center gap-2 text-xs font-medium text-slate-500">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#C5A059]" />
          {total} asociado{total !== 1 ? "s" : ""} registrado{total !== 1 ? "s" : ""}
        </span>
        <div className="flex items-center gap-1.5 sm:gap-2">
          <span className="hidden items-center gap-1 text-[10px] font-medium uppercase tracking-widest text-slate-400 sm:flex">
            <ArrowDownUp size={12} /> Ordenar:
          </span>
          <div className="w-[140px] sm:w-[150px]">
            <CustomDropdown options={ORDENAR_POR} value={currentSort} onChange={(value: string) => updateFilters("sort", value)} heightClass="h-8 !border-none !bg-transparent !pl-0 !pr-6 text-right !text-slate-700 hover:!text-[#C5A059]" />
          </div>
        </div>
      </div>

      {isMounted && showAdvanced && createPortal(
        <div
          className="fixed inset-0 z-[999999] flex items-center justify-center bg-slate-950/70 p-3 backdrop-blur-md animate-in fade-in duration-200 sm:p-6"
          onMouseDown={(event) => { if (event.target === event.currentTarget) setShowAdvanced(false); }}
        >
          <div className="flex h-[92vh] max-h-[860px] w-full max-w-6xl flex-col overflow-hidden rounded-[26px] bg-white shadow-[0_30px_120px_-20px_rgba(15,23,42,0.6)] animate-in zoom-in-95 duration-300">
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[#ead9b8] bg-[#fbf4e7]">
                  <Filter size={20} className="text-[#b48a37]" />
                </div>
                <div>
                  <h2 className="text-lg font-black tracking-tight text-slate-900">Filtros avanzados</h2>
                  <p className="mt-1 text-xs font-medium text-slate-500">Encuentra asociados por persona, formación, membresía y fechas.</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {draftAdvancedCount > 0 && (
                  <span className="hidden items-center gap-1.5 rounded-full border border-[#ead9b8] bg-[#fbf4e7] px-3 py-1.5 text-[11px] font-bold text-[#7f561e] sm:inline-flex">
                    {draftAdvancedCount} filtro{draftAdvancedCount !== 1 ? "s" : ""} seleccionado{draftAdvancedCount !== 1 ? "s" : ""}
                  </span>
                )}
                <button onClick={() => setShowAdvanced(false)} className="rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700" aria-label="Cerrar filtros avanzados"><X size={18} /></button>
              </div>
            </div>

            <div className="flex min-h-0 flex-1 flex-col md:flex-row">
              <aside className="shrink-0 border-b border-slate-100 bg-gradient-to-b p-3 md:w-64 md:border-b-0 md:border-r md:from-slate-50 md:to-white md:p-4">
                <div className="flex gap-2 overflow-x-auto pb-1 md:flex-col md:overflow-visible md:pb-0">
                  {ADVANCED_TABS.map((tab) => {
                    const Icon = tab.icon;
                    const count = tab.keys.filter((key) => isActiveValue(draft[key])).length;
                    const selected = activeTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`group flex shrink-0 items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-all md:w-full ${selected ? "border-[#ead9b8] bg-white text-[#172a45] shadow-sm" : "border-transparent text-slate-500 hover:border-slate-200 hover:bg-white"}`}
                      >
                        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${selected ? "bg-[#fbf4e7] text-[#b48a37]" : "bg-slate-100 text-slate-400 group-hover:text-slate-600"}`}><Icon size={16} /></span>
                        <span className="min-w-0 flex-1">
                          <span className={`block truncate text-sm font-bold ${selected ? "text-[#172a45]" : "text-slate-600"}`}>{tab.label}</span>
                          <span className="hidden truncate text-[10px] font-medium text-slate-400 md:block">{tab.description}</span>
                        </span>
                        {count > 0 && <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#C5A059] text-[10px] font-black text-white">{count}</span>}
                      </button>
                    );
                  })}
                </div>
              </aside>

              <section className="flex min-h-0 flex-1 flex-col">
                <div className="px-6 pb-3 pt-5">
                  <h3 className="text-base font-black text-slate-900">{activeTabConfig.label}</h3>
                  <p className="mt-0.5 text-xs font-medium text-slate-500">{activeTabConfig.description}</p>
                </div>

                {(activeChips.length > 0 || includeInactive) && (
                  <div className="flex flex-wrap items-center gap-2 px-6 pb-3">
                    {includeInactive && (
                      <button onClick={() => setIncludeInactive(false)} className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold text-slate-600 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600" title="Ocultar no vigentes">
                        <span className="text-slate-400">No vigentes:</span>
                        <span>Incluidos</span>
                        <X size={12} />
                      </button>
                    )}
                    {activeChips.map((chip) => (
                      <button key={chip.key} onClick={() => setAdvanced(chip.key, ADVANCED_DEFAULTS[chip.key])} className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold text-slate-600 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600" title={`Quitar ${chip.label}`}>
                        <span className="text-slate-400">{chip.label}:</span>
                        <span className="max-w-[160px] truncate">{chip.display}</span>
                        <X size={12} />
                      </button>
                    ))}
                  </div>
                )}

                <div className="flex-1 overflow-y-auto px-6 pb-6">
                  {activeTab === "persona" && (
                    <div className="grid max-w-3xl grid-cols-1 gap-5 sm:grid-cols-2">
                      <AppSelect label="Sexo" value={draft.gender} options={toSelectOptions(GENEROS)} onChange={(value) => setAdvanced("gender", value)} searchable portal />
                      <AppSelect label="País de residencia" value={draft.country} options={toSelectOptions(countryOptions)} onChange={(value) => setAdvanced("country", value)} disabled={isLoadingOptions} searchable portal />
                    </div>
                  )}

                  {activeTab === "formacion" && (
                    <div className="grid max-w-4xl grid-cols-1 gap-5 sm:grid-cols-2">
                      <AppSelect label="Universidad / Institución" value={draft.university} options={toSelectOptions(universityOptions)} onChange={(value) => setAdvanced("university", value)} disabled={isLoadingOptions} searchable portal />
                      <AppSelect label="Empresa" value={draft.company} options={toSelectOptions(companyOptions)} onChange={(value) => setAdvanced("company", value)} disabled={isLoadingOptions} searchable portal />
                    </div>
                  )}

                  {activeTab === "membresia" && (
                    <div className="grid max-w-3xl grid-cols-1 gap-5 sm:grid-cols-2">
                      <AppSelect label="Estado de cuenta" value={draft.status} options={toSelectOptions(ESTADOS_CUENTA)} onChange={(value) => setAdvanced("status", value)} searchable portal />
                      <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:col-span-2">
                        <input type="checkbox" checked={includeInactive} onChange={(event) => setIncludeInactive(event.target.checked)} className="mt-0.5 h-4 w-4" />
                        <span>
                          <span className="block text-sm font-bold text-slate-700">Incluir no vigentes</span>
                          <span className="block text-xs font-medium text-slate-500">Muestra separados, renunciantes, anulados y fallecidos. Estos registros no tienen acceso al portal.</span>
                        </span>
                      </label>
                    </div>
                  )}

                  {activeTab === "fechas" && (
                    <div className="grid max-w-3xl grid-cols-1 gap-5 sm:grid-cols-2">
                      <DateField label="Desde" value={draft.from} onChange={(value) => setAdvanced("from", value)} />
                      <DateField label="Hasta" value={draft.to} onChange={(value) => setAdvanced("to", value)} />
                    </div>
                  )}

                  {isLoadingOptions && (
                    <p className="mt-5 flex items-center gap-2 text-[11px] font-semibold text-slate-400">
                      <span className="h-3 w-3 animate-spin rounded-full border-2 border-[#C5A059] border-t-transparent" />
                      Cargando opciones disponibles...
                    </p>
                  )}
                </div>
              </section>
            </div>

            <div className="flex flex-col items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/70 px-6 py-4 sm:flex-row">
              <button onClick={() => { setDraft({ ...ADVANCED_DEFAULTS }); setIncludeInactive(false); }} disabled={draftAdvancedCount === 0} className="flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-600 transition-all hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:pointer-events-none disabled:opacity-40 sm:w-auto">
                <Trash2 size={15} /> Limpiar selección
              </button>
              <div className="flex w-full items-center gap-3 sm:w-auto">
                <button onClick={() => setShowAdvanced(false)} className="h-10 flex-1 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-600 transition-all hover:bg-slate-100 sm:flex-none">Cancelar</button>
                <button onClick={applyAdvanced} className="flex h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-[#C5A059] px-6 text-sm font-black text-white shadow-md shadow-[#C5A059]/20 transition-all hover:bg-[#b08d47] sm:flex-none">
                  <Filter size={15} /> Aplicar filtros
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
