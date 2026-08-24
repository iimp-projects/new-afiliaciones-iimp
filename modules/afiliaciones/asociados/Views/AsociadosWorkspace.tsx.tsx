"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Download, Filter, LayoutGrid, List, ShieldCheck } from "lucide-react";
import { SmartCaseCard } from "@/modules/shared/Components/SmartCaseCard/SmartCaseCard";
import { SmartCaseRow } from "@/modules/shared/Components/SmartCaseCard/SmartCaseRow";
import { InspectionDrawer } from "@/modules/shared/Components/InspectionDrawer/InspectionDrawer";
import type { DrawerData } from "@/modules/shared/Components/InspectionDrawer/types";
import { AsociadosMapper } from "../Mappers/AsociadosMapper";
import { AsociadoDetailContent } from "./AsociadoDetailContent";

interface AsociadosWorkspaceProps {
  initialData: any[];
  total: number;
  currentPage: number;
  query: string;
  membershipType: string;
}

export function AsociadosWorkspace({ initialData, total, currentPage, query, membershipType }: AsociadosWorkspaceProps) {
  const router = useRouter();
  
  // Estados de UI
  const [searchTerm, setSearchTerm] = useState(query);
  const [selectedType, setSelectedType] = useState(membershipType);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  // Estados del Drawer
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);

  // Ejecuta la búsqueda re-escribiendo la URL (Server Component re-fetchea)
  const executeSearch = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const params = new URLSearchParams();
    if (searchTerm) params.set("q", searchTerm);
    if (selectedType !== "ALL") params.set("type", selectedType);
    params.set("page", "1");
    router.push(`/intranet/asociados?${params.toString()}`);
  };

  const handleOpenDrawer = (user: any) => {
    setSelectedUser(user);
    setIsDrawerOpen(true);
  };

  const buildDrawerData = (): DrawerData<any> | null => {
    if (!selectedUser) return null;
    return {
      caseId: selectedUser.id,
      header: AsociadosMapper.toCardData(selectedUser),
      availableTabs: [
        { id: "profile", label: "Perfil del Asociado", hasNotification: false }
      ],
      defaultTabId: "profile",
      payload: selectedUser
    };
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-12">
      {/* 1. HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-800 tracking-tight">Directorio de Asociados</h1>
          <p className="text-sm font-medium text-slate-500 mt-1.5">
            Membresías oficiales con postulaciones completadas y pagos validados.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 bg-white border border-emerald-200 text-emerald-600 px-4 h-11 rounded-xl font-bold shadow-sm hover:bg-emerald-50 transition-all text-sm">
            <Download size={16} strokeWidth={2.5} /> Exportar Padrón
          </button>
        </div>
      </div>

      {/* 2. FILTROS TIPO PASTILLA EXACTOS AL SCREENSHOT */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col lg:flex-row items-center gap-4">
        <form onSubmit={executeSearch} className="relative w-full lg:flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Buscar por DNI, Nombre o Correo..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full h-12 pl-12 pr-4 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:border-[#C5A059] focus:ring-1 focus:ring-[#C5A059] transition-all"
          />
        </form>

        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
          <div className="relative">
            <span className="absolute -top-2 left-3 bg-white px-1 text-[9px] font-black text-slate-400 uppercase tracking-widest">Membresía</span>
            <select 
              value={selectedType}
              onChange={(e) => {
                setSelectedType(e.target.value);
                // Trigger auto-search on change
                const params = new URLSearchParams();
                if (searchTerm) params.set("q", searchTerm);
                if (e.target.value !== "ALL") params.set("type", e.target.value);
                params.set("page", "1");
                router.push(`/intranet/asociados?${params.toString()}`);
              }}
              className="h-12 px-4 rounded-xl border border-slate-200 text-sm font-bold text-slate-700 bg-white focus:outline-none focus:border-[#C5A059] appearance-none pr-10 cursor-pointer"
            >
              <option value="ALL">Todos los tipos</option>
              <option value="ACTIVE">Asociado Activo</option>
              <option value="STUDENT">Asociado Estudiante</option>
            </select>
          </div>
          <button className="h-12 px-5 flex items-center gap-2 border border-slate-200 text-slate-600 font-bold text-sm rounded-xl hover:bg-slate-50 transition-colors">
            <Filter size={16} strokeWidth={2.5} /> Filtros
          </button>
        </div>
      </div>

      {/* 3. METADATOS Y TOGGLES DE VISTA */}
      <div className="flex justify-between items-center px-2">
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

      {/* 4. RENDERIZADO DE CONTENIDO (GRID/LIST) */}
      {initialData.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-16 flex flex-col items-center justify-center text-center">
          <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-4">
            <ShieldCheck className="w-10 h-10 text-slate-300" />
          </div>
          <h3 className="text-xl font-bold text-slate-700">No hay asociados</h3>
          <p className="text-slate-500 mt-2 max-w-md">
            No se encontraron miembros que coincidan con los filtros aplicados.
          </p>
        </div>
      ) : (
        <>
          {viewMode === "grid" ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
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

      {/* 5. PAGINACIÓN INTELIGENTE CON NEXT/ROUTER */}
      {total > 0 && (
        <div className="bg-white px-6 py-4 rounded-2xl border border-slate-200 shadow-sm flex justify-between items-center text-sm font-bold text-slate-500">
          <span>Página {currentPage}</span>
          <div className="flex gap-2">
            <button 
              disabled={currentPage <= 1}
              onClick={() => {
                const params = new URLSearchParams();
                if (query) params.set("q", query);
                if (membershipType !== "ALL") params.set("type", membershipType);
                params.set("page", (currentPage - 1).toString());
                router.push(`/intranet/asociados?${params.toString()}`);
              }}
              className="px-4 py-2 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 transition-colors"
            >
              Anterior
            </button>
            <button 
              disabled={currentPage * 12 >= total}
              onClick={() => {
                const params = new URLSearchParams();
                if (query) params.set("q", query);
                if (membershipType !== "ALL") params.set("type", membershipType);
                params.set("page", (currentPage + 1).toString());
                router.push(`/intranet/asociados?${params.toString()}`);
              }}
              className="px-4 py-2 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 transition-colors"
            >
              Siguiente
            </button>
          </div>
        </div>
      )}

      {/* 6. EL INSPECTION DRAWER OFICIAL */}
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