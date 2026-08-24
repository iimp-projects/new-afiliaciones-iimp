"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X, Maximize2, Minimize2, UserCheck, Bell, History, Activity, CalendarClock, Copy, Check, Briefcase, Clock as ClockIcon } from "lucide-react";
import { useTheaterMode, TheaterModeProvider } from "./TheaterModeContext";
import type { DrawerData } from "./types";
import { FallbackAvatar } from "../SmartCaseCard/FallbackAvatar";
import { DynamicIcon } from "@/modules/layout/Utils/DynamicIcon";

interface InspectionDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  data: DrawerData<any> | null;
  renderContent: (activeTab: string, payload: any) => React.ReactNode;
  onReevaluate?: () => void;
  evaluationActions?: React.ReactNode;
}

const getBadgeIconName = (iconType: string) => {
  if (iconType === "review") return "AlertCircle";
  if (iconType === "check") return "CheckCircle2";
  if (iconType === "error") return "XCircle";
  if (iconType === "dash") return "MinusCircle";
  return "Clock";
};

const formatDateTime = (dateString: string | Date) => {
  const date = new Date(dateString);
  return {
    date: date.toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric" }),
    time: date.toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit", hour12: true })
  };
};

function DrawerInner({ data, onClose, renderContent, onReevaluate, evaluationActions }: Omit<InspectionDrawerProps, "isOpen">) {
  const { isTheaterMode, toggleTheaterMode } = useTheaterMode();
  const [activeTab, setActiveTab] = useState(data?.defaultTabId || "");
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isAvatarZoomed, setIsAvatarZoomed] = useState(false);

  useEffect(() => {
    if (data?.defaultTabId) setActiveTab(data.defaultTabId);
  }, [data?.defaultTabId]);

  if (!data) return null;
  const { header, availableTabs, payload } = data;
  const notificationTab = availableTabs.find(tab => tab.hasNotification);

  const handleCopyDni = () => {
    const digitsOnly = header.identity.subtitle.replace(/[^0-9]/g, '');
    navigator.clipboard.writeText(digitsOnly || header.identity.subtitle);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const buildTimeline = () => {
    if (!payload) return [];
    const timeline: any[] = [];

    if (payload.history && Array.isArray(payload.history)) {
      payload.history.forEach((h: any) => {
        timeline.push({
          id: `h-${h.id}`,
          area: "Sistema Integrado",
          action: `Cambio de Estado: ${h.newStatus}`,
          user: h.changedById ? "Administrador" : "Recálculo Automático",
          comment: h.changeReason || "Actualización de sistema",
          rawDate: new Date(h.createdAt),
          isSystem: true
        });
      });
    }

    if (payload.validations && Array.isArray(payload.validations)) {
      payload.validations.forEach((v: any) => {
        if (v.history && Array.isArray(v.history)) {
          v.history.forEach((vh: any) => {
            timeline.push({
              id: `vh-${vh.id}`,
              area: v.department?.name || "Evaluación",
              action: `Acción: ${vh.action}`,
              user: vh.user?.person ? `${vh.user.person.firstName} ${vh.user.person.paternalLastName}` : "Revisor del Área",
              comment: vh.comment || "Sin comentarios adicionales",
              rawDate: new Date(vh.createdAt),
              isSystem: false
            });
          });
        }
      });
    }
    return timeline.sort((a, b) => b.rawDate.getTime() - a.rawDate.getTime());
  };

  const timelineEvents = buildTimeline();

  return (
    <>
      <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-[2px] transition-opacity z-[99990]" onClick={onClose} />

      {isAvatarZoomed && createPortal(
        <div className="fixed inset-0 z-[9999999] bg-black/95 flex items-center justify-center backdrop-blur-md cursor-zoom-out animate-in fade-in duration-200" onClick={() => setIsAvatarZoomed(false)}>
          <div className="relative flex flex-col items-center justify-center w-full h-full p-4">
            <button onClick={() => setIsAvatarZoomed(false)} className="absolute top-6 right-6 text-white/50 hover:text-white bg-white/10 hover:bg-white/20 p-3 rounded-full transition-all">
              <X size={28} />
            </button>
            {header.identity.avatarUrl ? (
              <img src={header.identity.avatarUrl} alt="Avatar" className="max-w-full max-h-[85vh] object-contain rounded-2xl shadow-2xl animate-in zoom-in-95 duration-300" />
            ) : (
              <div className="scale-[3] sm:scale-[5] pointer-events-none animate-in zoom-in-95 duration-300">
                <FallbackAvatar identifier={header.trackingCode} initials={header.identity.fallbackInitials} size={84} />
              </div>
            )}
            <p className="text-white/80 font-bold tracking-widest uppercase mt-8 sm:mt-16 text-sm">
              {header.identity.title}
            </p>
          </div>
        </div>,
        document.body
      )}

      <div className={`fixed top-0 right-0 h-full bg-white shadow-2xl transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] z-[99999] border-l border-slate-200 overflow-hidden ${isTheaterMode ? "w-full w-[100vw]" : "w-full sm:w-[500px] md:w-[700px] lg:w-[850px]"}`}>
        
        <div className="absolute top-4 right-4 flex items-center gap-2 z-[100]">
          {notificationTab && (
            <button onClick={() => setActiveTab(notificationTab.id)} title="Ver observaciones pendientes" className="relative p-2 text-amber-500 hover:text-amber-600 bg-amber-50 hover:bg-amber-100 rounded-full transition-all shadow-sm border border-amber-200 focus:outline-none">
              <Bell size={18} strokeWidth={2.5} />
              <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 border-2 border-white rounded-full animate-pulse"></span>
            </button>
          )}
          <button onClick={toggleTheaterMode} title={isTheaterMode ? "Reducir panel" : "Expandir a pantalla completa"} className="p-2 text-slate-500 hover:text-[#C5A059] bg-white border border-slate-200 hover:border-[#C5A059] hover:bg-[#C5A059]/10 rounded-full transition-all shadow-sm focus:outline-none">
            {isTheaterMode ? <Minimize2 size={18} strokeWidth={2.5} /> : <Maximize2 size={18} strokeWidth={2.5} />}
          </button>
          <button onClick={onClose} title="Cerrar" className="p-2 text-slate-500 hover:text-red-600 bg-white border border-slate-200 hover:border-red-200 hover:bg-red-50 rounded-full transition-all shadow-sm focus:outline-none">
            <X size={18} strokeWidth={2.5} />
          </button>
        </div>

        <div className={`flex h-full w-full ${isTheaterMode ? "flex-col md:flex-row" : "flex-col"}`}>
          
          <header className={`relative bg-white shrink-0 transition-all duration-500 ${isTheaterMode ? "w-full md:w-[320px] lg:w-[400px] h-auto md:h-full overflow-y-auto border-b md:border-b-0 md:border-r border-slate-200 p-6 sm:p-8 pt-20 flex flex-col items-center text-center md:items-start md:text-left gap-5 bg-[#fdfdfd]" : "w-full border-b border-slate-50 px-5 sm:px-8 pt-16 pb-6 flex flex-row items-start gap-5"}`}>
            
            <div onClick={() => setIsAvatarZoomed(true)} className={`rounded-full overflow-hidden border border-slate-200 shrink-0 shadow-sm relative bg-slate-50 cursor-zoom-in group ${isTheaterMode ? "w-24 h-24 sm:w-32 sm:h-32 mb-2" : "w-16 h-16 sm:w-[84px] sm:h-[84px] mt-1"}`}>
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10">
                 <Maximize2 size={24} className="text-white" />
              </div>
              {header.identity.avatarUrl ? (
                <img src={header.identity.avatarUrl} alt="" className="w-full h-full object-cover object-center" />
              ) : (
                <FallbackAvatar identifier={header.trackingCode} initials={header.identity.fallbackInitials} size={isTheaterMode ? 128 : 84} />
              )}
            </div>
            
            <div className={`flex flex-col min-w-0 w-full ${isTheaterMode ? "items-center md:items-start" : "pr-10"}`}>
              
              {header.primaryBadge && (
                <div className={`flex flex-col gap-2 mb-3 ${isTheaterMode ? "items-center md:items-start" : "items-start"}`}>
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-wider w-max ${header.primaryBadge.colorClass}`}>
                    <DynamicIcon name={getBadgeIconName(header.primaryBadge.icon as string)} size={12} />
                    {header.primaryBadge.label}
                  </span>
                  {header.metadata.isAlreadyEvaluatedByMe && (
                    <button onClick={onReevaluate} className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 border border-amber-200 text-amber-700 hover:bg-amber-100 hover:text-amber-800 transition-colors rounded text-[10px] font-extrabold uppercase tracking-widest shadow-sm focus:outline-none">
                      <DynamicIcon name="RotateCcw" size={12} strokeWidth={2.5} />
                      Reevaluar Expediente
                    </button>
                  )}
                </div>
              )}

              <div className={`flex ${isTheaterMode ? "flex-col items-center md:items-start" : "flex-wrap items-center"} gap-3 mb-1 w-full`}>
                <h2 className={`font-black text-slate-800 leading-tight capitalize ${isTheaterMode ? "text-2xl sm:text-3xl" : "text-[18px] sm:text-[22px] truncate"}`} title={header.identity.title}>
                  {header.identity.title.toLowerCase()}
                </h2>
                
                <button onClick={() => setShowHistoryModal(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-500 hover:text-white rounded-full transition-all shadow-sm font-bold text-[11px] uppercase tracking-wider focus:outline-none group w-max">
                  <History size={14} strokeWidth={2.5} className="group-hover:-rotate-45 transition-transform duration-300" /> Historial
                </button>
              </div>

              <p className="text-[12px] sm:text-[14px] font-semibold text-slate-500 mb-3">
                {header.identity.categoryBadge?.label}
              </p>
              
              {/* ===================================================================== */}
              {/* ÁREA DE DNI Y ESTADO DEL EVALUADOR: TEXTO LIMPIO SIN PARECER BOTÓN    */}
              {/* ===================================================================== */}
              <div className={`flex flex-wrap items-center gap-4 mt-1 ${isTheaterMode ? "justify-center md:justify-start" : ""}`}>
                
                {/* DNI + Botón Copiar */}
                <div className="flex items-center gap-1.5 border-r border-slate-200 pr-4">
                  <p className="text-[13px] font-black text-slate-700 font-mono truncate">{header.identity.subtitle}</p>
                  <button onClick={handleCopyDni} className="relative p-1 text-slate-400 hover:bg-slate-100 hover:text-[#C5A059] rounded transition-colors focus:outline-none" title="Copiar número">
                    {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                    {copied && (
                      <span className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[10px] font-bold px-2.5 py-1 rounded-md shadow-lg whitespace-nowrap animate-in fade-in slide-in-from-bottom-1 z-50">
                        ¡Copiado!
                      </span>
                    )}
                  </button>
                </div>

                {/* Área y Evaluador: Texto simple y limpio */}
                <div className="flex items-center gap-4 text-[11px]">
                  <div className="flex items-center gap-1.5 text-slate-500">
                    <Briefcase size={14} className="text-slate-400" />
                    <span className="font-bold">Área: <span className="text-slate-700 uppercase">{header.metadata.reviewerArea || "Asignada"}</span></span>
                  </div>

                  <div className="flex items-center gap-1.5 text-slate-500">
                    {header.metadata.isAlreadyEvaluatedByMe ? (
                      <>
                        <UserCheck size={14} strokeWidth={2.5} className="text-emerald-500" />
                        <span className="font-bold">Evaluado por: <span className="text-slate-700 uppercase">{header.metadata.assignedTo?.name || "Administrador"}</span></span>
                      </>
                    ) : (
                      <>
                        <ClockIcon size={14} strokeWidth={2.5} className="text-amber-500" />
                        <span className="font-bold">Por evaluar (<span className="text-slate-700 uppercase">{header.metadata.assignedTo?.name?.split(' ')[0] || "Administrador"}</span>)</span>
                      </>
                    )}
                  </div>
                </div>

              </div>

              {/* BOTONES DE EVALUACIÓN */}
              {evaluationActions && (
                <div className={`mt-5 pt-5 border-t border-slate-100 flex ${isTheaterMode ? "flex-col w-full" : "flex-wrap items-center"} gap-3`}>
                  {evaluationActions}
                </div>
              )}
            </div>
          </header>

          <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-slate-50/70 relative">
            <div className={`shrink-0 px-5 sm:px-8 flex gap-6 sm:gap-8 bg-white border-b border-slate-100 overflow-x-auto scrollbar-hide ${isTheaterMode ? "pt-6" : "pt-2"}`}>
              {availableTabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`relative pb-3 text-[13px] sm:text-[14px] font-bold transition-colors whitespace-nowrap focus:outline-none ${
                    activeTab === tab.id ? "text-slate-800" : "text-slate-400 hover:text-[#C5A059]"
                  }`}
                >
                  {tab.label}
                  {tab.hasNotification && <span className="absolute top-0 right-[-8px] w-1.5 h-1.5 rounded-full bg-red-500" />}
                  {activeTab === tab.id && <div className="absolute bottom-0 left-0 w-full h-[3px] bg-[#C5A059] rounded-t-full" />}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto overflow-x-hidden p-5 sm:p-8 scrollbar-thin scrollbar-thumb-slate-200">
              {renderContent(activeTab, payload)}
            </div>

            <footer className="shrink-0 px-5 sm:px-8 py-4 bg-white flex items-center justify-between text-[11px] font-bold text-slate-400 border-t border-slate-100">
              <span>{header.metadata.lastUpdatedRelative}</span>
              <span>Actualizado: Hoy</span>
            </footer>
          </div>
        </div>
      </div>

      {showHistoryModal && (
        <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4 sm:p-6">
          <style dangerouslySetInnerHTML={{__html: `@keyframes waterFlow { 0% { background-position: 50% 0%; } 100% { background-position: 50% 200%; } } .water-line { background: linear-gradient(180deg, #38bdf8 0%, #818cf8 25%, #c084fc 50%, #818cf8 75%, #38bdf8 100%); background-size: 100% 200%; animation: waterFlow 3s linear infinite; } @keyframes pulse-ring { 0% { box-shadow: 0 0 0 0 rgba(56, 189, 248, 0.7); } 70% { box-shadow: 0 0 0 8px rgba(56, 189, 248, 0); } 100% { box-shadow: 0 0 0 0 rgba(56, 189, 248, 0); } } .water-node { animation: pulse-ring 2s cubic-bezier(0.4, 0, 0.6, 1) infinite; }`}} />
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity animate-in fade-in" onClick={() => setShowHistoryModal(false)}/>
          
          <div className="relative w-full max-w-2xl bg-white rounded-[32px] shadow-2xl flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-300 overflow-hidden">
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600"><Activity size={20} strokeWidth={2.5} /></div>
                <div><h3 className="text-lg font-black text-slate-800">Línea de Tiempo</h3><p className="text-xs font-semibold text-slate-500">Historial detallado por áreas y sistema</p></div>
              </div>
              <button onClick={() => setShowHistoryModal(false)} className="p-2 text-slate-400 hover:bg-slate-200 hover:text-slate-700 rounded-full transition-colors"><X size={20} strokeWidth={2.5} /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 sm:p-8 scrollbar-thin scrollbar-thumb-slate-200 bg-[#fdfdfd]">
              {timelineEvents.length > 0 ? (
                <div className="relative pl-6">
                  <div className="absolute top-2 bottom-2 left-[23px] w-1 water-line rounded-full"></div>
                  {timelineEvents.map((item) => {
                    const { date, time } = formatDateTime(item.rawDate);
                    return (
                      <div key={item.id} className="relative mb-8 last:mb-0 group">
                        <div className="absolute w-4 h-4 bg-white border-[4px] border-blue-500 rounded-full -left-[30px] top-1.5 water-node z-10 group-hover:scale-125 transition-transform duration-300"></div>
                        <div className="bg-white border border-slate-200 hover:border-blue-300 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all duration-300 ml-4 group-hover:bg-blue-50/30">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                            <span className={`px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-widest w-max ${item.isSystem ? 'bg-slate-100 text-slate-600' : 'bg-blue-100 text-blue-700'}`}>{item.area}</span>
                            <div className="flex items-center gap-1.5 text-slate-400 text-[11px] font-bold bg-slate-50 px-2 py-1 rounded-lg border border-slate-100 w-max"><CalendarClock size={12} />{date} - {time}</div>
                          </div>
                          <h4 className="text-sm font-black text-slate-800 mb-1">{item.action}</h4>
                          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 mb-3"><UserCheck size={14} className="text-slate-400" />{item.user}</div>
                          <div className="bg-slate-50 p-3 rounded-xl border border-slate-100"><p className="text-[13px] text-slate-600 font-medium leading-relaxed italic">"{item.comment}"</p></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-40 text-slate-400"><History size={40} className="mb-3 opacity-20" /><p className="font-bold">No hay eventos registrados en el historial.</p></div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export function InspectionDrawer(props: InspectionDrawerProps) {
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => { setIsMounted(true); const handleEsc = (e: KeyboardEvent) => { if (e.key === "Escape") props.onClose(); }; window.addEventListener("keydown", handleEsc); return () => window.removeEventListener("keydown", handleEsc); }, [props.onClose]);
  if (!props.isOpen || !isMounted) return null;
  return createPortal(<TheaterModeProvider><DrawerInner {...props} /></TheaterModeProvider>, document.body);
}