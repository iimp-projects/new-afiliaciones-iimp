"use client";

import React, { useState, useRef, useEffect } from "react";
import { Search, Filter, Trash2, ChevronDown, Calendar, ArrowDownUp } from "lucide-react";

interface ExpedientesFilterBarProps {
  filters: any;
  onFilterChange: (key: string, value: string) => void;
  totalResults: number;
}

// Valores extraídos estrictamente de tu schema.prisma
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

const ESTADOS_AREA = [
  { value: "Todos", label: "Cualquier estado" },
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
// COMPONENTE: CUSTOM DROPDOWN (Adiós al azul nativo)
// ==========================================
const CustomDropdown = ({ value, options, onChange, topLabel, className = "" }: any) => {
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
        <span className="absolute -top-2 left-3 bg-white px-1 text-[10px] font-bold text-slate-400 uppercase tracking-widest z-10">
          {topLabel}
        </span>
      )}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full h-12 pl-4 pr-10 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:outline-none focus:border-[#C5A059] focus:ring-1 focus:ring-[#C5A059] transition-all flex items-center justify-between"
      >
        <span className="truncate">{selectedOption.label}</span>
        <ChevronDown size={16} className={`absolute right-3.5 transition-transform duration-300 ${isOpen ? 'rotate-180 text-[#C5A059]' : 'text-slate-400'}`} />
      </button>

      {isOpen && (
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

export function ExpedientesFilterBar({
  filters,
  onFilterChange,
  totalResults,
}: ExpedientesFilterBarProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  const activeFiltersCount = Object.entries(filters).filter(
    ([key, val]) =>
      val !== "Todos" &&
      val !== "" &&
      key !== "search" &&
      key !== "orderBy"
  ).length;

  const handleClear = () => {
    onFilterChange("search", "");
    onFilterChange("status", "Todos");
    onFilterChange("modality", "Todos");
    onFilterChange("logisticValidation", "Todos");
    onFilterChange("associateValidation", "Todos");
    onFilterChange("comiteValidation", "Todos");
    onFilterChange("paymentStatus", "Todos");
    onFilterChange("dateFrom", "");
    onFilterChange("dateTo", "");
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm mb-6 relative z-30">
      {/* BARRA PRINCIPAL */}
      <div className="p-4 sm:p-5 flex flex-col xl:flex-row gap-4">
        {/* Buscador */}
        <div className="relative flex-1">
          <Search
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
            size={18}
          />
          <input
            type="text"
            placeholder="Buscar por DNI, Nombre o Código APP..."
            value={filters.search}
            onChange={(e) => onFilterChange("search", e.target.value)}
            className="w-full pl-10 pr-4 h-12 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:border-[#C5A059] focus:ring-1 focus:ring-[#C5A059] transition-all placeholder:text-slate-400"
          />
        </div>

        {/* Filtros Rápidos y Botones */}
        <div className="flex flex-wrap items-center gap-3">
          
          <CustomDropdown 
            options={ESTADOS_GENERALES} 
            value={filters.status} 
            onChange={(val: string) => onFilterChange("status", val)} 
            topLabel="Estado General" 
            className="min-w-[180px] z-50"
          />

          <CustomDropdown 
            options={MODALIDADES} 
            value={filters.modality} 
            onChange={(val: string) => onFilterChange("modality", val)} 
            topLabel="Modalidad" 
            className="min-w-[190px] z-40"
          />

          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className={`h-12 px-5 rounded-xl text-sm font-bold flex items-center gap-2 transition-all border outline-none ${
              activeFiltersCount > 0 || showAdvanced
                ? "bg-[#fdfaf5] border-[#E8D09E] text-[#7f561e]"
                : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
            }`}
          >
            <Filter size={16} />
            Filtros Avanzados
            {activeFiltersCount > 0 && (
              <span className="w-5 h-5 rounded-full bg-[#C5A059] text-white text-[10px] flex items-center justify-center ml-1">
                {activeFiltersCount}
              </span>
            )}
          </button>

          {(activeFiltersCount > 0 || filters.search) && (
            <button
              onClick={handleClear}
              className="h-12 px-5 rounded-xl border border-red-200 bg-red-50 text-red-600 hover:bg-red-500 hover:text-white transition-all flex items-center gap-2 text-sm font-bold shadow-sm outline-none"
            >
              <Trash2 size={16} /> Limpiar
            </button>
          )}
        </div>
      </div>

      {/* FILTROS AVANZADOS (Desplegable) */}
      {showAdvanced && (
        <div className="p-5 border-t border-slate-100 bg-slate-50/50 rounded-b-2xl grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-5 animate-in slide-in-from-top-2 z-20 relative">
          
          <CustomDropdown 
            options={ESTADOS_AREA} 
            value={filters.associateValidation} 
            onChange={(val: string) => onFilterChange("associateValidation", val)} 
            topLabel="Val. Asociados" 
          />

          <CustomDropdown 
            options={ESTADOS_AREA} 
            value={filters.logisticValidation} 
            onChange={(val: string) => onFilterChange("logisticValidation", val)} 
            topLabel="Val. Logística" 
          />

          <CustomDropdown 
            options={ESTADOS_AREA} 
            value={filters.comiteValidation} 
            onChange={(val: string) => onFilterChange("comiteValidation", val)} 
            topLabel="Val. Comité" 
          />

          <CustomDropdown 
            options={ESTADOS_PAGO} 
            value={filters.paymentStatus} 
            onChange={(val: string) => onFilterChange("paymentStatus", val)} 
            topLabel="Estado de Pago" 
          />

          <div className="relative">
            <span className="absolute -top-2 left-3 bg-slate-50 px-1 text-[10px] font-bold text-slate-400 uppercase tracking-widest z-10">Desde</span>
            <Calendar size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input 
              type="date" 
              value={filters.dateFrom} 
              onChange={(e) => onFilterChange("dateFrom", e.target.value)} 
              className="w-full h-12 pl-10 pr-3 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 focus:outline-none focus:border-[#C5A059] focus:ring-1 focus:ring-[#C5A059] accent-[#C5A059] transition-all" 
            />
          </div>

          <div className="relative">
            <span className="absolute -top-2 left-3 bg-slate-50 px-1 text-[10px] font-bold text-slate-400 uppercase tracking-widest z-10">Hasta</span>
            <Calendar size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input 
              type="date" 
              value={filters.dateTo} 
              onChange={(e) => onFilterChange("dateTo", e.target.value)} 
              className="w-full h-12 pl-10 pr-3 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 focus:outline-none focus:border-[#C5A059] focus:ring-1 focus:ring-[#C5A059] accent-[#C5A059] transition-all" 
            />
          </div>

        </div>
      )}

      {/* FOOTER DEL FILTRO (Con el CustomSelect para el orden) */}
      <div className="px-5 py-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between bg-slate-50 rounded-b-2xl gap-3">
        <span className="text-xs font-bold text-slate-500 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#C5A059]"></span>
          {totalResults} expedientes encontrados
        </span>
        <div className="flex items-center gap-3">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
            <ArrowDownUp size={14} /> Ordenar:
          </span>
          <div className="w-[160px]">
            <CustomDropdown 
              options={ORDENAR_POR} 
              value={filters.orderBy} 
              onChange={(val: string) => onFilterChange("orderBy", val)} 
            />
          </div>
        </div>
      </div>
    </div>
  );
}