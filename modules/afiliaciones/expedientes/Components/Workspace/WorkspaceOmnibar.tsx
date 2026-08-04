"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Search, Filter, LayoutGrid, List, FilterX } from "lucide-react";

interface WorkspaceOmnibarProps {
  viewMode: "GRID" | "LIST";
  onViewChange: (mode: "GRID" | "LIST") => void;
}

export function WorkspaceOmnibar({ viewMode, onViewChange }: WorkspaceOmnibarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [inputValue, setInputValue] = useState(searchParams.get("query") || "");

  // SOLUCIÓN AL BUCLE: Convertimos a string para que React no se confunda
  const currentQueryString = searchParams.toString();

  useEffect(() => {
    const handler = setTimeout(() => {
      const params = new URLSearchParams(currentQueryString);
      const trimmedValue = inputValue.trim();
      
      if (trimmedValue) params.set("query", trimmedValue);
      else params.delete("query");
      params.delete("page"); 

      const newQueryString = params.toString();
      
      // SOLUCIÓN AL BUCLE: Solo actualiza si realmente cambió algo
      if (newQueryString !== currentQueryString) {
        router.replace(`${pathname}?${newQueryString}`, { scroll: false });
      }
    }, 400);

    return () => clearTimeout(handler);
  }, [inputValue, pathname, router, currentQueryString]);

  return (
    <div className="px-8 pb-6 border-b border-slate-200/60 flex flex-col sm:flex-row items-center justify-between gap-4">
      <div className="relative w-full sm:w-[450px]">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input 
          type="text" placeholder="Buscar por DNI, Nombre o APP-..."
          value={inputValue} onChange={(e) => setInputValue(e.target.value)}
          className="w-full pl-10 pr-4 h-12 bg-white border border-slate-200 hover:border-[#C5A059]/50 rounded-xl text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#C5A059]/20 transition-all shadow-sm placeholder:font-medium placeholder:text-slate-400"
        />
      </div>
      <div className="flex items-center gap-3 w-full sm:w-auto">
        <button className="h-12 px-5 flex items-center gap-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition-colors shadow-sm">
          <Filter size={16} /> Filtros
        </button>
        <button className="flex items-center gap-2 text-slate-400 hover:text-slate-700 transition-colors ml-2 px-3">
            <FilterX size={16} strokeWidth={2.5} />
            <span className="text-[12px] font-bold">Limpiar</span>
        </button>
      </div>
    </div>
  );
}