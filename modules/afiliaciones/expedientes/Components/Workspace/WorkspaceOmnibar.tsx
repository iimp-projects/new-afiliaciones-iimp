"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Search, Filter, LayoutGrid, List } from "lucide-react";

interface WorkspaceOmnibarProps {
  viewMode: "GRID" | "LIST";
  onViewChange: (mode: "GRID" | "LIST") => void;
}

export function WorkspaceOmnibar({ viewMode, onViewChange }: WorkspaceOmnibarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [inputValue, setInputValue] = useState(searchParams.get("query") || "");

  useEffect(() => {
    const handler = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (inputValue.trim()) params.set("query", inputValue.trim());
      else params.delete("query");
      params.delete("page"); 
      router.replace(`${pathname}?${params.toString()}`);
    }, 400);
    return () => clearTimeout(handler);
  }, [inputValue, pathname, router, searchParams]);

  return (
    <div className="flex flex-col sm:flex-row gap-4 justify-between items-center mb-6 z-10 relative">
      <div className="relative w-full sm:w-[450px]">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input 
          type="text" placeholder="Buscar por DNI, Nombre o APP-..."
          value={inputValue} onChange={(e) => setInputValue(e.target.value)}
          className="w-full pl-10 pr-4 h-12 bg-white border border-slate-200 hover:border-[#C5A059]/50 rounded-2xl text-sm font-bold text-slate-700 focus:outline-none focus:ring-4 focus:ring-[#C5A059]/10 transition-all shadow-sm placeholder:font-medium placeholder:text-slate-400"
        />
      </div>
      <div className="flex items-center gap-3">
        <button className="h-12 px-5 flex items-center gap-2 bg-white border border-slate-200 rounded-2xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition-colors shadow-sm">
          <Filter size={16} /> Filtros
        </button>
        <div className="flex items-center p-1 bg-white border border-slate-200 rounded-2xl shadow-sm h-12">
          <button onClick={() => onViewChange("GRID")} className={`p-2 rounded-xl transition-all ${viewMode === "GRID" ? "bg-slate-100 text-slate-800 shadow-sm" : "text-slate-400 hover:text-slate-600"}`}><LayoutGrid size={18} /></button>
          <button onClick={() => onViewChange("LIST")} className={`p-2 rounded-xl transition-all ${viewMode === "LIST" ? "bg-slate-100 text-slate-800 shadow-sm" : "text-slate-400 hover:text-slate-600"}`}><List size={18} /></button>
        </div>
      </div>
    </div>
  );
}