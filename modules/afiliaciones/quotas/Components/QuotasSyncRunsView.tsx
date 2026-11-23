"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AlertCircle, Clock, Eye, RefreshCcw, X } from "lucide-react";
import { DataEmptyState, DataPagination, DataTable, type DataTableColumn } from "@/modules/shared/Components/DataManagement";
import type { QuotaIncidenceRow, QuotaSyncRunRow } from "../Models/QuotaAdmin";
import { coverageLabel, errorCodeLabel, formatDateTime, formatDuration, formatNumber, scopeLabel, syncStatusLabel, syncStatusTone } from "./quotaUi";

type RunDetail = { run: QuotaSyncRunRow; items: { data: QuotaIncidenceRow[]; meta: { page: number; pageSize: number; total: number; totalPages: number } } };

export function QuotasSyncRunsView() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [rows, setRows] = useState<QuotaSyncRunRow[]>([]);
  const [meta, setMeta] = useState({ page: 1, pageSize: 10, total: 0, totalPages: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [detail, setDetail] = useState<RunDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailId, setDetailId] = useState<number | null>(null);
  const page = Math.max(1, Number(searchParams.get("page") ?? 1) || 1);
  const pageSize = 10;
  const queryString = searchParams.toString();

  const load = useCallback(async (signal: AbortSignal) => {
    setIsLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/afiliaciones/quotas/sync-runs?page=${page}&pageSize=${pageSize}`, { signal, cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body?.message ?? "No se pudieron cargar las sincronizaciones.");
      setRows(body.data ?? []);
      setMeta(body.meta ?? { page, pageSize, total: 0, totalPages: 0 });
    } catch (cause) {
      if ((cause as Error)?.name !== "AbortError") setError("No pudimos cargar las sincronizaciones. Inténtalo nuevamente.");
    } finally {
      if (!signal.aborted) setIsLoading(false);
    }
  }, [page, pageSize]);

  useEffect(() => { const controller = new AbortController(); void load(controller.signal); return () => controller.abort(); }, [load, queryString]);

  const navigate = (mutate: (params: URLSearchParams) => void) => {
    const params = new URLSearchParams(searchParams.toString());
    mutate(params);
    router.replace(`${pathname}${params.toString() ? `?${params.toString()}` : ""}`);
  };

  const openDetail = async (runId: number, itemPage = 1) => {
    setDetailId(runId);
    setDetailLoading(true);
    try {
      const response = await fetch(`/api/afiliaciones/quotas/sync-runs/${runId}?page=${itemPage}&pageSize=10`, { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body?.message);
      setDetail(body.data);
    } catch {
      setDetail(null);
      setError("No pudimos cargar el detalle de la ejecución.");
    } finally {
      setDetailLoading(false);
    }
  };

  useEffect(() => {
    if (detailId == null) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") { setDetailId(null); setDetail(null); } };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [detailId]);

  const columns: DataTableColumn<QuotaSyncRunRow>[] = [
    { key: "id", header: "Run", width: "70px", render: (row) => <span className="font-mono text-xs font-black text-slate-700">#{row.id}</span> },
    { key: "scope", header: "Tipo", width: "110px", render: (row) => <span className="text-xs font-semibold text-slate-600">{scopeLabel(row.scope)}</span> },
    { key: "status", header: "Estado", width: "120px", render: (row) => <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${syncStatusTone(row.status)}`}>{syncStatusLabel(row.status)}</span> },
    { key: "started", header: "Inicio", width: "150px", render: (row) => <span className="text-[11px] text-slate-500">{formatDateTime(row.startedAt)}</span> },
    { key: "duration", header: "Duración", width: "100px", render: (row) => <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600"><Clock size={12} /> {formatDuration(row.startedAt, row.finishedAt)}</span> },
    { key: "processed", header: "Procesados", align: "right", width: "100px", render: (row) => <span className="text-xs font-bold tabular-nums text-slate-700">{formatNumber(row.processedAssociates)}</span> },
    { key: "synced", header: "Sync.", align: "right", width: "80px", render: (row) => <span className="text-xs font-bold tabular-nums text-emerald-700">{formatNumber(row.syncedAssociates)}</span> },
    { key: "failed", header: "Fallidos", align: "right", width: "80px", render: (row) => <span className={`text-xs font-bold tabular-nums ${row.failedAssociates ? "text-red-600" : "text-slate-400"}`}>{formatNumber(row.failedAssociates)}</span> },
    { key: "inserted", header: "Insertadas", align: "right", width: "100px", render: (row) => <span className="text-xs font-bold tabular-nums text-slate-700">{formatNumber(row.quotasInserted)}</span> },
    { key: "unchanged", header: "Sin cambios", align: "right", width: "100px", render: (row) => <span className="text-xs font-bold tabular-nums text-slate-500">{formatNumber(row.quotasUnchanged)}</span> },
    { key: "actions", header: "", align: "center", width: "60px", render: (row) => <button type="button" title="Ver detalle de la ejecución" aria-label={`Ver detalle del run ${row.id}`} onClick={() => void openDetail(row.id)} className="rounded-lg p-2 text-slate-500 hover:bg-[#fdfaf5] hover:text-[#a67c00]"><Eye size={16} /></button> },
  ];

  return <div className="space-y-4">
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-2 border-b border-slate-100 px-5 py-3 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-sm font-black uppercase tracking-widest text-slate-500">Historial de sincronizaciones</h2><p className="mt-1 text-xs text-slate-500">Ejecuciones del motor de cuotas. Esta vista es solo de consulta; no inicia procesos.</p></div><span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-slate-500">{formatNumber(meta.total)} ejecuciones</span></div>
    </section>

    {error ? <section className="flex min-h-64 flex-col items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm"><AlertCircle size={32} className="text-rose-400" /><h3 className="font-black text-slate-800">No pudimos cargar las sincronizaciones</h3><p className="text-sm text-slate-500">{error}</p><button type="button" onClick={() => void load(new AbortController().signal)} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"><RefreshCcw size={15} /> Reintentar</button></section>
      : rows.length === 0 && !isLoading ? <DataEmptyState title="Sin ejecuciones registradas" description="Cuando se ejecute el motor de cuotas, las corridas aparecerán aquí con su cobertura y resultados." />
      : <><DataTable data={rows} columns={columns} rowKey={(row) => row.id} loading={isLoading} minWidth="1180px" /><DataPagination page={meta.page} pageSize={pageSize} total={meta.total} totalPages={meta.totalPages} onPageChange={(next) => navigate((params) => params.set("page", String(next)))} onPageSizeChange={(next) => navigate((params) => { params.set("pageSize", String(next)); params.set("page", "1"); })} pageSizeOptions={[10]} /></>}

    {detailId !== null && <div className="fixed inset-0 z-[190] flex items-center justify-center bg-slate-950/45 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) { setDetailId(null); setDetail(null); } }}>
      <section role="dialog" aria-modal="true" aria-label={`Detalle de sincronización ${detailId}`} className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <header className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><div><h3 className="text-lg font-black text-slate-800">Ejecución #{detailId}</h3>{detail && <p className="mt-1 text-xs text-slate-500">{scopeLabel(detail.run.scope)} · {syncStatusLabel(detail.run.status)} · {formatDateTime(detail.run.startedAt)}</p>}</div><button type="button" onClick={() => { setDetailId(null); setDetail(null); }} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100"><X size={20} /></button></header>
        {detailLoading ? <div className="p-5"><div className="h-48 animate-pulse rounded-xl bg-slate-100" /></div> : detail ? <div className="flex-1 overflow-y-auto p-5">
          <div className="grid gap-2 sm:grid-cols-4">{[["Procesados", detail.run.processedAssociates], ["Sincronizados", detail.run.syncedAssociates], ["Sin datos", detail.run.noDataAssociates], ["Fallidos", detail.run.failedAssociates]].map(([label, value]) => <div key={String(label)} className="rounded-xl border border-slate-200 bg-slate-50 p-3"><p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{label}</p><p className="mt-1 text-xl font-black tabular-nums text-slate-800">{formatNumber(Number(value))}</p></div>)}</div>
          <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200"><table className="w-full min-w-[760px] text-left text-xs"><thead className="bg-slate-50 text-[10px] font-black uppercase tracking-widest text-slate-400"><tr><th className="px-3 py-2">Item</th><th className="px-3 py-2">Persona</th><th className="px-3 py-2">Código</th><th className="px-3 py-2">Estado</th><th className="px-3 py-2">Incidencia</th><th className="px-3 py-2">Intentos</th><th className="px-3 py-2">Fin</th></tr></thead><tbody>{detail.items.data.map((item) => <tr key={item.itemId} className="border-t border-slate-100"><td className="px-3 py-2 font-mono">{item.itemId}</td><td className="px-3 py-2">{item.personId ?? "—"}</td><td className="px-3 py-2 font-mono">{item.institutionalCode ?? "—"}</td><td className="px-3 py-2">{coverageLabel(item.status)}</td><td className="px-3 py-2">{item.errorCode ? <span title={item.errorCode}>{errorCodeLabel(item.errorCode)}</span> : "—"}</td><td className="px-3 py-2">{item.attempts}</td><td className="px-3 py-2 text-slate-500">{formatDateTime(item.finishedAt)}</td></tr>)}</tbody></table></div>
          <DataPagination page={detail.items.meta.page} pageSize={detail.items.meta.pageSize} total={detail.items.meta.total} totalPages={detail.items.meta.totalPages} onPageChange={(next) => { if (detailId != null) void openDetail(detailId, next); }} onPageSizeChange={() => undefined} pageSizeOptions={[10]} className="mt-3" />
        </div> : <div className="p-6 text-sm text-slate-500">No se pudo cargar el detalle.</div>}
      </section>
    </div>}
  </div>;
}
