"use client";

import { MoreHorizontal, Clock, Flag, CheckCircle2, XCircle, MinusCircle } from "lucide-react";
import type { SmartCaseCardProps } from "./types";
import { FallbackAvatar } from "./FallbackAvatar";

// Sub-componente para renderizar los iconos circulares atómicos
const StatusIcon = ({ status }: { status: string }) => {
  if (status === "check") return <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center shadow-sm"><CheckCircle2 size={14} className="text-white" strokeWidth={3} /></div>;
  if (status === "pending") return <div className="w-5 h-5 rounded-full bg-amber-500 flex items-center justify-center shadow-sm"><Clock size={13} className="text-white" strokeWidth={3} /></div>;
  if (status === "error") return <div className="w-5 h-5 rounded-full bg-red-500 flex items-center justify-center shadow-sm"><XCircle size={14} className="text-white" strokeWidth={3} /></div>;
  if (status === "dash") return <div className="w-5 h-5 rounded-full bg-slate-300 flex items-center justify-center shadow-sm"><MinusCircle size={14} className="text-white" strokeWidth={3} /></div>;
  return null;
};

const priorityColors = { low: "text-slate-300", medium: "text-blue-400", high: "text-amber-500", critical: "text-red-500" };

export function SmartCaseRow({ data, onClick }: SmartCaseCardProps) {
  const { identity, primaryBadge, atomicValidations, metadata } = data;

  return (
    <div onClick={onClick} className="group flex items-center bg-white border-b border-slate-200 hover:bg-slate-50 transition-colors duration-200 px-6 py-4 cursor-pointer">
      
      {/* 1. Identity (Foto y Nombres) */}
      <div className="flex items-center gap-4 w-[350px] shrink-0">
        <div className="relative">
          {identity.avatarUrl ? (
            <img src={identity.avatarUrl} alt="" className="w-10 h-10 rounded-xl object-cover shadow-sm" />
          ) : (
            <FallbackAvatar identifier={data.trackingCode} initials={identity.fallbackInitials} size={40} />
          )}
          {identity.categoryBadge && (
            <div className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-white ${identity.categoryBadge.colorClass}`} title={identity.categoryBadge.label} />
          )}
        </div>
        <div className="flex flex-col overflow-hidden pr-4">
          <span className="text-sm font-black text-slate-800 truncate" title={identity.title}>{identity.title}</span>
          <span className="text-[11px] font-bold text-slate-400 font-mono tracking-wide">{data.trackingCode}</span>
        </div>
      </div>

      {/* 2. Primary Badge (Ej. PAGADO, OBSERVADO) */}
      <div className="w-[180px] shrink-0 px-4">
        {primaryBadge ? (
          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black tracking-widest border truncate max-w-full ${primaryBadge.colorClass}`} title={primaryBadge.label}>
            {primaryBadge.icon === "check" && <CheckCircle2 size={14} strokeWidth={3} className="opacity-80" />}
            {primaryBadge.icon === "clock" && <Clock size={14} strokeWidth={3} className="opacity-80" />}
            {primaryBadge.icon === "error" && <XCircle size={14} strokeWidth={3} className="opacity-80" />}
            {primaryBadge.icon === "dash" && <MinusCircle size={14} strokeWidth={3} className="opacity-80" />}
            <span className="truncate">{primaryBadge.label}</span>
          </span>
        ) : (
          <span className="text-[10px] font-bold text-slate-400">---</span>
        )}
      </div>

      {/* 3. Validaciones Atómicas (LOG, ASI, COM, TES) */}
      <div className="flex-1 px-8 min-w-[200px] flex items-center gap-4">
        {atomicValidations?.map((validation, idx) => (
          <div key={idx} className="flex items-center gap-2" title={validation.label}>
            <StatusIcon status={validation.status} />
          </div>
        ))}
      </div>

      {/* 4. Metadatos & Asignado */}
      <div className="flex items-center justify-end gap-6 shrink-0 ml-auto pl-4">
        
        {/* LA SOLUCIÓN ESTÁ AQUÍ: Envolvemos el ícono en un DIV que tiene el title */}
        {metadata.priority !== 'low' && (
          <div title={`Prioridad: ${metadata.priority}`}>
             <Flag size={14} className={`${priorityColors[metadata.priority]} fill-current`} />
          </div>
        )}
        
        {/* Asignado a */}
        <div className="flex items-center gap-2 w-24 justify-end" title={`Asignado a: ${metadata.assignedTo.name}`}>
          <span className={`text-[11px] font-black tracking-widest uppercase truncate ${metadata.assignedTo.name === 'SIN ASIGNAR' ? 'text-slate-300' : 'text-slate-700'}`}>
            {metadata.assignedTo.name}
          </span>
        </div>

        {/* Tiempo */}
        <span className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider w-24 justify-end">
          <Clock size={12} /> {metadata.lastUpdatedRelative.replace("Hace ", "")}
        </span>

        {/* Menú */}
        <button className="p-1.5 text-slate-300 hover:text-slate-700 hover:bg-slate-200 rounded-md transition-colors" onClick={(e) => { e.stopPropagation(); }}>
          <MoreHorizontal size={18} />
        </button>
      </div>
      
    </div>
  );
}