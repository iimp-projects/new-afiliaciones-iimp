"use client";

import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { Search, Filter, Trash2, ChevronDown, Calendar, ArrowDownUp, X, Settings } from "lucide-react";

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

const ORDENAR_POR = [
  { value: "Más recientes", label: "Más recientes" },
  { value: "Más antiguos", label: "Más antiguos" },
  { value: "Prioridad", label: "Mayor prioridad" },
];

// ==========================================
// COMPONENTE: CUSTOM DROPDOWN
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
        className={`w-full ${heightClass} pl-4 pr-10 border border-slate-200 rounded-xl text-sm font-bold focus:outline-none focus:border-[#C5A059] focus:ring-1 focus:ring-[#C5A059] transition-all flex items-center justify-between ${disabled ? 'bg-slate-50 text-slate-400 cursor-not-allowed border-slate-100' : 'bg-white text-slate-700'}`}
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

export function ExpedientesFilterBar({ filters, onFilterChange, totalResults }: ExpedientesFilterBarProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showAreaSettings, setShowAreaSettings] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  
  const popoverRef = useRef<HTMLDivElement>(null);
  const areaSettingsRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setIsMounted(true); }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) setShowAdvanced(false);
      if (areaSettingsRef.current && !areaSettingsRef.current.contains(event.target as Node)) setShowAreaSettings(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showAdvanced, showAreaSettings]);

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

  const advancedActiveCount = [filters.paymentStatus, filters.dateFrom, filters.dateTo].filter((val) => val && val !== "Todos" && val !== "").length;
  const hasActiveFilters = filters.search !== "" || filters.status !== "Todos" || filters.modality !== "Todos" || activeAreasCount > 0 || advancedActiveCount > 0;

  const handleClearAll = () => {
    onFilterChange("search", ""); onFilterChange("status", "Todos"); onFilterChange("modality", "Todos");
    areaKeys.forEach(k => onFilterChange(k, "Todos"));
    onFilterChange("paymentStatus", "Todos"); onFilterChange("dateFrom", ""); onFilterChange("dateTo", "");
  };

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
            className="w-full pl-10 pr-4 h-10 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:border-[#C5A059] focus:ring-1 focus:ring-[#C5A059] transition-all placeholder:text-slate-400"
          />
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

          {/* FILTROS AVANZADOS (Pagos y Fechas) */}
          <div className="relative z-[20]" ref={popoverRef}>
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className={`h-10 px-4 ml-auto lg:ml-0 rounded-xl text-sm font-bold flex items-center gap-2 transition-all border outline-none relative ${advancedActiveCount > 0 || showAdvanced ? "bg-[#fdfaf5] border-[#E8D09E] text-[#7f561e]" : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"}`}
            >
              <Filter size={16} /> Avanzados
              {advancedActiveCount > 0 && <span className="w-5 h-5 rounded-full bg-[#C5A059] text-white text-[10px] flex items-center justify-center ml-1">{advancedActiveCount}</span>}
            </button>

            {showAdvanced && (
              <div className="absolute right-0 top-full mt-2 w-[300px] sm:w-[320px] bg-white border border-slate-200 shadow-2xl rounded-2xl z-[100] animate-in fade-in slide-in-from-top-2 overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 flex justify-between bg-slate-50/50">
                  <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest">Filtros Secundarios</h3>
                  <button onClick={() => setShowAdvanced(false)} className="text-slate-400 hover:text-slate-700"><X size={16} /></button>
                </div>
                <div className="p-5 space-y-5">
                  <CustomDropdown options={ESTADOS_PAGO} value={filters.paymentStatus} onChange={(val: string) => onFilterChange("paymentStatus", val)} topLabel="Estado de Pago" heightClass="h-10" />
                  <div className="grid grid-cols-2 gap-3">
                    <div className="relative">
                      <span className="absolute -top-2 left-3 bg-white px-1 text-[10px] font-bold text-slate-400 uppercase tracking-widest z-10">Desde</span>
                      <input type="date" value={filters.dateFrom} onChange={(e) => onFilterChange("dateFrom", e.target.value)} className="w-full h-10 px-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:border-[#C5A059] transition-all" />
                    </div>
                    <div className="relative">
                      <span className="absolute -top-2 left-3 bg-white px-1 text-[10px] font-bold text-slate-400 uppercase tracking-widest z-10">Hasta</span>
                      <input type="date" value={filters.dateTo} onChange={(e) => onFilterChange("dateTo", e.target.value)} className="w-full h-10 px-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:border-[#C5A059] transition-all" />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

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
    </div>
  );
}