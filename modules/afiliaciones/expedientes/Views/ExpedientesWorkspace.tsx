"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { WorkspaceHeader } from "../Components/Workspace/WorkspaceHeader";
import { WorkspaceOmnibar } from "../Components/Workspace/WorkspaceOmnibar";
import { AfiliacionCardAdapter } from "../Components/Adapters/AfiliacionCardAdapter";
import { AfiliacionRowAdapter } from "../Components/Adapters/AfiliacionRowAdapter";
import { AfiliacionDrawerAdapter } from "../Components/Adapters/AfiliacionDrawerAdapter";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, ChevronDown } from "lucide-react";
import { expedientesApi } from "../Services/ExpedientesApi";
import type { SmartCaseCardData } from "@/modules/shared/Components/SmartCaseCard/types";

export function ExpedientesWorkspace() {
  const [viewMode, setViewMode] = useState<"GRID" | "LIST">("GRID");
  const searchParams = useSearchParams();
  
  // Estado para la data real
  const [data, setData] = useState<SmartCaseCardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [meta, setMeta] = useState({ total: 0, page: 1, totalPages: 1 });

  // Efecto que reacciona a los cambios en la URL
  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    const query = searchParams.toString();
    
    expedientesApi.getWorkspaceCases(query)
      .then((res) => {
        if (isMounted) {
          // SOLUCIÓN: Defensa absoluta. Si res.items falla o no viene, forza un array vacío []
          setData(res?.items || []);
          setMeta(res?.meta || { total: 0, page: 1, totalPages: 1 });
        }
      })
      .catch((err) => {
        console.error("Error cargando expedientes:", err);
        if (isMounted) setData([]); // Evita que se quede en 'undefined'
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => { isMounted = false; };
  }, [searchParams]);

  // SOLUCIÓN: Forzamos que safeData SIEMPRE sea un Array antes del render
  const safeData = data || [];

  return (
    <div className="flex flex-col h-[calc(100vh-120px)] relative bg-[#F4F5F7]">
      <WorkspaceHeader />
      <WorkspaceOmnibar viewMode={viewMode} onViewChange={setViewMode} />

      {/* ÁREA DE CONTENIDO DINÁMICO */}
      <div className="flex-1 overflow-y-auto px-8 pb-8 scrollbar-thin scrollbar-thumb-slate-200">
        {loading ? (
          <div className="w-full h-full flex flex-col items-center justify-center opacity-60">
             <svg className="animate-spin h-10 w-10 text-[#C5A059] mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
             <p className="font-bold text-slate-500">Sincronizando expedientes...</p>
          </div>
        ) : safeData.length === 0 ? (
          <div className="w-full h-full flex flex-col items-center justify-center">
             <p className="text-lg font-bold text-slate-400">Bandeja limpia</p>
             <p className="text-sm text-slate-400 mt-1">No hay expedientes bajo estos filtros.</p>
          </div>
        ) : (
          viewMode === "GRID" ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {safeData.map((card) => (
                <AfiliacionCardAdapter key={card.id} data={card} />
              ))}
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm flex flex-col">
              <div className="bg-slate-50/80 px-6 py-3 border-b border-slate-200 flex text-xs font-black text-slate-400 uppercase tracking-wider">
                 <div className="w-[350px]">Expediente y Postulante</div>
                 <div className="w-[180px] px-4">Estado Principal</div>
                 <div className="flex-1 px-8">Validaciones</div>
                 <div className="ml-auto w-[250px] text-right">Metadatos</div>
              </div>
              {safeData.map((card) => (
                <AfiliacionRowAdapter key={card.id} data={card} />
              ))}
            </div>
          )
        )}
      </div>

      {/* Paginación Dinámica */}
      <footer className="px-8 py-5 border-t border-slate-200/80 bg-white flex flex-col sm:flex-row items-center justify-between gap-4 shrink-0">
        <span className="text-[13px] font-bold text-[#4a6ab0]">
          Mostrando página {meta.page} de {meta.totalPages} ({meta.total} expedientes)
        </span>
        
        <div className="flex items-center gap-1.5">
          <button disabled={meta.page <= 1} className="p-2 text-[#4a6ab0] hover:bg-blue-50 rounded-lg font-black transition-colors disabled:opacity-30"><ChevronLeft size={16} strokeWidth={3}/></button>
          
          <div className="flex items-center mx-1 gap-1">
            <button className="w-8 h-8 rounded-lg bg-[#e29b38] text-white text-[13px] font-bold shadow-sm">{meta.page}</button>
          </div>

          <button disabled={meta.page >= meta.totalPages} className="p-2 text-[#4a6ab0] hover:bg-blue-50 rounded-lg font-black transition-colors disabled:opacity-30"><ChevronRight size={16} strokeWidth={3}/></button>
        </div>

        <div className="flex items-center gap-2 border border-slate-200 px-4 py-2 rounded-xl bg-white shadow-sm">
          <span className="text-[13px] font-bold text-slate-700">10 por página</span>
        </div>
      </footer>

      <AfiliacionDrawerAdapter />
    </div>
  );
}