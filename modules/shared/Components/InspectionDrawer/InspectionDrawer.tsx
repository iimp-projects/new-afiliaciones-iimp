"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X, Maximize2, Minimize2, UserCheck } from "lucide-react";
import { useTheaterMode, TheaterModeProvider } from "./TheaterModeContext";
import type { DrawerData } from "./types";
import { FallbackAvatar } from "../SmartCaseCard/FallbackAvatar";
import { DynamicIcon } from "@/modules/layout/Utils/DynamicIcon";

interface InspectionDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  data: DrawerData<any> | null;
  renderContent: (activeTab: string, payload: any) => React.ReactNode;
  onReevaluate?: () => void; // <-- AÑADIDO PARA LA CONEXIÓN
}

const getBadgeIconName = (iconType: string) => {
  if (iconType === "review") return "AlertCircle";
  if (iconType === "check") return "CheckCircle2";
  if (iconType === "error") return "XCircle";
  if (iconType === "dash") return "MinusCircle";
  return "Clock";
};

function DrawerInner({
  data,
  onClose,
  renderContent,
  onReevaluate, // <-- AÑADIDO PARA LA CONEXIÓN
}: Omit<InspectionDrawerProps, "isOpen">) {
  const { isTheaterMode, toggleTheaterMode } = useTheaterMode();
  const [activeTab, setActiveTab] = useState(data?.defaultTabId || "");

  useEffect(() => {
    if (data?.defaultTabId) setActiveTab(data.defaultTabId);
  }, [data?.defaultTabId]);

  if (!data) return null;
  const { header, availableTabs, payload } = data;

  return (
    <>
      <div
        className="fixed inset-0 bg-slate-900/50 backdrop-blur-[2px] transition-opacity z-[99990]"
        onClick={onClose}
      />

      <div
        className={`fixed top-0 right-0 h-full bg-white shadow-2xl transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] z-[99999] flex flex-col border-l border-slate-200 
        ${isTheaterMode ? "w-full w-[100vw]" : "w-full sm:w-[450px] md:w-[500px] lg:w-[600px]"}`}
      >
        <header className="shrink-0 flex items-start gap-4 px-5 sm:px-8 pt-12 sm:pt-16 pb-5 relative bg-white border-b border-slate-50">
          <div className="absolute top-4 right-4 flex items-center gap-2 z-10">
            <button
              onClick={toggleTheaterMode}
              title={isTheaterMode ? "Reducir panel" : "Expandir a pantalla completa"}
              className="p-2 text-slate-400 hover:text-[#C5A059] bg-slate-50 hover:bg-[#C5A059]/10 rounded-full transition-all focus:outline-none"
            >
              {isTheaterMode ? <Minimize2 size={18} strokeWidth={2.5} /> : <Maximize2 size={18} strokeWidth={2.5} />}
            </button>
            <button
              onClick={onClose}
              title="Cerrar"
              className="p-2 text-slate-400 hover:text-red-600 bg-slate-50 hover:bg-red-50 rounded-full transition-all focus:outline-none"
            >
              <X size={18} strokeWidth={2.5} />
            </button>
          </div>

          <div className="w-[64px] h-[64px] sm:w-[84px] sm:h-[84px] rounded-full overflow-hidden border border-slate-200 shrink-0 shadow-sm relative bg-slate-50 mt-1">
            {header.identity.avatarUrl ? (
              <img src={header.identity.avatarUrl} alt="" className="w-full h-full object-cover object-center" />
            ) : (
              <FallbackAvatar identifier={header.trackingCode} initials={header.identity.fallbackInitials} size={84} />
            )}
          </div>

          <div className="flex flex-col min-w-0 pr-6">
            {/* ESTADO GENERAL Y BOTÓN DE REEVALUAR INMEDIATAMENTE DEBAJO */}
            {header.primaryBadge && (
              <div className="flex flex-col items-start gap-2 mb-3">
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-wider w-max ${header.primaryBadge.colorClass}`}>
                  <DynamicIcon name={getBadgeIconName(header.primaryBadge.icon as string)} size={12} />
                  {header.primaryBadge.label}
                </span>

                {header.metadata.isAlreadyEvaluatedByMe && (
                  <button
                    onClick={onReevaluate}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 border border-amber-200 text-amber-700 hover:bg-amber-100 hover:text-amber-800 transition-colors rounded text-[10px] font-extrabold uppercase tracking-widest shadow-sm focus:outline-none"
                  >
                    <DynamicIcon name="RotateCcw" size={12} strokeWidth={2.5} />
                    Reevaluar Expediente
                  </button>
                )}
              </div>
            )}

            {/* TÍTULO Y CATEGORÍA */}
            <h2 className="text-[18px] sm:text-[22px] font-black text-slate-800 leading-tight mb-1 truncate capitalize" title={header.identity.title}>
              {header.identity.title.toLowerCase()}
            </h2>
            <p className="text-[12px] sm:text-[14px] font-semibold text-slate-500 mb-2">
              {header.identity.categoryBadge?.label}
            </p>

            {/* DNI LIMPIO Y DATOS EXACTOS DE QUIÉN REVISÓ */}
            <div className="flex flex-wrap items-center gap-3 mt-1">
              <p className="text-[11px] font-bold text-slate-500 font-mono truncate border-r border-slate-200 pr-3">
                {header.identity.subtitle} {/* Ya viene limpio del padre */}
              </p>

              {/* LÓGICA DE VISUALIZACIÓN DEL REVISOR */}
              {header.metadata.isAlreadyEvaluatedByMe ? (
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-emerald-50 border border-emerald-100 text-emerald-700 text-[10px] font-bold tracking-wide rounded-md">
                  <UserCheck size={12} strokeWidth={2.5} />
                  Revisado por {header.metadata.assignedTo?.name || "Administrador"} ({header.metadata.reviewerArea})
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-blue-50 border border-blue-100 text-blue-700 text-[10px] font-bold tracking-wide rounded-md">
                  <UserCheck size={12} strokeWidth={2.5} />
                  Evaluando como: {header.metadata.reviewerArea || "Área correspondiente"}
                </span>
              )}
            </div>
          </div>
        </header>

        {/* TABS MINIMALISTAS */}
        <div className="shrink-0 px-5 sm:px-8 pt-2 flex gap-6 sm:gap-8 bg-white border-b border-slate-100 overflow-x-auto scrollbar-hide">
          {availableTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`relative pb-3 text-[13px] sm:text-[14px] font-bold transition-colors whitespace-nowrap focus:outline-none ${
                activeTab === tab.id ? "text-slate-800" : "text-slate-400 hover:text-[#C5A059]"
              }`}
            >
              {tab.label}
              {tab.hasNotification && (
                <span className="absolute top-0 right-[-8px] w-1.5 h-1.5 rounded-full bg-red-500" />
              )}
              {activeTab === tab.id && (
                <div className="absolute bottom-0 left-0 w-full h-[3px] bg-[#C5A059] rounded-t-full" />
              )}
            </button>
          ))}
        </div>

        {/* CONTENIDO (CANVAS SCROLLABLE) */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden bg-slate-50/70 p-5 sm:p-8 scrollbar-thin scrollbar-thumb-slate-200">
          {renderContent(activeTab, payload)}
        </div>

        {/* FOOTER SIMPLE */}
        <footer className="shrink-0 px-5 sm:px-8 py-4 bg-white flex items-center justify-between text-[11px] font-bold text-slate-400 border-t border-slate-100">
          <span>{header.metadata.lastUpdatedRelative}</span>
          <span>Actualizado: Hoy</span>
        </footer>
      </div>
    </>
  );
}

export function InspectionDrawer(props: InspectionDrawerProps) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") props.onClose();
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [props.onClose]);

  if (!props.isOpen || !isMounted) return null;

  return createPortal(
    <TheaterModeProvider>
      <DrawerInner {...props} />
    </TheaterModeProvider>,
    document.body,
  );
}