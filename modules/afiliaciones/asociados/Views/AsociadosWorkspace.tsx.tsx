"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Download, LayoutGrid, List, ShieldCheck } from "lucide-react";
import { SmartCaseCard } from "@/modules/shared/Components/SmartCaseCard/SmartCaseCard";
import { SmartCaseRow } from "@/modules/shared/Components/SmartCaseCard/SmartCaseRow";
import { InspectionDrawer } from "@/modules/shared/Components/InspectionDrawer/InspectionDrawer";
import type { DrawerData } from "@/modules/shared/Components/InspectionDrawer/types";
import { AsociadosMapper } from "../Mappers/AsociadosMapper";
import { AsociadoDetailContent } from "./AsociadoDetailContent";
import { AsociadosFilterBar } from "../Components/AsociadosFilterBar";
import { AsociadosPagination } from "../Components/AsociadosPagination";

interface AsociadosWorkspaceProps {
  initialData: any[];
  total: number;
  currentPage: number;
  query: string;
  membershipType: string;
  sort: string;
}

export function AsociadosWorkspace({ initialData, total, currentPage, query, membershipType, sort }: AsociadosWorkspaceProps) {
  const router = useRouter();
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  // Estados del Drawer
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);

  const handleOpenDrawer = (user: any) => {
    setSelectedUser(user);
    setIsDrawerOpen(true);
  };

  // ✅ MAGIA: Creamos las pestañas dinámicamente usando la misma estructura de Expedientes
  const buildDrawerData = (): DrawerData<any> | null => {
    if (!selectedUser) return null;
    
    const isStudent = selectedUser.role?.slug === "ASOCIADO_ESTUDIANTE";

    const tabs = [
      { id: "resumen", label: "Resumen General", hasNotification: false },
      { id: "personal", label: "Datos Personales", hasNotification: false },
      { id: "academico", label: "Formación Académica", hasNotification: false },
    ];

    // Si es profesional, le agregamos la pestaña laboral
    if (!isStudent) {
      tabs.push({ id: "laboral", label: "Información Laboral", hasNotification: false });
    }

    return {
      caseId: selectedUser.id,
      header: AsociadosMapper.toCardData(selectedUser),
      availableTabs: tabs,
      defaultTabId: "resumen", // ✅ Iniciamos en el resumen
      payload: selectedUser
    };
  };

  return (
    <div className="flex flex-col relative animate-in fade-in slide-in-from-bottom-4 duration-500 min-h-[calc(100vh-8rem)] pb-4">
      
      {/* 1. TARJETA SUPERIOR */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm mb-5 flex flex-col relative z-20">
        <div className="px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100">
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight leading-none">
                Directorio de Asociados
            </h1>
            <p className="text-xs sm:text-sm font-medium text-slate-500 mt-1.5">
                Membresías oficiales con postulaciones completadas y pagos validados.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button className="flex items-center justify-center gap-1.5 px-4 h-9 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 rounded-lg text-xs font-bold transition-all shadow-sm focus:outline-none">
              <Download size={14} strokeWidth={2.5} /> Exportar Padrón
            </button>
          </div>
        </div>

        <AsociadosFilterBar 
            total={total} 
            currentQuery={query} 
            currentType={membershipType} 
            currentSort={sort} 
        />
      </div>

      {/* 2. CONTROLES DE VISTA */}
      <div className="flex justify-between items-center px-2 mb-4">
        <div className="flex items-center gap-2 text-sm font-bold text-slate-500">
          <span className="w-2 h-2 rounded-full bg-[#C5A059] animate-pulse"></span>
          {total} asociados registrados
        </div>
        <div className="flex items-center gap-2 bg-white rounded-lg p-1 border border-slate-200 shadow-sm">
          <button
            onClick={() => setViewMode("grid")}
            className={`p-1.5 rounded-md transition-colors ${viewMode === "grid" ? "bg-slate-100 text-slate-800 shadow-sm" : "text-slate-400 hover:text-slate-600"}`}
          >
            <LayoutGrid size={18} strokeWidth={2.5} />
          </button>
          <button
            onClick={() => setViewMode("list")}
            className={`p-1.5 rounded-md transition-colors ${viewMode === "list" ? "bg-slate-100 text-slate-800 shadow-sm" : "text-slate-400 hover:text-slate-600"}`}
          >
            <List size={18} strokeWidth={2.5} />
          </button>
        </div>
      </div>

      {/* 3. RENDERIZADO DE CONTENIDO (GRID/LIST) */}
      <div className="relative z-10 min-h-[300px]">
        {initialData.length === 0 ? (
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-16 flex flex-col items-center justify-center text-center mt-4">
            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
              <ShieldCheck className="w-8 h-8 text-slate-300" />
            </div>
            <h3 className="text-lg font-bold text-slate-700">No hay asociados</h3>
            <p className="text-sm text-slate-500 mt-2 max-w-md">
              No se encontraron miembros que coincidan con los filtros aplicados.
            </p>
          </div>
        ) : (
          <>
            {viewMode === "grid" ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                {initialData.map((user) => (
                  <SmartCaseCard 
                    key={user.id} 
                    data={AsociadosMapper.toCardData(user)} 
                    onClick={() => handleOpenDrawer(user)} 
                  />
                ))}
              </div>
            ) : (
              <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                {initialData.map((user) => (
                  <SmartCaseRow 
                    key={user.id} 
                    data={AsociadosMapper.toCardData(user)} 
                    onClick={() => handleOpenDrawer(user)} 
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <div className="flex-1"></div>

      {/* 4. PAGINACIÓN */}
      {total > 0 && (
         <AsociadosPagination 
            total={total} 
            currentPage={currentPage} 
         />
      )}

      {/* 5. INSPECTION DRAWER OFICIAL */}
      <InspectionDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        data={buildDrawerData()}
        renderContent={(tab, payload) => (
          <AsociadoDetailContent tab={tab} user={payload} />
        )}
      />
    </div>
  );
}