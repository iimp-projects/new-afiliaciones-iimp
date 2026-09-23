"use client";

import type { ElementType, ReactNode } from "react";
import { usePathname } from "next/navigation";
import { NavigationHeaderIcon } from "@/modules/layout/Components/NavigationHeaderIcon";

export type DataManagementHeaderAction = { key: string; label: string; icon?: ElementType; onClick: () => void; disabled?: boolean; tooltip?: string };
type Props = { title: string; description: string; icon?: ElementType; resultLabel?: string; resultCount: number; children?: ReactNode; error?: ReactNode; filters?: ReactNode; headerActions?: DataManagementHeaderAction[]; compactSpacing?: boolean };

/** Default workspace layout: a contextual header followed by management content. KPI blocks remain opt-in per module. */
export function DataManagementShell({ title, description, icon: HeaderIcon, resultLabel = "registros", resultCount, children, error, filters, headerActions = [], compactSpacing = false }: Props) {
  const pathname = usePathname();
  return <div className={`relative flex min-h-[calc(100vh-8rem)] flex-col pb-4 animate-in fade-in slide-in-from-bottom-4 duration-500 ${compactSpacing ? "gap-3" : "gap-5"}`}>
    <section className={`relative z-20 flex flex-col rounded-2xl border border-slate-200 bg-white shadow-sm ${compactSpacing ? "mb-0" : "mb-5"}`}>
      <div className="flex flex-col gap-4 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          {HeaderIcon ? <span className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#fdfaf5] text-[#a67c00]"><HeaderIcon size={22} strokeWidth={2.25} /></span> : <NavigationHeaderIcon href={pathname} />}
          <div><h1 className="text-xl font-black leading-none tracking-tight text-slate-800 sm:text-2xl">{title}</h1><p className="mt-1.5 text-xs font-medium text-slate-500 sm:text-sm">{description}</p></div>
        </div>
        {headerActions.length > 0 && <div className="flex flex-wrap items-center gap-2">{headerActions.map((action) => { const Icon = action.icon; return <button key={action.key} type="button" title={action.tooltip} disabled={action.disabled} onClick={action.onClick} className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-4 text-xs font-bold text-emerald-700 shadow-sm transition-all hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50">{Icon && <Icon size={14} strokeWidth={2.5} />}{action.label}</button>; })}</div>}
      </div>
      {filters}
      <div className="flex h-[42px] items-center rounded-b-2xl border-t border-slate-100 bg-slate-50/50 px-5 py-2"><span className="flex items-center gap-2 text-xs font-bold text-slate-500"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#C5A059]" />{resultCount} {resultLabel} encontrado{resultCount === 1 ? "" : "s"}</span></div>
    </section>
    <div className="relative z-10">{error ?? children}</div>
  </div>;
}
