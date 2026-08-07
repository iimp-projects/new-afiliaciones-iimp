"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown, Filter, Download, FileSpreadsheet, ArchiveRestore, Search, SlidersHorizontal, CalendarDays } from "lucide-react";

interface ExpedientesFilterBarProps {
  filters: Record<string, string>;
  onFilterChange: (key: string, value: string) => void;
  totalResults: number;
}

export function ExpedientesFilterBar({ filters, onFilterChange, totalResults }: ExpedientesFilterBarProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  const handleClearFilters = () => {
    const resetKeys = ["search", "status", "modality", "assignedTo", "logisticValidation", "associateValidation", "dateFrom", "dateTo", "orderBy"];
    resetKeys.forEach(key => onFilterChange(key, key === "orderBy" ? "Más recientes" : key === "search" || key.startsWith("date") ? "" : "Todos"));
  };

  return (
    <div className="flex flex-col gap-5 mb-6 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
      
      {/* Cabecera y Exportación */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 border-b border-slate-100 pb-4">
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight">Expedientes de Afiliación</h1>
          <p className="text-sm font-medium text-slate-500">Gestiona, evalúa y resuelve las solicitudes pendientes.</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl text-sm font-bold hover:bg-emerald-100 transition-colors">
            <FileSpreadsheet size={16} /> Exportar Excel
          </button>
        </div>
      </div>

      {/* Fila Principal: Buscador y Filtros Básicos */}
      <div className="flex flex-col lg:flex-row items-center gap-4">
        {/* Buscador Omnibar */}
        <div className="relative w-full lg:w-1/3">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input 
            type="text" 
            placeholder="Buscar por DNI, Nombre o APP-..."
            value={filters.search || ""}
            onChange={(e) => onFilterChange("search", e.target.value)}
            className="w-full h-11 pl-10 pr-4 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 focus:outline-none focus:bg-white focus:border-[#C5A059] focus:ring-2 focus:ring-[#C5A059]/20 transition-all"
          />
        </div>

        {/* Filtros Básicos */}
        <div className="flex w-full lg:w-auto gap-4">
          <CustomSelect label="Estado" value={filters.status} onChange={(v) => onFilterChange("status", v)} options={[{l: "Todos", v: "Todos"}, {l: "En Proceso", v: "SUBMITTED"}, {l: "Observado", v: "OBSERVED"}, {l: "Completado", v: "APPROVED"}]} />
          <CustomSelect label="Modalidad" value={filters.modality} onChange={(v) => onFilterChange("modality", v)} options={[{l: "Todos", v: "Todos"}, {l: "Asociado Activo", v: "Asociado Activo"}, {l: "Estudiante", v: "Estudiante"}]} />
        </div>

        {/* Botones de Acción */}
        <div className="flex items-center gap-3 w-full lg:w-auto ml-auto">
          <button 
            onClick={() => setShowAdvanced(!showAdvanced)} 
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all border ${showAdvanced ? "bg-[#C5A059] text-white border-[#C5A059]" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"}`}
          >
            <SlidersHorizontal size={16} /> Filtros {showAdvanced ? "Activos" : "Avanzados"}
          </button>
          <button onClick={handleClearFilters} className="flex items-center gap-2 px-4 py-2.5 bg-slate-50 border border-slate-200 text-slate-600 rounded-xl text-sm font-bold hover:bg-slate-100 transition-colors">
            <Filter size={16} /> Limpiar
          </button>
        </div>
      </div>

      {/* Panel de Filtros Avanzados (Animado) */}
      {showAdvanced && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-4 bg-slate-50 border border-slate-100 rounded-xl animate-in fade-in zoom-in-95 duration-200">
          <CustomSelect label="Validación Asociados" value={filters.associateValidation} onChange={(v) => onFilterChange("associateValidation", v)} options={[{l: "Todos", v: "Todos"}, {l: "Aprobado", v: "APPROVED"}, {l: "En Revisión", v: "REVIEW"}]} />
          <CustomSelect label="Validación Logística" value={filters.logisticValidation} onChange={(v) => onFilterChange("logisticValidation", v)} options={[{l: "Todos", v: "Todos"}, {l: "Aprobado", v: "APPROVED"}, {l: "En Revisión", v: "REVIEW"}]} />
          <CustomSelect label="Asignado a" value={filters.assignedTo} onChange={(v) => onFilterChange("assignedTo", v)} options={[{l: "Todos", v: "Todos"}, {l: "Sin Asignar", v: "Unassigned"}]} />
          
          <div className="flex items-center gap-2">
            <div className="flex flex-col w-full relative">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Desde</label>
              <input type="date" value={filters.dateFrom || ""} onChange={(e) => onFilterChange("dateFrom", e.target.value)} className="w-full h-11 px-3 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 focus:border-[#C5A059] focus:ring-1 focus:ring-[#C5A059] outline-none" />
            </div>
            <div className="flex flex-col w-full relative">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Hasta</label>
              <input type="date" value={filters.dateTo || ""} onChange={(e) => onFilterChange("dateTo", e.target.value)} className="w-full h-11 px-3 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 focus:border-[#C5A059] focus:ring-1 focus:ring-[#C5A059] outline-none" />
            </div>
          </div>
        </div>
      )}

      {/* Ordenamiento y Contador */}
      <div className="flex items-center justify-between pt-4 border-t border-slate-100">
        <div className="flex items-center gap-2 text-sm font-bold text-slate-500">
          <ArchiveRestore size={18} className="text-[#C5A059]" />
          <span>{totalResults} expedientes listados</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Ordenar:</span>
          <select value={filters.orderBy} onChange={(e) => onFilterChange("orderBy", e.target.value)} className="h-8 bg-transparent text-sm font-bold text-slate-700 focus:outline-none cursor-pointer">
            <option value="Más recientes">Más recientes</option>
            <option value="Más antiguos">Más antiguos</option>
          </select>
        </div>
      </div>

    </div>
  );
}

// ============================================================================
// COMPONENTE: SELECT PERSONALIZADO (Adiós al fondo azul nativo)
// ============================================================================
function CustomSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: {l: string, v: string}[] }) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) setIsOpen(false);
    }
    if (isOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const selectedLabel = options.find(o => o.v === value)?.l || value;

  return (
    <div className="flex flex-col w-full min-w-[160px] relative" ref={containerRef}>
      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 pl-1">
        {label}
      </label>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center justify-between w-full h-11 bg-white border rounded-xl px-3 text-sm font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-[#C5A059]/20 ${isOpen ? "border-[#C5A059] shadow-sm" : "border-slate-200 hover:border-slate-300 text-slate-700"}`}
      >
        <span className="truncate">{selectedLabel}</span>
        <ChevronDown size={16} className={`text-slate-400 transition-transform duration-200 ${isOpen ? "rotate-180 text-[#C5A059]" : ""}`} />
      </button>

      {isOpen && (
        <div className="absolute top-[60px] left-0 w-full bg-white border border-slate-100 rounded-xl shadow-[0_10px_40px_-15px_rgba(0,0,0,0.15)] z-[100] p-1.5 animate-in fade-in zoom-in-95">
          {options.map((opt) => (
            <button
              key={opt.v}
              type="button"
              onClick={() => { onChange(opt.v); setIsOpen(false); }}
              className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors ${
                value === opt.v ? "bg-[#C5A059] text-white font-bold" : "text-slate-600 font-medium hover:bg-[#C5A059]/10 hover:text-[#C5A059]"
              }`}
            >
              {opt.l}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}