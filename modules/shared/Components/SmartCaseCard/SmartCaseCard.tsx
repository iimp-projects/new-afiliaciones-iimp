"use client";

import { MoreVertical, CheckCircle2, Clock, XCircle, MinusCircle } from "lucide-react";
import type { SmartCaseCardProps } from "./types";
import { FallbackAvatar } from "./FallbackAvatar";

const StatusIcon = ({ status }: { status: string }) => {
  if (status === "check") return <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center shadow-sm"><CheckCircle2 size={14} className="text-white" strokeWidth={3} /></div>;
  if (status === "pending") return <div className="w-5 h-5 rounded-full bg-amber-500 flex items-center justify-center shadow-sm"><Clock size={13} className="text-white" strokeWidth={3} /></div>;
  if (status === "error") return <div className="w-5 h-5 rounded-full bg-red-500 flex items-center justify-center shadow-sm"><XCircle size={14} className="text-white" strokeWidth={3} /></div>;
  if (status === "dash") return <div className="w-5 h-5 rounded-full bg-slate-300 flex items-center justify-center shadow-sm"><MinusCircle size={14} className="text-white" strokeWidth={3} /></div>;
  return null;
};

export function SmartCaseCard({ data, onClick }: SmartCaseCardProps) {
  const { identity, primaryBadge, atomicValidations, metadata } = data;

  return (
    <article 
      onClick={onClick}
      className="bg-white rounded-2xl p-5 shadow-[0_2px_12px_rgba(0,0,0,0.04)] border border-slate-200/60 relative flex flex-col hover:shadow-[0_8px_24px_rgba(0,0,0,0.06)] hover:border-slate-300 transition-all duration-300 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-[#4a6ab0]"
    >
      {identity.categoryBadge && (
        <div className={`absolute top-4 left-5 px-2.5 py-0.5 rounded-full text-[9px] font-black tracking-widest text-white shadow-sm ${identity.categoryBadge.colorClass}`}>
          {identity.categoryBadge.label}
        </div>
      )}

      <button className="absolute top-4 right-4 text-slate-300 hover:text-slate-600 transition-colors" onClick={(e) => e.stopPropagation()}>
        <MoreVertical size={20} strokeWidth={2.5} />
      </button>

      <div className="flex items-start gap-4 mt-8 mb-5">
        <div className="w-[72px] h-[90px] shrink-0 rounded-xl overflow-hidden shadow-sm border border-slate-100 relative">
          {identity.avatarUrl ? (
            <img src={identity.avatarUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <FallbackAvatar identifier={data.trackingCode} initials={identity.fallbackInitials} size={90} />
          )}
        </div>
        
        <div className="flex flex-col pt-1">
          <h3 className="text-[15px] font-black text-slate-800 leading-[1.2] mb-1.5 line-clamp-2" title={identity.title}>
            {identity.title}
          </h3>
          <p className="text-[11px] font-bold text-slate-400 font-mono tracking-wide">
            {identity.subtitle}
          </p>
          <p className="text-[11px] font-bold text-[#4a6ab0] font-mono tracking-wide mt-0.5">
            {data.trackingCode}
          </p>
        </div>
      </div>

      {primaryBadge && (
        <div className="mb-5">
          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black tracking-widest border ${primaryBadge.colorClass}`}>
            {primaryBadge.icon === "check" && <CheckCircle2 size={14} strokeWidth={3} className="opacity-80" />}
            {primaryBadge.icon === "clock" && <Clock size={14} strokeWidth={3} className="opacity-80" />}
            {primaryBadge.icon === "error" && <XCircle size={14} strokeWidth={3} className="opacity-80" />}
            {primaryBadge.icon === "dash" && <MinusCircle size={14} strokeWidth={3} className="opacity-80" />}
            {primaryBadge.label}
          </span>
        </div>
      )}

      <hr className="border-slate-100 mb-4" />

      {atomicValidations && (
        <div className="grid grid-cols-4 gap-2 px-2 mb-5">
          {atomicValidations.map((validation, idx) => (
            <div key={idx} className="flex flex-col items-center gap-2">
              <span className="text-[10px] font-extrabold text-slate-800 tracking-wider">{validation.label}</span>
              <StatusIcon status={validation.status} />
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between mt-auto pt-4 border-t border-slate-100">
        <span className="text-[12px] font-bold text-slate-500 flex items-center gap-1.5">
          <Clock size={14} className="text-slate-400" /> {metadata.lastUpdatedRelative}
        </span>
        
        <div className="flex items-center gap-2">
          {metadata.assignedTo.initial !== "-" && (
            <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-black text-slate-600">
              {metadata.assignedTo.initial}
            </div>
          )}
          <span className={`text-[11px] font-black tracking-widest uppercase ${metadata.assignedTo.name === 'SIN ASIGNAR' ? 'text-slate-300' : 'text-slate-700'}`}>
            {metadata.assignedTo.name}
          </span>
        </div>
      </div>
    </article>
  );
}