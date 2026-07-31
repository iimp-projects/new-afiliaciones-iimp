"use client";

import { MoreHorizontal, Clock, Flag } from "lucide-react";
import type { SmartCaseCardProps } from "./types";
import { FallbackAvatar } from "./FallbackAvatar";
import { MicroPipeline } from "./MicroPipeline";
import { DynamicIcon } from "@/modules/layout/Utils/DynamicIcon";

const priorityColors = {
  low: "text-slate-300",
  medium: "text-blue-400",
  high: "text-amber-500",
  critical: "text-red-500 drop-shadow-sm",
};

export function SmartCaseCard({ data, onClick }: SmartCaseCardProps) {
  const { identity, workflow, actionCenter, metadata } = data;

  return (
    <div onClick={onClick} className="group flex flex-col bg-white border border-slate-200 hover:border-[#C5A059]/60 rounded-3xl p-5 shadow-sm hover:shadow-[0_10px_40px_-15px_rgba(0,0,0,0.1)] transition-all duration-300 relative cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-[#C5A059]">
      
      <button className="absolute top-4 right-4 p-1.5 text-slate-300 opacity-0 group-hover:opacity-100 group-hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-all" onClick={(e) => e.stopPropagation()}>
        <MoreHorizontal size={18} />
      </button>

      <div className="flex gap-4 items-start">
        <div className="relative shrink-0">
          {identity.avatarUrl ? (
            <img src={identity.avatarUrl} alt={identity.title} className="w-[72px] h-[72px] rounded-2xl object-cover shadow-sm border border-slate-100" />
          ) : (
            <FallbackAvatar identifier={data.trackingCode} initials={identity.fallbackInitials} size={72} />
          )}
          {identity.badge && (
            <div className={`absolute -bottom-2 -right-2 px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-widest shadow-sm text-white ${identity.badge.colorName === 'primary-gold' ? 'bg-gradient-to-br from-[#D6A84A] to-[#8C6215]' : 'bg-slate-700'}`}>
              {identity.badge.label}
            </div>
          )}
        </div>

        <div className="flex flex-col flex-1 min-w-0 pt-0.5 pr-6">
          <div className="flex items-center gap-2 mb-0.5">
            <h3 className="text-base font-black text-slate-800 truncate" title={identity.title}>{identity.title}</h3>
            {metadata.priority !== 'low' && <Flag size={14} className={`shrink-0 ${priorityColors[metadata.priority]} fill-current`} />}
          </div>
          <span className="text-[11px] font-bold text-slate-400 font-mono tracking-wide mb-3">{identity.subtitle} • {data.trackingCode}</span>
          <MicroPipeline workflow={workflow} />
        </div>
      </div>

      <div className="mt-5 flex flex-col gap-3">
        {actionCenter ? (
          <div className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold border ${actionCenter.severity === 'error' ? 'bg-red-50 text-red-700 border-red-100' : actionCenter.severity === 'warning' ? 'bg-amber-50 text-amber-700 border-amber-100' : 'bg-blue-50 text-blue-700 border-blue-100'}`}>
            <span className="flex items-center gap-2 truncate pr-2">
              <DynamicIcon name={actionCenter.icon} size={14} strokeWidth={2.5} />
              <span className="truncate">{actionCenter.message}</span>
            </span>
            {actionCenter.actionLabel && <span className="underline decoration-2 underline-offset-2 opacity-80 shrink-0">{actionCenter.actionLabel}</span>}
          </div>
        ) : <div className="h-8" />}

        <div className="flex items-center justify-between mt-auto pt-3 border-t border-slate-100/80">
          <span className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            <Clock size={12} className="text-slate-300" /> {metadata.lastUpdatedRelative}
          </span>
          {metadata.assignedTo ? (
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 pl-1.5 pr-2 py-0.5 rounded-full">
              <div className="w-4 h-4 rounded-full bg-slate-300 overflow-hidden text-[8px] flex items-center justify-center text-white font-bold">
                {metadata.assignedTo.avatarUrl ? <img src={metadata.assignedTo.avatarUrl} alt="" /> : metadata.assignedTo.name[0]}
              </div>
              <span className="text-[9px] font-black text-slate-600 uppercase tracking-wider">{metadata.assignedTo.name.split(' ')[0]}</span>
            </div>
          ) : (
            <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest border border-dashed border-slate-200 px-2 py-0.5 rounded-full">Sin asignar</span>
          )}
        </div>
      </div>
    </div>
  );
}