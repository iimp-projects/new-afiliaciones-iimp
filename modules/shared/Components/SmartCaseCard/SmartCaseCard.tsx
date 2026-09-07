"use client";

import { useState, useRef, useEffect } from "react";
import { 
    MoreVertical, CheckCircle2, Clock, XCircle, 
    MinusCircle, AlertCircle, Eye, Users, Send, Mail, Phone, User, GraduationCap 
} from "lucide-react";
import type { SmartCaseCardProps } from "./types";
import { FallbackAvatar } from "./FallbackAvatar";
import { DynamicIcon } from "@/modules/layout/Utils/DynamicIcon";

const StatusIcon = ({ status, className = "" }: { status: string; className?: string }) => {
  if (status === "person") return <User size={14} className={className} strokeWidth={2.5} />;
  if (status === "graduation") return <GraduationCap size={14} className={className} strokeWidth={2.5} />;
  // Mapeo de Nuevos Estados del Backend
  if (status === "APPROVED") return <CheckCircle2 size={14} className={className} strokeWidth={2.5} />;
  if (status === "UNDER_EVALUATION" || status === "RESOLVED") return <Clock size={14} className={className} strokeWidth={2.5} />;
  if (status === "REJECTED") return <XCircle size={14} className={className} strokeWidth={2.5} />;
  if (status === "PENDING") return <MinusCircle size={14} className={className} strokeWidth={2.5} />;
  if (status === "OBSERVED") return <AlertCircle size={14} className={className} strokeWidth={2.5} />;

  // Mapeo Gráfico (Legacy / Primary Badge)
  if (status === "check") return <CheckCircle2 size={14} className={className} strokeWidth={2.5} />;
  if (status === "pending" || status === "clock") return <Clock size={14} className={className} strokeWidth={2.5} />;
  if (status === "error") return <XCircle size={14} className={className} strokeWidth={2.5} />;
  if (status === "dash") return <MinusCircle size={14} className={className} strokeWidth={2.5} />;
  if (status === "review" || status === "alert") return <AlertCircle size={14} className={className} strokeWidth={2.5} />;
  
  return null;
};

export function SmartCaseCard({ 
  data, 
  onClick, 
  onViewAvales, 
  onNotifyCommittee, 
  onResendApplicant 
}: SmartCaseCardProps) {
  const { identity, primaryBadge, atomicValidations, metadata, topBorderColorClass, subStatus } = data;
  const isExpedienteLayout = data.rowLayout === "expediente";
  
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [avatarFailed, setAvatarFailed] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };

    if (isMenuOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isMenuOpen]);

  return (
    <article
      onClick={onClick}
      className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 relative flex flex-col hover:shadow-md transition-all duration-300 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-primary/50 overflow-visible"
    >
      {topBorderColorClass && (
        <div className={`absolute top-0 left-0 w-full h-1.5 rounded-t-2xl ${topBorderColorClass}`}></div>
      )}

      {/* HEADER: ESTADO Y SUB-ESTADO UNIDOS EN UNA SOLA CAJA VISUAL */}
      <div className="flex items-start justify-between mt-1 mb-6 relative">
        {primaryBadge && (
            <div className={`flex flex-col px-3 py-1.5 rounded-xl w-max ${primaryBadge.colorClass}`}>
            <div className="flex items-center gap-1.5">
              <StatusIcon status={primaryBadge.icon} className="shrink-0" />
              <span className="text-[11px] font-black uppercase tracking-wider">{primaryBadge.label}</span>
            </div>
            {subStatus && (
              <span className="text-[11px] font-semibold mt-0.5 opacity-80">
                {subStatus}
              </span>
            )}
          </div>
        )}

        {/* MENÚ 3 PUNTITOS */}
        <div ref={menuRef} className="absolute -top-1 -right-2 z-50">
          <button 
            className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-1.5 rounded-lg transition-colors"
            onClick={(e) => { e.stopPropagation(); setIsMenuOpen(!isMenuOpen); }}
          >
            <MoreVertical size={20} strokeWidth={2.5} />
          </button>
          
          {isMenuOpen && (
            <div className="absolute right-0 top-full mt-1 w-64 bg-white border border-slate-100 rounded-xl shadow-[0_10px_40px_-15px_rgba(0,0,0,0.2)] py-1.5 z-[100] animate-in fade-in zoom-in-95">
              
              {/* 1. Ver Expediente */}
              <button onClick={(e) => { e.stopPropagation(); setIsMenuOpen(false); onClick?.(); }} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-50 hover:text-[#C5A059] transition-colors outline-none">
                <Eye size={15} strokeWidth={2.5} /> Ver expediente
              </button>

              {/* 2. Revisar Avales (Deshabilitable para Estudiantes) */}
              <button 
                onClick={(e) => { 
                  e.stopPropagation(); 
                  if (onViewAvales) {
                    setIsMenuOpen(false); 
                    onViewAvales(); 
                  }
                }} 
                className={`w-full flex items-start gap-2.5 px-4 py-2.5 text-sm font-bold outline-none transition-colors ${
                  !onViewAvales 
                    ? "text-slate-300 cursor-not-allowed bg-slate-50" 
                    : "text-slate-600 hover:bg-slate-50 hover:text-[#C5A059]"
                }`}
              >
                <Users size={15} className="mt-0.5 shrink-0" strokeWidth={2.5} /> 
                <div className="flex flex-col items-start text-left">
                  <span>Revisar Avales</span>
                  {!onViewAvales && (
                    <span className="text-[9px] font-semibold text-slate-400 leading-tight mt-0.5">
                      No aplica para la modalidad Estudiante
                    </span>
                  )}
                </div>
              </button>

              <div className="h-px bg-slate-100 my-1 mx-2"></div>

              {/* 3. Notificar al Comité (Deshabilitable condicional) */}
              <button 
                onClick={(e) => { 
                  e.stopPropagation(); 
                  if (onNotifyCommittee) {
                    setIsMenuOpen(false); 
                    onNotifyCommittee(); 
                  }
                }} 
                className={`w-full flex items-start gap-2.5 px-4 py-2.5 text-sm font-bold outline-none transition-colors ${
                  !onNotifyCommittee 
                    ? "text-slate-300 cursor-not-allowed bg-slate-50" 
                    : "text-slate-600 hover:bg-indigo-50 hover:text-indigo-600"
                }`}
              >
                <Send size={15} className="mt-0.5 shrink-0" strokeWidth={2.5} /> 
                <div className="flex flex-col items-start text-left">
                  <span>Notificar al Comité</span>
                  {!onNotifyCommittee && (
                    <span className="text-[9px] font-semibold text-slate-400 leading-tight mt-0.5 pr-2">
                      Habilitado cuando las demás áreas aprueben
                    </span>
                  )}
                </div>
              </button>

              {/* 4. Reenviar a Postulante */}
              <button onClick={(e) => { e.stopPropagation(); setIsMenuOpen(false); onResendApplicant?.(); }} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-50 hover:text-[#C5A059] transition-colors outline-none">
                <Mail size={15} strokeWidth={2.5} /> Reenviar a Postulante
              </button>

            </div>
          )}
        </div>
      </div>

      {/* IDENTIDAD DEL POSTULANTE */}
      <div className="flex items-center gap-4 mb-6">
        <div className="w-[56px] h-[56px] shrink-0 rounded-full overflow-hidden border border-slate-100 relative">
          {identity.avatarUrl && !avatarFailed ? (
            <img src={identity.avatarUrl} onError={() => setAvatarFailed(true)} alt={identity.title} className="w-full h-full object-cover" />
          ) : (
            <FallbackAvatar identifier={data.trackingCode} initials={identity.fallbackInitials} size={56} />
          )}
        </div>
        <div className="flex flex-col min-w-0">
          <h3 className="text-[14px] font-extrabold text-slate-800 leading-tight capitalize line-clamp-2" title={identity.title}>
            {identity.title.toLowerCase()}
          </h3>
          <p className="text-[11px] font-semibold text-slate-500 mt-1">{identity.categoryBadge?.label}</p>
          <p className="mt-0.5 text-[10px] font-bold text-slate-400 font-mono break-words [overflow-wrap:anywhere]">{identity.subtitle}</p>
          {identity.email && <p className="mt-0.5 flex min-w-0 items-center gap-1 text-[10px] font-medium text-slate-500 break-words [overflow-wrap:anywhere]"><Mail size={11} className="shrink-0" /><span className="min-w-0 break-words [overflow-wrap:anywhere]">{identity.email}</span></p>}
          {identity.phone && <p className="mt-0.5 flex items-center gap-1 text-[10px] font-medium text-slate-500"><Phone size={11} className="shrink-0" />{identity.phone}</p>}
        </div>
      </div>

      {/* VALIDACIONES ATÓMICAS */}
      {atomicValidations && (
        <div className="flex flex-col gap-3.5 mb-5 flex-grow">
          {atomicValidations.map((val, idx) => (
            <div key={idx} className={`w-full ${isExpedienteLayout ? "grid grid-cols-[84px_max-content_minmax(0,1fr)] items-center gap-x-1" : "grid grid-cols-[90px_minmax(0,1fr)_auto] items-center gap-x-1"} ${idx === 3 ? "mt-2" : ""}`}>
              
              {/* Columna 1: Icono e Identificador del Área */}
              <div className="flex min-w-0 items-center gap-1.5">
                <DynamicIcon name={val.icon} size={15} className="text-slate-500 shrink-0" />
                <span className="text-left text-[12px] font-bold leading-tight text-slate-700 whitespace-nowrap">{!isExpedienteLayout && val.label === "Miembro desde" ? "Desde" : val.label}</span>
              </div>
              
              {/* Columna 2: Estado */}
              <div className="flex min-w-0 items-center justify-start">
                <span className={`${isExpedienteLayout ? "max-w-[125px] px-1.5" : "max-w-full px-2"} inline-flex min-w-0 items-start justify-start gap-1 rounded py-0.5 text-left text-[10px] font-bold leading-tight ${val.statusColorClass} ${!isExpedienteLayout && ["Código", "Miembro desde", "Inscripción"].includes(val.label) ? "whitespace-nowrap" : "whitespace-normal break-words [overflow-wrap:anywhere]"}`}>
                  <StatusIcon status={val.status} className="w-3 h-3 shrink-0" />
                  <span className="min-w-0 break-words [overflow-wrap:anywhere]">{val.statusLabel}</span>
                </span>
              </div>

              {/* Columna 3: Nombre del Auditor + HORA DE LA ACCIÓN */}
              {val.assignee && (
              <div className={`flex min-w-0 flex-1 items-center justify-end pl-1 ${isExpedienteLayout ? "flex-col text-[10px]" : "min-w-[72px] max-w-[110px] flex-col"} ${!isExpedienteLayout && val.label === "Inscripción" ? "whitespace-nowrap" : ""}`}>
                {val.assignee ? (
                  isExpedienteLayout ? (
                    <>
                      <span className="min-w-0 max-w-full font-medium text-slate-500 text-right leading-tight" title={val.assignee.name}>
                        {val.assignee.name}
                      </span>
                      {val.assignee.timeRelative && (
                        <span className="mt-0.5 max-w-full whitespace-nowrap text-right text-[9px] font-bold leading-tight text-slate-400" title={val.assignee.timeRelative}>
                          {val.assignee.timeRelative}
                        </span>
                      )}
                    </>
                  ) : (
                    <>
                      <span className="text-[10px] font-medium text-slate-500 text-right leading-tight" title={val.assignee.name}>
                        {val.assignee.name}
                      </span>
                      {val.assignee.timeRelative && (
                        <span className="mt-0.5 text-right text-[9px] font-bold text-slate-400">
                          {val.assignee.timeRelative}
                        </span>
                      )}
                    </>
                  )
                ) : null}
              </div>
              )}
              
            </div>
          ))}
        </div>
      )}

      {/* FOOTER */}
      <div className="flex items-center gap-1.5 pt-4 border-t border-slate-100 text-[11px] font-medium text-slate-500 mt-auto">
        <Clock size={14} className="text-slate-400" /> {metadata.lastUpdatedRelative}
      </div>

    </article>
  );
}
