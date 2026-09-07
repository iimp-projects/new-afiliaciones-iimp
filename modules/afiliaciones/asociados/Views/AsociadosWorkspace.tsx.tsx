"use client";
/* eslint-disable @typescript-eslint/no-explicit-any -- the existing shared drawer payload is intentionally untyped. */

import { useState } from "react";
import { Download, ShieldCheck } from "lucide-react";
import { SmartCaseCard } from "@/modules/shared/Components/SmartCaseCard/SmartCaseCard";
import { SmartCaseRow } from "@/modules/shared/Components/SmartCaseCard/SmartCaseRow";
import { InspectionDrawer } from "@/modules/shared/Components/InspectionDrawer/InspectionDrawer";
import type { DrawerData } from "@/modules/shared/Components/InspectionDrawer/types";
import { AsociadosMapper } from "../Mappers/AsociadosMapper";
import { AsociadoDetailContent } from "./AsociadoDetailContent";
import { AsociadosFilterBar } from "../Components/AsociadosFilterBar";
import { AsociadosPagination } from "../Components/AsociadosPagination";

interface AsociadosWorkspaceProps { initialData: any[]; total: number; currentPage: number; query: string; membershipType: string; sort: string; canResetSandboxPayments: boolean; }

export function AsociadosWorkspace({ initialData, total, currentPage, query, membershipType, sort, canResetSandboxPayments }: AsociadosWorkspaceProps) {
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const drawerData = (): DrawerData<any> | null => {
    if (!selectedUser) return null;
    return { caseId: selectedUser.id, header: AsociadosMapper.toCardData(selectedUser), availableTabs: [
      { id: "resumen", label: "Resumen", hasNotification: false }, { id: "informacion", label: "Información", hasNotification: false }, { id: "membresia", label: "Membresía", hasNotification: false }, { id: "pagos", label: "Pagos", hasNotification: false }, { id: "cuenta", label: "Cuenta", hasNotification: false }, { id: "documentos", label: "Documentos", hasNotification: false }, { id: "historial", label: "Historial", hasNotification: false },
    ], defaultTabId: "resumen", payload: selectedUser };
  };

  return <div className="relative flex min-h-[calc(100vh-8rem)] flex-col animate-in fade-in slide-in-from-bottom-4 duration-500">
    <div className="relative z-20 mb-5 flex flex-col rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="flex flex-col gap-4 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"><div><h1 className="text-xl font-black tracking-tight text-slate-800 sm:text-2xl">Directorio de Asociados</h1><p className="mt-1.5 text-xs font-medium text-slate-500 sm:text-sm">Personas con membresía institucional y proceso de afiliación completado.</p></div><button className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-4 text-xs font-bold text-emerald-700 shadow-sm transition hover:bg-emerald-100"><Download size={14} strokeWidth={2.5}/>Exportar padrón</button></div><AsociadosFilterBar total={total} currentQuery={query} currentType={membershipType} currentSort={sort} viewMode={viewMode} onViewModeChange={setViewMode}/></div>
    <div className="relative z-10 min-h-[300px]">{initialData.length === 0 ? <div className="mt-4 flex flex-col items-center justify-center rounded-3xl border border-slate-200 bg-white p-16 text-center shadow-sm"><div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-50"><ShieldCheck className="h-8 w-8 text-slate-300"/></div><h3 className="text-lg font-bold text-slate-700">No hay asociados</h3><p className="mt-2 max-w-md text-sm text-slate-500">No se encontraron miembros que coincidan con los filtros aplicados.</p></div> : viewMode === "grid" ? <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{initialData.map((user) => <SmartCaseCard key={user.id} data={AsociadosMapper.toCardData(user)} onClick={() => setSelectedUser(user)}/>)}</div> : <div className="flex flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">{initialData.map((user) => <SmartCaseRow key={user.id} data={AsociadosMapper.toCardData(user)} onClick={() => setSelectedUser(user)}/>)}</div>}</div>
    {total > 0 && <AsociadosPagination total={total} currentPage={currentPage}/>}<InspectionDrawer isOpen={Boolean(selectedUser)} onClose={() => setSelectedUser(null)} data={drawerData()} renderContent={(tab, payload) => <AsociadoDetailContent tab={tab} user={payload} canResetSandboxPayments={canResetSandboxPayments}/>}/>
  </div>;
}
