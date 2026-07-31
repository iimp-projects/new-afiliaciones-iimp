"use client";

import { useEffect, useState } from "react";
import { X, ChevronUp, ChevronDown, Maximize2, Minimize2 } from "lucide-react";
import { useTheaterMode, TheaterModeProvider } from "./TheaterModeContext";
import type { DrawerData } from "./types";
import { DynamicIcon } from "@/modules/layout/Utils/DynamicIcon";
import { FallbackAvatar } from "../SmartCaseCard/FallbackAvatar";

interface InspectionDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onNext?: () => void;
  onPrev?: () => void;
  data: DrawerData<any> | null;
  renderContent: (activeTab: string, payload: any) => React.ReactNode;
}

function DrawerInner({ data, onClose, onNext, onPrev, renderContent }: Omit<InspectionDrawerProps, 'isOpen'>) {
  const { isTheaterMode, toggleTheaterMode } = useTheaterMode();
  const [activeTab, setActiveTab] = useState(data?.defaultTabId || "");

  useEffect(() => {
    if (data?.defaultTabId) setActiveTab(data.defaultTabId);
  }, [data?.defaultTabId]);

  if (!data) return null;
  const { header, availableTabs, payload } = data;

  return (
    <div className={`fixed top-0 right-0 h-full bg-white shadow-2xl transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] z-[100] flex flex-col border-l border-slate-200 ${isTheaterMode ? 'w-[85vw]' : 'w-[45vw] min-w-[600px]'}`}>
      
      {/* 1. HEADER FIJO */}
      <header className="shrink-0 flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-white">
        <div className="flex items-center gap-4">
          {header.identity.avatarUrl ? (
            <img src={header.identity.avatarUrl} alt="" className="w-12 h-12 rounded-xl object-cover" />
          ) : (
            <FallbackAvatar identifier={header.trackingCode} initials={header.identity.fallbackInitials} size={48} />
          )}
          <div>
            <h2 className="text-lg font-black text-slate-800 leading-tight">{header.identity.title}</h2>
            <p className="text-xs font-bold text-slate-400 font-mono tracking-wide">{header.trackingCode}</p>
          </div>
        </div>

        {/* Controles de Ventana */}
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-slate-50 border border-slate-200 rounded-lg p-0.5 mr-2">
            <button onClick={onPrev} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-white rounded-md transition-colors" title="Anterior">
              <ChevronUp size={16} strokeWidth={3} />
            </button>
            <div className="w-px h-4 bg-slate-200" />
            <button onClick={onNext} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-white rounded-md transition-colors" title="Siguiente">
              <ChevronDown size={16} strokeWidth={3} />
            </button>
          </div>
          <button onClick={toggleTheaterMode} className="p-2 text-slate-400 hover:text-[#C5A059] hover:bg-[#C5A059]/10 rounded-xl transition-all" title="Expandir/Contraer">
            {isTheaterMode ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
          </button>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all">
            <X size={18} strokeWidth={2.5} />
          </button>
        </div>
      </header>

      {/* 2. TABS DE NAVEGACIÓN */}
      <div className="shrink-0 px-6 pt-3 border-b border-slate-100 flex gap-6 bg-slate-50/50">
        {availableTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`relative pb-3 flex items-center gap-2 text-sm font-bold transition-colors ${activeTab === tab.id ? 'text-[#C5A059]' : 'text-slate-500 hover:text-slate-700'}`}
          >
            {tab.icon && <DynamicIcon name={tab.icon} size={16} />}
            {tab.label}
            {tab.hasNotification && <span className="absolute top-0 right-[-8px] w-2 h-2 rounded-full bg-red-500 ring-2 ring-white" />}
            {activeTab === tab.id && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-[#C5A059] rounded-t-full" />}
          </button>
        ))}
      </div>

      {/* 3. CANVAS SCROLLABLE */}
      <div className="flex-1 overflow-y-auto bg-slate-50/30 p-6 scrollbar-thin scrollbar-thumb-slate-200">
        {renderContent(activeTab, payload)}
      </div>

      {/* 4. FOOTER ACCIONES RÁPIDAS */}
      <footer className="shrink-0 px-6 py-4 border-t border-slate-200 bg-white flex items-center justify-between">
        <span className="text-xs font-bold text-slate-400">Atajo: Enter para Aceptar</span>
        <div className="flex items-center gap-3">
          <button className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-sm hover:bg-slate-50 transition-colors">
            Reasignar
          </button>
          <button className="px-5 py-2.5 rounded-xl bg-red-50 text-red-600 font-bold text-sm hover:bg-red-100 transition-colors">
            Observar
          </button>
          <button className="px-6 py-2.5 rounded-xl bg-[#C5A059] text-white font-black text-sm shadow-md hover:bg-[#b58f48] transition-all">
            Aprobar Fase
          </button>
        </div>
      </footer>
    </div>
  );
}

export function InspectionDrawer(props: InspectionDrawerProps) {
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') props.onClose(); };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [props.onClose]);

  if (!props.isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-slate-900/20 backdrop-blur-[2px] z-[90] transition-opacity" onClick={props.onClose} />
      <TheaterModeProvider>
        <DrawerInner {...props} />
      </TheaterModeProvider>
    </>
  );
}