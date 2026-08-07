"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, ChevronDown } from "lucide-react";

interface PaginationProps {
  meta: { total: number; page: number; pageSize: number; totalPages: number };
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}

export function ExpedientesPagination({ meta, onPageChange, onPageSizeChange }: PaginationProps) {
  const { page, totalPages, pageSize } = meta;

  // Manejadores de navegación
  const handleFirst = () => { if (page > 1) onPageChange(1); };
  const handlePrev = () => { if (page > 1) onPageChange(page - 1); };
  const handleNext = () => { if (page < totalPages) onPageChange(page + 1); };
  const handleLast = () => { if (page < totalPages) onPageChange(totalPages); };

  // Lógica para mostrar siempre 3 números alrededor de la página actual
  const getVisiblePages = () => {
    let start = Math.max(1, page - 1);
    let end = Math.min(totalPages, page + 1);

    if (page === 1 && totalPages >= 3) end = 3;
    if (page === totalPages && totalPages >= 3) start = totalPages - 2;

    const pages = [];
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    return pages;
  };

  const visiblePages = getVisiblePages();

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex flex-col sm:flex-row items-center justify-between w-full mt-6">
      
      {/* Columna Izquierda: Espaciador invisible para mantener el centrado perfecto en Desktop */}
      <div className="hidden sm:block flex-1 text-sm font-medium text-slate-500">
        Página {page} de {totalPages || 1}
      </div>

      {/* Columna Central: Controles de Paginación */}
      <div className="flex items-center gap-1.5 flex-1 justify-center mb-4 sm:mb-0">
        
        {/* Botón Inicio */}
        <button 
          onClick={handleFirst} 
          disabled={page === 1}
          title="Ir al inicio"
          className="w-9 h-9 flex items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-[#C5A059]/10 hover:text-[#C5A059] hover:border-[#C5A059]/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronsLeft size={18} strokeWidth={2.5} />
        </button>

        {/* Botón Atrás */}
        <button 
          onClick={handlePrev} 
          disabled={page === 1}
          title="Página anterior"
          className="w-9 h-9 flex items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-[#C5A059]/10 hover:text-[#C5A059] hover:border-[#C5A059]/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft size={18} strokeWidth={2.5} />
        </button>
        
        {/* Números Dinámicos */}
        {visiblePages.map(p => (
          <button 
            key={p}
            onClick={() => onPageChange(p)}
            className={`w-9 h-9 flex items-center justify-center rounded-lg text-sm transition-colors ${
              page === p 
                ? "bg-[#2F3136] text-white font-bold shadow-md" 
                : "bg-white border border-slate-200 text-slate-600 font-medium hover:bg-[#C5A059]/10 hover:text-[#C5A059] hover:border-[#C5A059]/30"
            }`}
          >
            {p}
          </button>
        ))}

        {/* Botón Siguiente */}
        <button 
          onClick={handleNext} 
          disabled={page === totalPages || totalPages === 0}
          title="Página siguiente"
          className="w-9 h-9 flex items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-[#C5A059]/10 hover:text-[#C5A059] hover:border-[#C5A059]/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronRight size={18} strokeWidth={2.5} />
        </button>

        {/* Botón Final */}
        <button 
          onClick={handleLast} 
          disabled={page === totalPages || totalPages === 0}
          title="Ir al final"
          className="w-9 h-9 flex items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-[#C5A059]/10 hover:text-[#C5A059] hover:border-[#C5A059]/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronsRight size={18} strokeWidth={2.5} />
        </button>
      </div>

      {/* Columna Derecha: Selector de cantidad personalizado */}
      <div className="flex items-center gap-3 text-sm font-medium text-slate-500 flex-1 justify-end">
        <span>Mostrar</span>
        <CustomSelect 
          value={pageSize} 
          options={[8, 16, 24, 48]} 
          onChange={(val) => onPageSizeChange(val)} 
        />
        <span>por página</span>
      </div>
    </div>
  );
}

// ============================================================================
// COMPONENTE: Selector Personalizado (Elimina el azul genérico del navegador)
// ============================================================================
function CustomSelect({ value, options, onChange }: { value: number, options: number[], onChange: (val: number) => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Cerrar al hacer clic fuera
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between w-[68px] h-9 bg-white border border-slate-200 rounded-lg px-3 text-sm font-bold text-slate-700 hover:border-[#C5A059] focus:outline-none focus:ring-2 focus:ring-[#C5A059]/20 transition-all"
      >
        {value}
        <ChevronDown size={14} className={`text-slate-400 transition-transform duration-200 ${isOpen ? "rotate-180 text-[#C5A059]" : ""}`} />
      </button>

      {isOpen && (
        <div className="absolute bottom-full mb-2 left-0 w-full bg-white border border-slate-200 rounded-xl shadow-[0_10px_40px_-15px_rgba(0,0,0,0.15)] overflow-hidden z-[100] animate-in fade-in zoom-in-95">
          <ul className="flex flex-col p-1">
            {options.map((opt) => (
              <li
                key={opt}
                onClick={() => {
                  onChange(opt);
                  setIsOpen(false);
                }}
                className={`px-3 py-2 text-sm font-bold rounded-lg cursor-pointer transition-colors text-center ${
                  value === opt
                    ? "bg-[#C5A059] text-white"
                    : "text-slate-600 hover:bg-[#C5A059]/10 hover:text-[#C5A059]"
                }`}
              >
                {opt}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}