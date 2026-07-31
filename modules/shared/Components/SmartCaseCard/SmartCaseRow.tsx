"use client";

import { MoreHorizontal, Clock, Flag } from "lucide-react";
import type { SmartCaseCardProps } from "./types";
import { FallbackAvatar } from "./FallbackAvatar";
import { MicroPipeline } from "./MicroPipeline";
import { DynamicIcon } from "@/modules/layout/Utils/DynamicIcon";

const priorityColors = { low: "text-slate-300", medium: "text-blue-400", high: "text-amber-500", critical: "text-red-500" };

export function SmartCaseRow({ data, onClick }: SmartCaseCardProps) {
  const { identity, workflow, actionCenter, metadata } = data;

  return (
    <div onClick={onClick} className="group flex items-center bg-white border-b border-slate-200 hover:bg-slate-50 transition-colors duration-200 px-6 py-3 cursor-pointer">
      <div className="flex items-center gap-4 w-[300px] shrink-0">
        <div className="relative">
          {identity.avatarUrl ? <img src={identity.avatarUrl} alt="" className="w-10 h-10 rounded-xl object-cover shadow-sm" /> : <FallbackAvatar identifier={data.trackingCode} initials={identity.fallbackInitials} size={40} />}
          {identity.badge && <div className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-white ${identity.badge.colorName === 'primary-gold' ? 'bg-[#D6A84A]' : 'bg-slate-700'}`} title={identity.badge.label} />}
        </div>
        <div className="flex flex-col overflow-hidden pr-4">
          <span className="text-sm font-black text-slate-800 truncate" title={identity.title}>{identity.title}</span>
          <span className="text-[11px] font-bold text-slate-400 font-mono tracking-wide">{data.trackingCode}</span>
        </div>
      </div>

      <div className="flex-1 px-8 min-w-[200px]"><MicroPipeline workflow={workflow} /></div>

      <div className="w-[200px] shrink-0 px-4">
        {actionCenter ? (
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold border truncate max-w-full ${actionCenter.severity === 'error' ? 'bg-red-50 text-red-700 border-red-100' : actionCenter.severity === 'warning' ? 'bg-amber-50 text-amber-700 border-amber-100' : 'bg-blue-50 text-blue-700 border-blue-100'}`} title={actionCenter.message}>
            <DynamicIcon name={actionCenter.icon} size={12} strokeWidth={3} />
            <span className="truncate">{actionCenter.message}</span>
          </span>
        ) : <span className="text-[10px] font-bold text-slate-400">Sin alertas</span>}
      </div>

      <div className="flex items-center justify-end gap-6 shrink-0 ml-auto pl-4">
        {metadata.priority !== 'low' && <Flag size={14} className={`${priorityColors[metadata.priority]} fill-current`} />}
        <span className="flex items-center gap-1 text-[11px] font-bold text-slate-400 uppercase tracking-wider w-20 justify-end"><Clock size={12} /> {metadata.lastUpdatedRelative.replace("hace ", "")}</span>
        <button className="p-1.5 text-slate-300 hover:text-slate-700 hover:bg-slate-200 rounded-md transition-colors" onClick={(e) => { e.stopPropagation(); }}><MoreHorizontal size={18} /></button>
      </div>
    </div>
  );
}