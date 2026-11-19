"use client";

import { useCallback, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, ChevronRight, Coins, History, LayoutDashboard, RefreshCw, Users } from "lucide-react";
import { QuotasExportButton } from "../Components/QuotasExportButton";
import { QuotasAssociatesView } from "../Components/QuotasAssociatesView";
import { QuotasHistoryView } from "../Components/QuotasHistoryView";
import { QuotasIncidencesView } from "../Components/QuotasIncidencesView";
import { QuotasSummaryView } from "../Components/QuotasSummaryView";
import { QuotasSyncRunsView } from "../Components/QuotasSyncRunsView";
import { useQuotasSummary } from "../Components/useQuotasSummary";
import { formatLimaDateTime, syncStatusLabel, syncStatusTone, type QuotaTab } from "../Components/quotaUi";
import styles from "../Components/quotasDashboard.module.css";

const TABS: Array<{ id: QuotaTab; label: string; icon: typeof LayoutDashboard }> = [
  { id: "resumen", label: "Resumen general", icon: LayoutDashboard },
  { id: "asociados", label: "Asociados", icon: Users },
  { id: "historico", label: "Histórico", icon: History },
  { id: "incidencias", label: "Incidencias", icon: AlertTriangle },
  { id: "sincronizaciones", label: "Sincronizaciones", icon: RefreshCw },
];

function isTab(value: string | null): value is QuotaTab {
  return value === "resumen" || value === "asociados" || value === "historico" || value === "incidencias" || value === "sincronizaciones";
}

export function QuotasWorkspace({ canExport }: { canExport: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tab = isTab(searchParams.get("tab")) ? (searchParams.get("tab") as QuotaTab) : "resumen";
  const [notice, setNotice] = useState<string | null>(null);
  const queryString = useMemo(() => searchParams.toString(), [searchParams]);
  const { summary, isLoading: summaryLoading, error: summaryError, reload: reloadSummary } = useQuotasSummary();

  const setTab = useCallback((next: QuotaTab) => {
    const params = new URLSearchParams(searchParams.toString());
    if (next === "resumen") params.delete("tab"); else params.set("tab", next);
    params.delete("page");
    router.replace(`${pathname}${params.toString() ? `?${params.toString()}` : ""}`);
  }, [pathname, router, searchParams]);

  return <div className="flex min-h-[calc(100vh-8rem)] flex-col gap-5 pb-6">
    <section className={`${styles.fade} relative overflow-hidden rounded-xl border border-[#E4E2E0] bg-white`}>
      <span aria-hidden className={`${styles.headerGlow} pointer-events-none absolute -right-14 -top-24 h-52 w-52 rounded-full bg-[radial-gradient(circle,rgba(195,146,84,0.2),transparent_68%)]`} />
      <span aria-hidden className="pointer-events-none absolute -left-24 -bottom-28 h-56 w-56 rounded-full bg-[radial-gradient(circle,rgba(232,208,158,0.18),transparent_70%)]" />
      <div className="relative flex flex-col gap-5 px-5 pb-4 pt-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3.5">
          <span className="mt-1 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#FDFBF8] text-[#7F561E]"><Coins size={22} strokeWidth={2.1} /></span>
          <div>
            <div className="flex items-center gap-1 text-[11px] font-medium text-slate-400"><span>Eventos</span><ChevronRight size={12} /><span className="font-semibold text-[#7F561E]">Cuotas</span></div>
            <h1 className="mt-1 text-[28px] font-semibold leading-none tracking-tight text-[#1a1c1c]">Cuotas</h1>
            <p className="mt-1.5 text-[13px] font-medium text-[#5F5E5D]">Gestión y seguimiento económico de los asociados.</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-4 sm:justify-end">
          <div className="text-left sm:text-right">
            <p className="text-[11px] font-medium text-slate-400">Última sincronización</p>
            {summaryLoading ? <div className="mt-1 h-4 w-32 animate-pulse rounded bg-slate-100" /> : <p className="mt-1 text-[13px] font-semibold text-[#1a1c1c]">{formatLimaDateTime(summary?.lastSync?.finishedAt)}</p>}
            {summary?.lastSync && <span className={`mt-1 inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${syncStatusTone(summary.lastSync.status)}`}><span className={`${styles.pulseDot} h-1.5 w-1.5 rounded-full bg-current`} />{syncStatusLabel(summary.lastSync.status)}</span>}
          </div>
          <QuotasExportButton canExport={canExport} searchParams={new URLSearchParams(queryString)} onNotice={setNotice} />
        </div>
      </div>
      <nav aria-label="Secciones de cuotas" className="relative flex gap-1 overflow-x-auto border-t border-[#F1F0EE] px-3">
        {TABS.map((item) => {
          const active = tab === item.id;
          const Icon = item.icon;
          return <button key={item.id} type="button" role="tab" aria-selected={active} onClick={() => setTab(item.id)} className={`inline-flex shrink-0 items-center gap-2 border-b-2 px-4 py-3 text-[13px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C39254]/40 ${active ? "border-[#7F561E] font-semibold text-[#7F561E]" : "border-transparent font-medium text-slate-500 hover:text-[#7F561E]"}`}>
            <Icon size={15} strokeWidth={2.2} /> {item.label}
          </button>;
        })}
      </nav>
    </section>
    {notice && <div role="status" className={`${styles.fade} flex items-start justify-between gap-3 rounded-xl border border-[#E8D09E] bg-[#FDFBF8] px-4 py-3 text-sm font-medium text-[#7F561E]`}><span>{notice}</span><button type="button" onClick={() => setNotice(null)} className="text-xs font-semibold text-[#7F561E] hover:text-[#4A2D00]">Cerrar</button></div>}
    <div role="tabpanel">
      {tab === "resumen" && <QuotasSummaryView summary={summary} isLoading={summaryLoading} error={summaryError} onRetry={() => void reloadSummary()} onOpenHistory={() => setTab("historico")} onOpenIncidences={() => setTab("incidencias")} />}
      {tab === "asociados" && <QuotasAssociatesView />}
      {tab === "historico" && <QuotasHistoryView />}
      {tab === "incidencias" && <QuotasIncidencesView />}
      {tab === "sincronizaciones" && <QuotasSyncRunsView />}
    </div>
  </div>;
}
