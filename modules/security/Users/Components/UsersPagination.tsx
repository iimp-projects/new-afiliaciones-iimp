"use client";

import React, { useState } from "react";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Pin, PinOff } from "lucide-react";

interface UsersPaginationProps {
  meta: { total: number; page: number; pageSize: number; totalPages: number };
  onPageChange: (page: number) => void;
}

export function UsersPagination({ meta, onPageChange }: UsersPaginationProps) {
  const [isSticky, setIsSticky] = useState(false);
  const { page: currentPage, totalPages, total } = meta;

  const getPageNumbers = () => {
    const pages = [];
    const delta = 1; 

    if (totalPages <= 5) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) pages.push("...");

      let start = Math.max(2, currentPage - delta);
      let end = Math.min(totalPages - 1, currentPage + delta);

      if (currentPage === 1) end = 3;
      if (currentPage === totalPages) start = totalPages - 2;

      for (let i = start; i <= end; i++) pages.push(i);

      if (currentPage < totalPages - 2) pages.push("...");
      pages.push(totalPages);
    }
    return pages;
  };

  if (total === 0) return null;

  return (
    <div className={`w-full transition-all duration-300 ${isSticky ? "sticky bottom-4 z-40 mt-8" : "mt-8"}`}>
      <div className={`flex flex-col lg:flex-row items-center justify-between gap-4 bg-white px-6 py-3.5 rounded-2xl border transition-all duration-300 w-full ${isSticky ? 'border-slate-200 shadow-[0_10px_40px_-15px_rgba(0,0,0,0.3)]' : 'border-slate-200 shadow-sm'}`}>
        
        <div className="text-sm font-semibold text-slate-500 whitespace-nowrap">
          Página <span className="text-slate-800 font-black mx-1">{currentPage}</span> de{" "}
          <span className="text-slate-800 font-black ml-1">{totalPages}</span>
          <span className="hidden md:inline font-medium ml-2 opacity-70">
            ({total} usuarios)
          </span>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2">
          <button
            onClick={() => onPageChange(1)}
            disabled={currentPage === 1}
            className="hidden sm:flex items-center gap-1 px-3 py-2 text-xs font-bold rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors focus:outline-none"
          >
            <ChevronsLeft size={16} /> Inicio
          </button>
          <button
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className="flex items-center gap-1 px-3 py-2 text-xs font-bold rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors focus:outline-none"
          >
            <ChevronLeft size={16} /> Atrás
          </button>

          <div className="flex items-center gap-1 mx-1">
            {getPageNumbers().map((p, i) => (
              <button
                key={i}
                onClick={() => (typeof p === "number" ? onPageChange(p) : null)}
                disabled={p === "..."}
                className={`min-w-[36px] h-9 flex items-center justify-center rounded-xl text-sm transition-all focus:outline-none ${
                  p === currentPage
                    ? "bg-slate-800 text-white font-black shadow-md scale-110 z-10"
                    : p === "..."
                    ? "text-slate-400 font-black cursor-default bg-transparent"
                    : "text-slate-600 font-bold hover:bg-slate-100 border border-transparent hover:border-slate-200"
                }`}
              >
                {p}
              </button>
            ))}
          </div>

          <button
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="flex items-center gap-1 px-3 py-2 text-xs font-bold rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors focus:outline-none"
          >
            Adelante <ChevronRight size={16} />
          </button>
          <button
            onClick={() => onPageChange(totalPages)}
            disabled={currentPage === totalPages}
            className="hidden sm:flex items-center gap-1 px-3 py-2 text-xs font-bold rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors focus:outline-none"
          >
            Fin <ChevronsRight size={16} />
          </button>
        </div>

        <div className="flex items-center gap-3 text-sm font-semibold text-slate-500 whitespace-nowrap">
          <div className="flex items-center gap-2">
            <span className="hidden sm:inline">Mostrar</span>
            <span className="h-9 px-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 font-bold flex items-center justify-center">
              12
            </span>
            <span className="hidden sm:inline">por página</span>
          </div>

          <div className="w-px h-6 bg-slate-200 hidden sm:block mx-1"></div>

          <button
            onClick={() => setIsSticky(!isSticky)}
            title={isSticky ? "Desanclar paginación de la pantalla" : "Anclar paginación flotante"}
            className={`hidden sm:flex items-center gap-2 px-3 h-9 rounded-xl transition-all outline-none text-xs font-bold ${
              isSticky 
                ? "bg-[#C5A059] text-white shadow-md hover:bg-[#a67c46]" 
                : "bg-white border border-slate-200 text-slate-400 hover:text-[#C5A059] hover:bg-orange-50"
            }`}
          >
            {isSticky ? <PinOff size={14} /> : <Pin size={14} />}
            {isSticky ? "Fijo" : "Fijar"}
          </button>
        </div>

      </div>
    </div>
  );
}