"use client";

import { useState } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  History,
  ShieldCheck 
} from "lucide-react";
import { InspectionDrawer } from "@/modules/shared/Components/InspectionDrawer/InspectionDrawer";
import { mockDrawerData, mockSmartCaseCards } from "../../Mocks/ExpedientesMockData";
import { useKeyboardDrawerNavigation } from "../../Hooks/useKeyboardDrawerNavigation";

// Mapeo del rol del usuario a las áreas de tu flujo
const roleDeptMap: Record<string, string> = {
  "ATENCION_ASOCIADO": "Asociados",
  "LOGISTICA": "Logística",
  "COMITE_EVALUADOR": "Comité",
};

// ============================================================================
// CONTENIDO DE LA PESTAÑA RESUMEN (Aquí está toda la magia de negocio)
// ============================================================================
const ResumenTabContent = ({ payload, onUpdateStatus, onOpenObservacionModal }: any) => {
  // 1. SIMULACIÓN DE USUARIO LOGUEADO (Conecta esto con tu Contexto o Session real)
  const userRoleSlug = "ATENCION_ASOCIADO"; 
  const miAreaLabel = roleDeptMap[userRoleSlug] || "";

  // 2. LÓGICA DE APROBACIÓN: ¿Mi área ya otorgó conformidad?
  const miValidacion = payload.atomicValidations?.find((v: any) => v.label === miAreaLabel);
  const yaEstaAprobado = miValidacion?.status === 'check' || miValidacion?.status === 'APPROVED';

  // 3. HISTORIAL DE OBSERVACIONES (Extraído de los metadatos)
  const historialObservaciones = payload.metadata?.history?.filter(
    (h: any) => h.action === 'OBSERVED' || h.action === 'RESOLVED'
  ) || [];

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
      
      {/* 1. CABECERA: IDENTIDAD Y ROL EVALUADOR */}
      <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 flex items-start justify-between shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-white border border-slate-200 shadow-sm flex items-center justify-center overflow-hidden shrink-0">
            {payload.identity?.avatarUrl ? (
              <img src={payload.identity.avatarUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="text-lg font-black text-slate-400">{payload.identity?.fallbackInitials}</span>
            )}
          </div>
          <div className="flex flex-col overflow-hidden">
            <h2 className="text-lg font-black text-slate-800 leading-tight truncate">
              {payload.identity?.title}
            </h2>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-1 font-mono truncate">
              {payload.trackingCode} • DNI {payload.identity?.subtitle?.replace('DNI ', '')}
            </p>
          </div>
        </div>

        {/* Etiqueta dinámica de quién está evaluando */}
        <div className="text-right shrink-0 pl-4">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1">
            Evaluando como:
          </span>
          <span className="bg-gradient-to-r from-[#C5A059]/10 to-[#9E7832]/10 text-[#a3722a] px-3 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wider border border-[#C5A059]/20 shadow-sm whitespace-nowrap">
            {userRoleSlug.replace(/_/g, ' ')}
          </span>
        </div>
      </div>

      {/* 2. ESTADO GENERAL DE LAS ÁREAS */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <h3 className="text-sm font-black text-slate-800 mb-4 flex items-center gap-2">
          <ShieldCheck size={18} className="text-[#C5A059]" /> Progreso de Evaluación
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {payload.atomicValidations?.map((val: any, idx: number) => (
            <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
              <span className="text-xs font-bold text-slate-700">{val.label}</span>
              <span className={`px-2.5 py-1 rounded-md text-[10px] uppercase tracking-wider font-bold ${val.statusColorClass}`}>
                {val.statusLabel}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* 3. HISTORIAL DE OBSERVACIONES (Si el expediente tuvo idas y vueltas) */}
      {historialObservaciones.length > 0 && (
        <div className="bg-red-50/40 border border-red-100 p-5 rounded-2xl">
          <h4 className="text-sm font-bold text-red-800 mb-4 flex items-center gap-2">
            <History size={18} /> Historial de Observaciones
          </h4>
          <div className="space-y-4 pl-3 border-l-2 border-red-200">
            {historialObservaciones.map((obs: any, idx: number) => (
              <div key={idx} className="relative pl-5">
                <span className={`absolute -left-[23px] top-1 w-3 h-3 rounded-full ring-4 ring-red-50 ${obs.action === 'OBSERVED' ? 'bg-red-500' : 'bg-amber-500'}`} />
                <p className="text-xs font-bold text-slate-800">
                  {obs.action === 'OBSERVED' ? 'Observado por ' : 'Subsanado por '} {obs.author}
                </p>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed bg-white p-3 rounded-lg border border-red-100 shadow-sm">
                  "{obs.comment}"
                </p>
                <p className="text-[10px] text-slate-400 font-medium mt-1.5">{obs.date}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. BOTONES DINÁMICOS DE ACCIÓN */}
      <div className="mt-8 pt-6 border-t border-slate-200">
        <h3 className="text-sm font-bold text-slate-800 mb-4">Acciones de Evaluación</h3>
        
        {yaEstaAprobado ? (
          <div className="flex flex-col gap-3 animate-in fade-in slide-in-from-bottom-2">
            {/* Mensaje de Éxito (Reemplaza a los botones) */}
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 p-4 rounded-xl flex items-center justify-center gap-2 font-bold shadow-sm text-sm">
              <CheckCircle2 size={20} className="shrink-0" />
              Tu área ya otorgó la conformidad a este expediente.
            </div>

            {/* Botón Reabrir */}
            <button 
              onClick={() => onUpdateStatus('PENDING', 'Reapertura de expediente para evaluación adicional')}
              className="text-xs font-bold text-slate-400 hover:text-[#C5A059] transition-colors flex items-center justify-center gap-2 mt-2 w-max mx-auto px-4 py-2 rounded-lg hover:bg-slate-50 outline-none"
            >
              <RefreshCw size={14} /> Deshacer validación (Reabrir expediente)
            </button>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row gap-4 animate-in fade-in">
            {/* BOTÓN 1: Otorgar Conformidad (Único botón para aprobar) */}
            <button 
              onClick={() => onUpdateStatus('APPROVED', 'Conformidad otorgada por el área')}
              className="flex-1 bg-gradient-to-r from-[#C5A059] to-[#9E7832] text-white font-bold py-3.5 rounded-xl hover:-translate-y-0.5 shadow-lg shadow-[#C5A059]/30 transition-all flex items-center justify-center gap-2 outline-none text-sm"
            >
              <CheckCircle2 size={18} />
              Otorgar Conformidad
            </button>

            {/* BOTÓN 2: Observar Expediente */}
            <button 
              onClick={onOpenObservacionModal}
              className="flex-1 bg-white border border-red-200 text-red-600 font-bold py-3.5 rounded-xl hover:bg-red-50 hover:border-red-300 transition-all flex items-center justify-center gap-2 outline-none text-sm shadow-sm"
            >
              <AlertCircle size={18} />
              Observar Expediente
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// ============================================================================
// COMPONENTE CONTENEDOR PRINCIPAL
// ============================================================================
export function AfiliacionDrawerAdapter() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  
  const activeCaseCode = searchParams.get("case");
  const fakeExpedientesList = mockSmartCaseCards.map((c: any) => ({ applicationCode: c.trackingCode } as any));
  
  useKeyboardDrawerNavigation(fakeExpedientesList);

  const closeDrawer = () => {
    const newParams = new URLSearchParams(searchParams.toString());
    newParams.delete("case");
    router.replace(`${pathname}?${newParams.toString()}`, { scroll: false });
  };

  const jumpToOffset = (offset: number) => {
    const currentIndex = fakeExpedientesList.findIndex((e: any) => e.applicationCode === activeCaseCode);
    if (currentIndex === -1) return;
    const target = fakeExpedientesList[currentIndex + offset];
    if (target) {
      const newParams = new URLSearchParams(searchParams.toString());
      newParams.set("case", target.applicationCode);
      router.replace(`${pathname}?${newParams.toString()}`, { scroll: false });
    }
  };

  // FUNCIONES DE CONEXIÓN A TU API
  const handleUpdateStatus = async (newStatus: string, reason?: string) => {
    console.log("Actualizando área a:", newStatus, "Motivo:", reason);
    // Aquí invocas tu fetch a la ruta PATCH /api/afiliaciones/expedientes/[id]/status
  };

  const handleOpenObservacionModal = () => {
    console.log("Abriendo modal para escribir motivo de observación...");
    // Aquí cambias el estado para mostrar el modal de observación
  };

  if (!activeCaseCode) return null;

  const currentCase = mockSmartCaseCards.find((c: any) => c.trackingCode === activeCaseCode) || mockSmartCaseCards[0];
  
  const dataToInject = {
    ...mockDrawerData,
    header: currentCase
  };

  const renderTabContent = (tabId: string) => {
    if (tabId === "summary") {
      return (
        <ResumenTabContent 
          payload={currentCase}
          onUpdateStatus={handleUpdateStatus}
          onOpenObservacionModal={handleOpenObservacionModal}
        />
      );
    }
    return <div className="p-6 text-center text-slate-400">Contenido en construcción</div>;
  };

  return (
    <InspectionDrawer 
      isOpen={!!activeCaseCode} 
      onClose={closeDrawer} 
      onNext={() => jumpToOffset(1)} 
      onPrev={() => jumpToOffset(-1)} 
      data={dataToInject} 
      renderContent={renderTabContent} 
    />
  );
}