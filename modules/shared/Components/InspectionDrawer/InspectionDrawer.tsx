"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom"; // <-- LA MAGIA ESTÁ AQUÍ
import { X, Maximize2, Minimize2 } from "lucide-react";
import { useTheaterMode, TheaterModeProvider } from "./TheaterModeContext";
import type { DrawerData } from "./types";
import { FallbackAvatar } from "../SmartCaseCard/FallbackAvatar";
import { DynamicIcon } from "@/modules/layout/Utils/DynamicIcon";

interface InspectionDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  data: DrawerData<any> | null;
  renderContent: (activeTab: string, payload: any) => React.ReactNode;
}

const getBadgeIconName = (iconType: string) => {
  if (iconType === 'review') return 'AlertCircle';
  if (iconType === 'check') return 'CheckCircle2';
  if (iconType === 'error') return 'XCircle';
  if (iconType === 'dash') return 'MinusCircle';
  return 'Clock';
};

function DrawerInner({ data, onClose, renderContent }: Omit<InspectionDrawerProps, 'isOpen'>) {
  const { isTheaterMode, toggleTheaterMode } = useTheaterMode();
  const [activeTab, setActiveTab] = useState(data?.defaultTabId || "");

  useEffect(() => {
    if (data?.defaultTabId) setActiveTab(data.defaultTabId);
  }, [data?.defaultTabId]);

  if (!data) return null;
  const { header, availableTabs, payload } = data;

  return (
    <>
      {/* OVERLAY OSCURO: Ahora con z-index inmenso para tapar todo el Navbar y Sidebar */}
      <div 
        className="fixed inset-0 bg-slate-900/50 backdrop-blur-[2px] transition-opacity z-[99990]" 
        onClick={onClose} 
      />

      <div 
        // 1. Redujimos el ancho inicial (lg:w-[600px])
        // 2. Expandir ahora toma el 100vw de la pantalla
        className={`fixed top-0 right-0 h-full bg-white shadow-2xl transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] z-[99999] flex flex-col border-l border-slate-200 
        ${isTheaterMode ? 'w-full w-[100vw]' : 'w-full sm:w-[450px] md:w-[500px] lg:w-[600px]'}`}
      >
        {/* 1. HEADER MODERNO Y RESPONSIVO */}
        <header className="shrink-0 flex items-start gap-4 px-5 sm:px-8 pt-12 sm:pt-16 pb-5 relative bg-white border-b border-slate-50">
          
          {/* Controles superiores (Expandir y Cerrar) */}
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
            {header.primaryBadge && (
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-wider mb-2 w-max ${header.primaryBadge.colorClass}`}>
                <DynamicIcon name={getBadgeIconName(header.primaryBadge.icon as string)} size={12}/> 
                {header.subStatus || header.primaryBadge.label}
              </span>
            )}
            <h2 className="text-[18px] sm:text-[22px] font-black text-slate-800 leading-tight mb-1 truncate capitalize" title={header.identity.title}>
              {header.identity.title.toLowerCase()}
            </h2>
            <p className="text-[12px] sm:text-[14px] font-semibold text-slate-500">{header.identity.categoryBadge?.label}</p>
            <p className="text-[10px] sm:text-[11px] font-semibold text-slate-400 mt-1 font-mono truncate">{header.trackingCode} • {header.identity.subtitle}</p>
          </div>
        </header>

        {/* 2. TABS MINIMALISTAS */}
        <div className="shrink-0 px-5 sm:px-8 pt-2 flex gap-6 sm:gap-8 bg-white border-b border-slate-100 overflow-x-auto scrollbar-hide">
          {availableTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`relative pb-3 text-[13px] sm:text-[14px] font-bold transition-colors whitespace-nowrap focus:outline-none ${
                activeTab === tab.id ? 'text-slate-800' : 'text-slate-400 hover:text-[#C5A059]'
              }`}
            >
              {tab.label}
              {tab.hasNotification && <span className="absolute top-0 right-[-8px] w-1.5 h-1.5 rounded-full bg-red-500" />}
              {activeTab === tab.id && <div className="absolute bottom-0 left-0 w-full h-[3px] bg-[#C5A059] rounded-t-full" />}
            </button>
          ))}
        </div>

        {/* 3. CONTENIDO (CANVAS SCROLLABLE) */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden bg-slate-50/70 p-5 sm:p-8 scrollbar-thin scrollbar-thumb-slate-200">
          {renderContent(activeTab, payload)}
        </div>

        {/* 4. FOOTER SIMPLE */}
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
    setIsMounted(true); // Evita problemas de hidratación en Next.js
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') props.onClose(); };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [props.onClose]);

  if (!props.isOpen || !isMounted) return null;

  // Renderizamos directamente en el BODY para asegurar que flote sobre ABSOLUTAMENTE TODO el navegador
  return createPortal(
    <TheaterModeProvider>
      <DrawerInner {...props} />
    </TheaterModeProvider>,
    document.body
  );
}