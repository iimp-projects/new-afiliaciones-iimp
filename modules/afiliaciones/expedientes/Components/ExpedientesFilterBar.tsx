"use client";

import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  Search,
  Filter,
  Trash2,
  ChevronDown,
  ArrowDownUp,
  X,
  Settings,
  UserRound,
  GraduationCap,
  ShieldCheck,
  CalendarDays,
  type LucideIcon,
} from "lucide-react";
import { AppSelect, type AppSelectOption } from "@/modules/shared/Components/Form";

interface ExpedientesFilterBarProps {
  filters: any;
  onFilterChange: (key: string, value: string) => void;
  totalResults: number;
}

const ESTADOS_GENERALES = [
  { value: "Todos", label: "Todos los estados" },
  { value: "PENDING", label: "Pendiente" },
  { value: "UNDER_EVALUACION", label: "En Evaluación" },
  { value: "OBSERVED", label: "Observado" },
  { value: "RESOLVED", label: "Subsanado" },
  { value: "READY_FOR_PAYMENT", label: "Apto para Pago" },
  { value: "COMPLETED", label: "Completado" },
  { value: "REJECTED", label: "Rechazado" },
];

const MODALIDADES = [
  { value: "Todos", label: "Todas las modalidades" },
  { value: "ACTIVE", label: "Asociado Activo" },
  { value: "STUDENT", label: "Asociado Estudiante" },
];

// Nombres completos de las áreas sin el prefijo "Val."
const AREAS_EVALUACION = [
  { value: "Todos", label: "Todas las áreas" },
  { value: "associateValidation", label: "Atención al Asociado" },
  { value: "logisticValidation", label: "Logística" },
  { value: "comiteValidation", label: "Comité Evaluador" },
  { value: "legalValidation", label: "Asesoría Legal" },
  { value: "comunicacionesValidation", label: "Comunicaciones" },
];

const ESTADOS_AREA = [
  { value: "Todos", label: "Todos los estados" },
  { value: "PENDING", label: "Pendiente" },
  { value: "UNDER_EVALUATION", label: "En Evaluación" },
  { value: "OBSERVED", label: "Observado" },
  { value: "RESOLVED", label: "Subsanado" },
  { value: "APPROVED", label: "Aprobado" },
  { value: "REJECTED", label: "Rechazado" },
];

const ESTADOS_PAGO = [
  { value: "Todos", label: "Cualquier estado" },
  { value: "PENDING", label: "Pendiente" },
  { value: "PAID", label: "Pagado" },
  { value: "FAILED", label: "Fallido" },
];

const GENEROS = [
  { value: "Todos", label: "Todos los géneros" },
  { value: "MALE", label: "Masculino" },
  { value: "FEMALE", label: "Femenino" },
  { value: "OTHER", label: "Otro" },
  { value: "PREFER_NOT_TO_SAY", label: "Prefiero no decirlo" },
];

const ESTADOS_AVAL = [
  { value: "Todos", label: "Cualquier estado" },
  { value: "PENDING", label: "Pendiente" },
  { value: "APPROVED", label: "Aprobado" },
  { value: "REJECTED", label: "Rechazado" },
];

const ORDENAR_POR = [
  { value: "Más recientes", label: "Más recientes" },
  { value: "Más antiguos", label: "Más antiguos" },
  { value: "Prioridad", label: "Mayor prioridad" },
];

type FilterOption = { value: string; label: string };

const ADVANCED_DEFAULTS = {
  paymentStatus: "Todos",
  dateFrom: "",
  dateTo: "",
  gender: "Todos",
  countryId: "Todos",
  universityId: "Todos",
  company: "Todos",
  evaluatorId: "Todos",
  endorsementStatus: "Todos",
  comiteValidation: "Todos",
};

type AdvancedKey = keyof typeof ADVANCED_DEFAULTS;
const ADVANCED_KEYS = Object.keys(ADVANCED_DEFAULTS) as AdvancedKey[];

type AdvancedTabId = "persona" | "formacion" | "evaluacion" | "pago";

const ADVANCED_TABS: { id: AdvancedTabId; label: string; description: string; icon: LucideIcon; keys: AdvancedKey[] }[] = [
  { id: "persona", label: "Persona", description: "Sexo y país de residencia.", icon: UserRound, keys: ["gender", "countryId"] },
  { id: "formacion", label: "Formación y trabajo", description: "Universidad y empresa del postulante.", icon: GraduationCap, keys: ["universityId", "company"] },
  { id: "evaluacion", label: "Evaluación", description: "Evaluador, avales y comité.", icon: ShieldCheck, keys: ["evaluatorId", "endorsementStatus", "comiteValidation"] },
  { id: "pago", label: "Pago y fechas", description: "Estado del pago y rango de fechas.", icon: CalendarDays, keys: ["paymentStatus", "dateFrom", "dateTo"] },
];

const withAllOption = (options: FilterOption[], allLabel: string): FilterOption[] => [
  { value: "Todos", label: allLabel },
  ...options,
];

const toSelectOptions = (options: FilterOption[]): AppSelectOption[] =>
  options.map((option) => ({ value: option.value, label: option.label }));

// ==========================================
// COMPONENTE: CUSTOM DROPDOWN (barra rápida)
// ==========================================
const CustomDropdown = ({ value, options, onChange, topLabel, className = "", heightClass = "h-10", disabled = false }: any) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedOption = options.find((o: any) => o.value === value) || options[0];

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {topLabel && (
        <span className={`absolute -top-2 left-3 px-1 text-[10px] font-bold uppercase tracking-widest z-10 transition-colors ${disabled ? 'text-slate-300 bg-slate-50' : 'text-slate-400 bg-white'}`}>
          {topLabel}
        </span>
      )}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full ${heightClass} pl-4 pr-10 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:border-[#C5A059] focus:ring-1 focus:ring-[#C5A059] transition-all flex items-center justify-between ${disabled ? 'bg-slate-50 text-slate-400 cursor-not-allowed border-slate-100' : 'bg-white text-slate-700'}`}
      >
        <span className="truncate">{selectedOption.label}</span>
        <ChevronDown size={16} className={`absolute right-3.5 transition-transform duration-300 ${isOpen ? 'rotate-180 text-[#C5A059]' : 'text-slate-400'}`} />
      </button>

      {isOpen && !disabled && (
        <div className="absolute top-full left-0 w-full mt-1.5 bg-white border border-slate-100 rounded-xl shadow-xl z-[100] py-1.5 max-h-60 overflow-y-auto animate-in fade-in zoom-in-95 scrollbar-thin scrollbar-thumb-slate-200">
          {options.map((opt: any) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                onChange(opt.value);
                setIsOpen(false);
              }}
              className={`w-full text-left px-4 py-2.5 text-sm font-semibold transition-colors focus:outline-none ${
                value === opt.value
                  ? "bg-[#C5A059]/10 text-[#C5A059] border-l-2 border-[#C5A059]"
                  : "text-slate-600 hover:bg-[#fdfaf5] hover:text-[#C5A059] border-l-2 border-transparent"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const DateField = ({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) => (
  <div>
    <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-[.13em] text-slate-500">{label}</label>
    <div className="relative">
      <input
        type="date"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 pr-10 text-sm font-medium text-slate-700 outline-none transition [color-scheme:light] hover:border-slate-300 focus:border-[#b48a37] focus:ring-2 focus:ring-[#b48a37]/15 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0"
      />
      <CalendarDays size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
    </div>
  </div>
);

export function ExpedientesFilterBar({ filters, onFilterChange, totalResults }: ExpedientesFilterBarProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showAreaSettings, setShowAreaSettings] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [activeAdvancedTab, setActiveAdvancedTab] = useState<AdvancedTabId>("persona");

  const [advancedDraft, setAdvancedDraft] = useState<Record<AdvancedKey, string>>(ADVANCED_DEFAULTS);
  const [isLoadingOptions, setIsLoadingOptions] = useState(false);
  const [optionsLoaded, setOptionsLoaded] = useState(false);
  const [filterOptions, setFilterOptions] = useState<{
    countries: FilterOption[];
    universities: FilterOption[];
    companies: FilterOption[];
    evaluators: FilterOption[];
  }>({ countries: [], universities: [], companies: [], evaluators: [] });

  const areaSettingsRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setIsMounted(true); }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (areaSettingsRef.current && !areaSettingsRef.current.contains(event.target as Node)) setShowAreaSettings(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showAreaSettings]);

  useEffect(() => {
    if (!showAdvanced) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setShowAdvanced(false);
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [showAdvanced]);

  useEffect(() => {
    if (!showAdvanced || optionsLoaded) return;
    let cancelled = false;
    setIsLoadingOptions(true);
    fetch("/api/afiliaciones/expedientes/filtros")
      .then((response) => response.json())
      .then((result) => {
        if (cancelled || !result?.success) return;
        setFilterOptions({
          countries: result.data?.countries ?? [],
          universities: result.data?.universities ?? [],
          companies: result.data?.companies ?? [],
          evaluators: result.data?.evaluators ?? [],
        });
        setOptionsLoaded(true);
      })
      .catch((error) => console.error("[Filtros avanzados] No se pudieron cargar las opciones:", error))
      .finally(() => { if (!cancelled) setIsLoadingOptions(false); });
    return () => { cancelled = true; };
  }, [showAdvanced, optionsLoaded]);

  // LÓGICA INTELIGENTE: Detectar cuántas áreas están siendo filtradas
  const areaKeys = ["associateValidation", "logisticValidation", "comiteValidation", "legalValidation", "comunicacionesValidation"];
  const activeAreas = areaKeys.filter((k) => filters[k] && filters[k] !== "Todos");
  const activeAreasCount = activeAreas.length;

  // Determinar qué mostrar en el Select rápido
  let activeAreaKey = "Todos";
  let activeAreaStatus = "Todos";

  if (activeAreasCount === 1) {
    activeAreaKey = activeAreas[0];
    activeAreaStatus = filters[activeAreas[0]];
  } else if (activeAreasCount > 1) {
    activeAreaKey = "multiple";
  }

  // Clonamos las áreas de evaluación para no mutar la constante global y añadimos la opción múltiple si aplica
  const areasOptions = [...AREAS_EVALUACION];
  if (activeAreasCount > 1) areasOptions.push({ value: "multiple", label: "Varias áreas activas" });

  const handleQuickAreaChange = (newAreaKey: string) => {
    if (newAreaKey === "multiple") return;
    // Si elige una sola área en el select rápido, limpiamos las demás (Single-select mode)
    areaKeys.forEach((k) => {
      if (filters[k] !== "Todos" && k !== newAreaKey) onFilterChange(k, "Todos");
    });
    if (newAreaKey !== "Todos") {
      const statusToApply = activeAreaStatus !== "Todos" ? activeAreaStatus : "PENDING";
      onFilterChange(newAreaKey, statusToApply);
    } else {
      onFilterChange(activeAreaKey, "Todos");
    }
  };

  const handleQuickAreaStatusChange = (newStatus: string) => {
    if (activeAreasCount === 1) onFilterChange(activeAreaKey, newStatus);
  };

  const isActiveValue = (value: string | undefined) => Boolean(value && value !== "Todos" && value !== "");

  const advancedActiveCount = ADVANCED_KEYS.filter((key) => isActiveValue(filters[key])).length;
  const hasActiveFilters = filters.search !== "" || filters.status !== "Todos" || filters.modality !== "Todos" || activeAreasCount > 0 || advancedActiveCount > 0;

  const handleClearAll = () => {
    onFilterChange("search", ""); onFilterChange("status", "Todos"); onFilterChange("modality", "Todos");
    areaKeys.forEach(k => onFilterChange(k, "Todos"));
    ADVANCED_KEYS.forEach((key) => onFilterChange(key, ADVANCED_DEFAULTS[key]));
  };

  const openAdvanced = () => {
    const draft = { ...ADVANCED_DEFAULTS };
    ADVANCED_KEYS.forEach((key) => {
      const current = filters[key];
      if (current !== undefined && current !== null) draft[key] = String(current);
    });
    setAdvancedDraft(draft);
    setActiveAdvancedTab("persona");
    setShowAdvanced(true);
  };

  const setAdvanced = (key: AdvancedKey, value: string) => {
    setAdvancedDraft((prev) => ({ ...prev, [key]: value }));
  };

  const applyAdvanced = () => {
    ADVANCED_KEYS.forEach((key) => {
      const next = advancedDraft[key] ?? "";
      const current = filters[key] ?? "";
      if (String(current) !== next) onFilterChange(key, next);
    });
    setShowAdvanced(false);
  };

  const draftAdvancedCount = ADVANCED_KEYS.filter((key) => isActiveValue(advancedDraft[key])).length;

  const countryOptions = withAllOption(filterOptions.countries, isLoadingOptions ? "Cargando países..." : "Todos los países");
  const universityOptions = withAllOption(filterOptions.universities, isLoadingOptions ? "Cargando universidades..." : "Todas las universidades");
  const companyOptions = withAllOption(filterOptions.companies, isLoadingOptions ? "Cargando empresas..." : "Todas las empresas");
  const evaluatorOptions = withAllOption(filterOptions.evaluators, isLoadingOptions ? "Cargando evaluadores..." : "Todos los evaluadores");

  const activeChips = [
    { key: "gender" as AdvancedKey, label: "Sexo", options: GENEROS },
    { key: "countryId" as AdvancedKey, label: "País", options: countryOptions },
    { key: "universityId" as AdvancedKey, label: "Universidad", options: universityOptions },
    { key: "company" as AdvancedKey, label: "Empresa", options: companyOptions },
    { key: "evaluatorId" as AdvancedKey, label: "Evaluador", options: evaluatorOptions },
    { key: "endorsementStatus" as AdvancedKey, label: "Avales", options: ESTADOS_AVAL },
    { key: "comiteValidation" as AdvancedKey, label: "Comité", options: ESTADOS_AREA },
    { key: "paymentStatus" as AdvancedKey, label: "Pago", options: ESTADOS_PAGO },
    { key: "dateFrom" as AdvancedKey, label: "Desde", options: [] as FilterOption[] },
    { key: "dateTo" as AdvancedKey, label: "Hasta", options: [] as FilterOption[] },
  ]
    .filter((chip) => isActiveValue(advancedDraft[chip.key]))
    .map((chip) => ({
      ...chip,
      display: chip.options.find((option) => option.value === advancedDraft[chip.key])?.label ?? advancedDraft[chip.key],
    }));

  const activeTab = ADVANCED_TABS.find((tab) => tab.id === activeAdvancedTab) ?? ADVANCED_TABS[0];

  return (
    <div className="flex flex-col w-full relative z-20">
      <div className="px-5 py-3 flex flex-col xl:flex-row gap-3">
        
        {/* BUSCADOR (Más ancho: max-w-lg) */}
        <div className="relative flex-1 w-full xl:max-w-lg min-w-[200px]">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input
            type="text"
            placeholder="Buscar por DNI, Nombre o APP..."
            value={filters.search}
            onChange={(e) => onFilterChange("search", e.target.value)}
            className="w-full pl-10 pr-10 h-10 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:border-[#C5A059] focus:ring-1 focus:ring-[#C5A059] transition-all placeholder:text-slate-400"
          />
          {filters.search && (
            <button type="button" onClick={() => onFilterChange("search", "")} aria-label="Limpiar búsqueda" className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-600">
              <X size={14} strokeWidth={2.5} />
            </button>
          )}
        </div>

        {/* CONTROLES */}
        <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
          <CustomDropdown options={ESTADOS_GENERALES} value={filters.status} onChange={(val: string) => onFilterChange("status", val)} topLabel="Estado Gral." className="min-w-[150px] z-[60]" />
          <CustomDropdown options={MODALIDADES} value={filters.modality} onChange={(val: string) => onFilterChange("modality", val)} topLabel="Modalidad" className="min-w-[160px] z-[50]" />

          {/* GRUPO ÁREAS: DROPDOWN + RUEDITA MULTI-ÁREA */}
          <div className="flex items-center gap-1.5 z-[40]" ref={areaSettingsRef}>
            <CustomDropdown 
              options={areasOptions} 
              value={activeAreaKey} 
              onChange={handleQuickAreaChange} 
              topLabel="Área Evaluación" 
              className="min-w-[180px]" 
              disabled={activeAreasCount > 1} 
            />
            
            <div className="relative">
              <button 
                title="Gestor Multi-Área" 
                onClick={() => setShowAreaSettings(!showAreaSettings)}
                className={`h-10 w-10 flex items-center justify-center border rounded-xl shadow-sm transition-all outline-none relative ${activeAreasCount > 1 || showAreaSettings ? 'bg-[#fdfaf5] border-[#E8D09E] text-[#7f561e]' : 'bg-white border-slate-200 text-slate-400 hover:text-[#C5A059] hover:bg-orange-50'}`}
              >
                <Settings size={16} />
                {activeAreasCount > 1 && (
                  <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-[#C5A059] text-white text-[9px] font-black rounded-full flex items-center justify-center shadow-sm">
                    {activeAreasCount}
                  </span>
                )}
              </button>

              {/* POPOVER MULTI-ÁREA (LA RUEDITA) */}
              {showAreaSettings && (
                <div className="absolute right-0 top-full mt-2 w-[280px] bg-white border border-slate-200 shadow-2xl rounded-2xl z-[100] animate-in fade-in slide-in-from-top-2 p-5 space-y-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-[11px] font-black text-slate-800 uppercase tracking-widest">Filtros Multi-Área</h3>
                    <button onClick={() => setShowAreaSettings(false)} className="text-slate-400 hover:text-slate-600"><X size={16}/></button>
                  </div>
                  <CustomDropdown options={ESTADOS_AREA} value={filters.associateValidation} onChange={(v: string) => onFilterChange("associateValidation", v)} topLabel="Atención al Asociado" heightClass="h-9" />
                  <CustomDropdown options={ESTADOS_AREA} value={filters.logisticValidation} onChange={(v: string) => onFilterChange("logisticValidation", v)} topLabel="Logística" heightClass="h-9" />
                  <CustomDropdown options={ESTADOS_AREA} value={filters.comiteValidation} onChange={(v: string) => onFilterChange("comiteValidation", v)} topLabel="Comité Evaluador" heightClass="h-9" />
                  <CustomDropdown options={ESTADOS_AREA} value={filters.legalValidation} onChange={(v: string) => onFilterChange("legalValidation", v)} topLabel="Asesoría Legal" heightClass="h-9" />
                  <CustomDropdown options={ESTADOS_AREA} value={filters.comunicacionesValidation} onChange={(v: string) => onFilterChange("comunicacionesValidation", v)} topLabel="Comunicaciones" heightClass="h-9" />
                  
                  <div className="pt-2 border-t border-slate-100 flex justify-end">
                     <button onClick={() => areaKeys.forEach(k => onFilterChange(k, "Todos"))} className="text-[11px] font-bold text-slate-400 hover:text-red-500">Limpiar áreas</button>
                  </div>
                </div>
              )}
            </div>
          </div>

          <CustomDropdown 
            options={ESTADOS_AREA} 
            value={activeAreaStatus} 
            onChange={handleQuickAreaStatusChange} 
            topLabel="Est. del Área" 
            className="min-w-[140px] z-[30]" 
            disabled={activeAreasCount !== 1} 
          />

          {/* FILTROS AVANZADOS */}
          <button
            onClick={openAdvanced}
            className={`h-10 px-4 ml-auto lg:ml-0 rounded-xl text-sm font-bold flex items-center gap-2 transition-all border outline-none relative ${advancedActiveCount > 0 || showAdvanced ? "bg-[#fdfaf5] border-[#E8D09E] text-[#7f561e]" : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"}`}
          >
            <Filter size={16} /> Avanzados
            {advancedActiveCount > 0 && <span className="w-5 h-5 rounded-full bg-[#C5A059] text-white text-[10px] flex items-center justify-center ml-1">{advancedActiveCount}</span>}
          </button>

          {/* BOTÓN LIMPIAR TODO */}
          {hasActiveFilters && (
             <button onClick={handleClearAll} className="h-10 px-4 rounded-xl border border-red-200 bg-red-50 text-red-600 hover:bg-red-500 hover:text-white transition-all flex items-center gap-2 text-sm font-bold shadow-sm outline-none ml-auto xl:ml-0">
               <Trash2 size={16} /> Limpiar
             </button>
          )}
        </div>
      </div>

      <div className="px-5 py-2 border-t border-slate-100 flex flex-row items-center justify-between bg-slate-50/50 rounded-b-2xl h-[42px]">
        <span className="text-xs font-bold text-slate-500 flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-[#C5A059] animate-pulse"></span>
          {totalResults} expediente{totalResults !== 1 ? 's' : ''} encontrado{totalResults !== 1 ? 's' : ''}
        </span>
        <div className="flex items-center gap-1.5 sm:gap-2">
          <span className="hidden sm:flex text-[10px] font-black text-slate-400 uppercase tracking-widest items-center gap-1">
            <ArrowDownUp size={12} /> Ordenar:
          </span>
          <div className="w-[140px] sm:w-[150px]">
            <CustomDropdown options={ORDENAR_POR} value={filters.orderBy} onChange={(val: string) => onFilterChange("orderBy", val)} heightClass="h-8 !border-none !bg-transparent !pl-0 !pr-6 text-right !text-slate-700 hover:!text-[#C5A059]" />
          </div>
        </div>
      </div>

      {/* MODAL DE FILTROS AVANZADOS */}
      {isMounted && showAdvanced && createPortal(
        <div
          className="fixed inset-0 z-[999999] bg-slate-950/70 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200"
          onMouseDown={(event) => { if (event.target === event.currentTarget) setShowAdvanced(false); }}
        >
          <div className="bg-white rounded-[26px] w-full max-w-6xl h-[92vh] max-h-[860px] shadow-[0_30px_120px_-20px_rgba(15,23,42,0.6)] overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col">
            {/* HEADER */}
            <div className="px-6 py-5 border-b border-slate-100 flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="w-11 h-11 rounded-2xl bg-[#fbf4e7] border border-[#ead9b8] flex items-center justify-center shrink-0">
                  <Filter size={20} className="text-[#b48a37]" />
                </div>
                <div>
                  <h2 className="text-lg font-black text-slate-900 tracking-tight">Filtros avanzados</h2>
                  <p className="text-xs font-medium text-slate-500 mt-1">
                    Encuentra expedientes por persona, formación, evaluación y pago.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {draftAdvancedCount > 0 && (
                  <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-[#fbf4e7] border border-[#ead9b8] px-3 py-1.5 text-[11px] font-bold text-[#7f561e]">
                    {draftAdvancedCount} filtro{draftAdvancedCount !== 1 ? "s" : ""} seleccionado{draftAdvancedCount !== 1 ? "s" : ""}
                  </span>
                )}
                <button onClick={() => setShowAdvanced(false)} className="p-2 rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors" aria-label="Cerrar filtros avanzados">
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* BODY */}
            <div className="flex-1 min-h-0 flex flex-col md:flex-row">
              {/* SIDEBAR */}
              <aside className="md:w-64 shrink-0 border-b md:border-b-0 md:border-r border-slate-100 bg-gradient-to-b md:from-slate-50 md:to-white p-3 md:p-4">
                <div className="flex md:flex-col gap-2 overflow-x-auto md:overflow-visible pb-1 md:pb-0">
                  {ADVANCED_TABS.map((tab) => {
                    const Icon = tab.icon;
                    const count = tab.keys.filter((key) => isActiveValue(advancedDraft[key])).length;
                    const selected = activeAdvancedTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => setActiveAdvancedTab(tab.id)}
                        className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all shrink-0 md:w-full border ${
                          selected
                            ? "bg-white border-[#ead9b8] shadow-sm text-[#172a45]"
                            : "border-transparent text-slate-500 hover:bg-white hover:border-slate-200"
                        }`}
                      >
                        <span className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${selected ? "bg-[#fbf4e7] text-[#b48a37]" : "bg-slate-100 text-slate-400 group-hover:text-slate-600"}`}>
                          <Icon size={16} />
                        </span>
                        <span className="flex-1 min-w-0">
                          <span className={`block text-sm font-bold truncate ${selected ? "text-[#172a45]" : "text-slate-600"}`}>{tab.label}</span>
                          <span className="hidden md:block text-[10px] font-medium text-slate-400 truncate">{tab.description}</span>
                        </span>
                        {count > 0 && (
                          <span className="w-5 h-5 rounded-full bg-[#C5A059] text-white text-[10px] font-black flex items-center justify-center shrink-0">
                            {count}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </aside>

              {/* CONTENT */}
              <section className="flex-1 min-h-0 flex flex-col">
                <div className="px-6 pt-5 pb-3">
                  <h3 className="text-base font-black text-slate-900">{activeTab.label}</h3>
                  <p className="text-xs font-medium text-slate-500 mt-0.5">{activeTab.description}</p>
                </div>

                {activeChips.length > 0 && (
                  <div className="px-6 pb-3 flex flex-wrap items-center gap-2">
                    {activeChips.map((chip) => (
                      <button
                        key={chip.key}
                        onClick={() => setAdvanced(chip.key, ADVANCED_DEFAULTS[chip.key])}
                        className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold text-slate-600 hover:border-red-200 hover:bg-red-50 hover:text-red-600 transition-colors"
                        title={`Quitar ${chip.label}`}
                      >
                        <span className="text-slate-400">{chip.label}:</span>
                        <span className="max-w-[160px] truncate">{chip.display}</span>
                        <X size={12} />
                      </button>
                    ))}
                  </div>
                )}

                <div className="flex-1 overflow-y-auto px-6 pb-6">
                  {activeTab.id === "persona" && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 max-w-3xl">
                      <AppSelect label="Sexo" value={advancedDraft.gender} options={toSelectOptions(GENEROS)} onChange={(value) => setAdvanced("gender", value)} searchable portal />
                      <AppSelect
                        label="País de residencia"
                        value={advancedDraft.countryId}
                        options={toSelectOptions(countryOptions)}
                        onChange={(value) => setAdvanced("countryId", value)}
                        disabled={isLoadingOptions}
                        searchable
                        portal
                      />
                    </div>
                  )}

                  {activeTab.id === "formacion" && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 max-w-4xl">
                      <AppSelect
                        label="Universidad / Institución"
                        value={advancedDraft.universityId}
                        options={toSelectOptions(universityOptions)}
                        onChange={(value) => setAdvanced("universityId", value)}
                        disabled={isLoadingOptions}
                        searchable
                        portal
                      />
                      <AppSelect
                        label="Empresa"
                        value={advancedDraft.company}
                        options={toSelectOptions(companyOptions)}
                        onChange={(value) => setAdvanced("company", value)}
                        disabled={isLoadingOptions}
                        searchable
                        portal
                      />
                    </div>
                  )}

                  {activeTab.id === "evaluacion" && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 max-w-4xl">
                      <AppSelect
                        label="Evaluador"
                        value={advancedDraft.evaluatorId}
                        options={toSelectOptions(evaluatorOptions)}
                        onChange={(value) => setAdvanced("evaluatorId", value)}
                        disabled={isLoadingOptions}
                        searchable
                        portal
                      />
                      <AppSelect label="Estado de avales" value={advancedDraft.endorsementStatus} options={toSelectOptions(ESTADOS_AVAL)} onChange={(value) => setAdvanced("endorsementStatus", value)} searchable portal />
                      <AppSelect label="Estado del comité" value={advancedDraft.comiteValidation} options={toSelectOptions(ESTADOS_AREA)} onChange={(value) => setAdvanced("comiteValidation", value)} searchable portal />
                    </div>
                  )}

                  {activeTab.id === "pago" && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 max-w-3xl">
                      <AppSelect label="Estado de pago" value={advancedDraft.paymentStatus} options={toSelectOptions(ESTADOS_PAGO)} onChange={(value) => setAdvanced("paymentStatus", value)} searchable portal />
                      <div />
                      <DateField label="Desde" value={advancedDraft.dateFrom} onChange={(value) => setAdvanced("dateFrom", value)} />
                      <DateField label="Hasta" value={advancedDraft.dateTo} onChange={(value) => setAdvanced("dateTo", value)} />
                    </div>
                  )}

                  {isLoadingOptions && (
                    <p className="text-[11px] font-semibold text-slate-400 mt-5 flex items-center gap-2">
                      <span className="w-3 h-3 border-2 border-[#C5A059] border-t-transparent rounded-full animate-spin" />
                      Cargando opciones disponibles...
                    </p>
                  )}
                </div>
              </section>
            </div>

            {/* FOOTER */}
            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/70 flex flex-col sm:flex-row items-center justify-between gap-3">
              <button
                onClick={() => setAdvancedDraft(ADVANCED_DEFAULTS)}
                disabled={draftAdvancedCount === 0}
                className="w-full sm:w-auto px-4 h-10 rounded-xl border border-slate-200 bg-white text-slate-600 hover:text-red-600 hover:border-red-200 hover:bg-red-50 text-sm font-bold transition-all disabled:opacity-40 disabled:pointer-events-none flex items-center justify-center gap-2"
              >
                <Trash2 size={15} /> Limpiar selección
              </button>
              <div className="flex w-full sm:w-auto items-center gap-3">
                <button
                  onClick={() => setShowAdvanced(false)}
                  className="flex-1 sm:flex-none px-4 h-10 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 text-sm font-bold transition-all"
                >
                  Cancelar
                </button>
                <button
                  onClick={applyAdvanced}
                  className="flex-1 sm:flex-none px-6 h-10 rounded-xl bg-[#C5A059] hover:bg-[#b08d47] text-white text-sm font-black shadow-md shadow-[#C5A059]/20 transition-all flex items-center justify-center gap-2"
                >
                  <Filter size={15} /> Aplicar filtros
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
