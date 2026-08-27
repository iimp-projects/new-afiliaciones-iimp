"use client";

import React, { useState, useRef, useEffect } from "react";
import { Search, Filter, Trash2, ChevronDown, ArrowDownUp, X } from "lucide-react";

const ESTADOS_USUARIO = [
  { value: "ALL", label: "Todos los estados" },
  { value: "ACTIVE", label: "Activos" },
  { value: "INACTIVE", label: "Inactivos / Bloqueados" },
];

const ORDENAR_POR = [
  { value: "desc", label: "Más recientes" },
  { value: "asc", label: "Más antiguos" },
];

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
        <span className="truncate">{selectedOption?.label || "Seleccionar"}</span>
        <ChevronDown size={16} className={`absolute right-3.5 transition-transform duration-300 ${isOpen ? 'rotate-180 text-[#C5A059]' : 'text-slate-400'}`} />
      </button>

      {isOpen && !disabled && (
        <div className="absolute top-full left-0 w-full mt-1.5 bg-white border border-slate-100 rounded-xl shadow-xl z-[100] py-1.5 max-h-60 overflow-y-auto animate-in fade-in zoom-in-95 scrollbar-thin scrollbar-thumb-slate-200">
          {options.map((opt: any) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => { onChange(opt.value); setIsOpen(false); }}
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

export function UsersFilterBar({ roles, filters, onFilterChange, onClearFilters, total }: any) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) setShowAdvanced(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const rolesOptions = [
    { value: "ALL", label: "Todos los roles" },
    ...roles.map((r: any) => ({ value: r.id.toString(), label: r.name }))
  ];

  const hasActiveFilters = filters.search !== "" || filters.status !== "ALL" || filters.role !== "ALL";

  return (
    <div className="flex flex-col w-full relative z-20">
      <div className="px-5 py-4 flex flex-col xl:flex-row gap-4">
        
        <div className="relative flex-1 w-full xl:max-w-lg min-w-[200px]">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Buscar por DNI, Nombre o Correo..."
            value={filters.search}
            onChange={(e) => onFilterChange("search", e.target.value)}
            className="w-full pl-12 pr-4 h-11 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:border-[#C5A059] focus:ring-1 focus:ring-[#C5A059] transition-all placeholder:text-slate-400"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
          <CustomDropdown 
            options={ESTADOS_USUARIO} 
            value={filters.status} 
            onChange={(val: string) => onFilterChange("status", val)} 
            topLabel="Estado" 
            className="min-w-[180px] z-[60]" 
            heightClass="h-11"
          />
          <CustomDropdown 
            options={rolesOptions} 
            value={filters.role} 
            onChange={(val: string) => onFilterChange("role", val)} 
            topLabel="Rol en el Sistema" 
            className="min-w-[220px] z-[50]" 
            heightClass="h-11"
          />

          <div className="relative z-[40]" ref={popoverRef}>
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className={`h-11 px-5 ml-auto lg:ml-0 rounded-xl text-sm font-bold flex items-center gap-2 transition-all border outline-none relative ${showAdvanced ? "bg-[#fdfaf5] border-[#E8D09E] text-[#7f561e]" : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"}`}
            >
              <Filter size={16} /> Avanzados
            </button>
            {showAdvanced && (
              <div className="absolute right-0 top-full mt-2 w-[300px] bg-white border border-slate-200 shadow-2xl rounded-2xl z-[100] animate-in fade-in slide-in-from-top-2 overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 flex justify-between bg-slate-50/50">
                  <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest">Filtros Secundarios</h3>
                  <button onClick={() => setShowAdvanced(false)} className="text-slate-400 hover:text-slate-700"><X size={16} /></button>
                </div>
                <div className="p-5 space-y-4 text-center">
                  <p className="text-sm font-medium text-slate-500">Más filtros en desarrollo...</p>
                </div>
              </div>
            )}
          </div>

          {hasActiveFilters && (
             <button onClick={onClearFilters} className="h-11 px-4 rounded-xl border border-red-200 bg-red-50 text-red-600 hover:bg-red-500 hover:text-white transition-all flex items-center gap-2 text-sm font-bold shadow-sm outline-none ml-auto xl:ml-0">
               <Trash2 size={16} /> Limpiar
             </button>
          )}
        </div>
      </div>

      <div className="px-6 py-2.5 border-t border-slate-100 flex flex-row items-center justify-between bg-slate-50/50 rounded-b-2xl h-[46px]">
        <span className="text-xs font-bold text-slate-500 flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-[#C5A059] animate-pulse"></span>
          {total} usuario{total !== 1 ? 's' : ''} encontrado{total !== 1 ? 's' : ''}
        </span>
        <div className="flex items-center gap-1.5 sm:gap-2">
          <span className="hidden sm:flex text-[10px] font-black text-slate-400 uppercase tracking-widest items-center gap-1">
            <ArrowDownUp size={12} /> Ordenar:
          </span>
          <div className="w-[140px] sm:w-[150px]">
            <CustomDropdown 
              options={ORDENAR_POR} 
              value={filters.sort} 
              onChange={(val: string) => onFilterChange("sort", val)} 
              heightClass="h-8 !border-none !bg-transparent !pl-0 !pr-6 text-right !text-slate-700 hover:!text-[#C5A059]" 
            />
          </div>
        </div>
      </div>
    </div>
  );
}