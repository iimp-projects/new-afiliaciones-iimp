"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AlertCircle, AlertTriangle, CheckCircle2, Eye, Info, RefreshCcw, ShieldAlert } from "lucide-react";
import { DataEmptyState, DataPagination, DataTable, type DataTableColumn } from "@/modules/shared/Components/DataManagement";
import { AppSelect } from "@/modules/shared/Components/Form";
import type { QuotaIncidenceRow } from "../Models/QuotaAdmin";
import { QuotasAssociateDrawer } from "./QuotasAssociateDrawer";
import { CategoryBadge } from "./CategoryBadge";
import { ERROR_CODE_LABELS, coverageLabel, coverageTone, errorCodeLabel, formatDateTime, formatNumber } from "./quotaUi";

type IncidenceTableRow = QuotaIncidenceRow & { sequence: number };

type IncidenceView = "current" | "resolved" | "all";

const ERROR_OPTIONS = Object.entries(ERROR_CODE_LABELS);
const STATUS_OPTIONS = [
  { value: "FAILED", label: "Error" },
  { value: "NOT_FOUND", label: "No encontrado" },
  { value: "NO_DATA", label: "Sin información" },
];
const codeFilterOptions = [{ value: "", label: "Todas las incidencias" }, ...ERROR_OPTIONS.map(([value, label]) => ({ value, label }))];
const statusFilterOptions = [{ value: "", label: "Toda cobertura" }, ...STATUS_OPTIONS];

export function QuotasIncidencesView() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [rows, setRows] = useState<QuotaIncidenceRow[]>([]);
  const [meta, setMeta] = useState({ page: 1, pageSize: 10, total: 0, totalPages: 0 });
  const [resolvedCount, setResolvedCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [detailPersonId, setDetailPersonId] = useState<number | null>(null);

  const view = (searchParams.get("view") as IncidenceView) || "current";
  const code = searchParams.get("code") ?? "";
  const status = searchParams.get("status") ?? "";
  const page = Math.max(1, Number(searchParams.get("page") ?? 1) || 1);
  const pageSize = 10;
  const queryString = searchParams.toString();

  const load = useCallback(async (signal: AbortSignal) => {
    setIsLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
      if (view === "resolved") params.set("resolvedOnly", "true");
      if (view === "all") params.set("includeResolved", "true");
      if (code) params.set("code", code);
      if (status && view !== "resolved") params.set("status", status);
      const response = await fetch(`/api/afiliaciones/quotas/incidences?${params.toString()}`, { signal, cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body?.message ?? "No se pudieron cargar las incidencias.");
      setRows(body.data ?? []);
      setMeta(body.meta ?? { page, pageSize, total: 0, totalPages: 0 });
      setResolvedCount(Number(body.resolvedCount ?? 0));
    } catch (cause) {
      if ((cause as Error)?.name !== "AbortError") setError("No pudimos cargar las incidencias. Inténtalo nuevamente.");
    } finally {
      if (!signal.aborted) setIsLoading(false);
    }
  }, [page, pageSize, view, code, status]);

  useEffect(() => { const controller = new AbortController(); void load(controller.signal); return () => controller.abort(); }, [load, queryString]);

  const navigate = (mutate: (params: URLSearchParams) => void) => {
    const params = new URLSearchParams(searchParams.toString());
    mutate(params);
    router.replace(`${pathname}${params.toString() ? `?${params.toString()}` : ""}`);
  };
  const setView = (next: IncidenceView) => navigate((params) => { if (next === "current") params.delete("view"); else params.set("view", next); params.delete("page"); });
  const setFilter = (key: string, value: string) => navigate((params) => { if (value) params.set(key, value); else params.delete(key); params.set("page", "1"); });
  const clear = () => navigate((params) => { params.delete("view"); params.delete("code"); params.delete("status"); params.delete("page"); });

  const numberedRows: IncidenceTableRow[] = rows.map((row, index) => ({ ...row, sequence: (meta.page - 1) * pageSize + index + 1 }));

  const columns: DataTableColumn<IncidenceTableRow>[] = [
    { key: "sequence", header: "#", align: "center", width: "44px", render: (row) => <span className="text-xs font-semibold tabular-nums text-slate-400">{row.sequence}</span> },
    { key: "person", header: "Asociado", minWidth: "150px", render: (row) => <button type="button" disabled={!row.personId} onClick={() => row.personId && setDetailPersonId(row.personId)} className="text-left disabled:cursor-default"><span className="block text-sm font-bold text-slate-800 hover:text-[#a67c00]">{row.personId ? `Asociado #${row.personId}` : "Sin persona"}</span><span className="mt-0.5 block font-mono text-[11px] text-slate-500">{row.institutionalCode ?? "Sin código institucional"}</span></button> },
    { key: "category", header: "Categoría", width: "120px", render: (row) => <CategoryBadge code={row.categoryCode} /> },
    { key: "status", header: "Cobertura", width: "112px", render: (row) => <span className={`inline-flex whitespace-nowrap rounded-md px-2 py-1 text-[10px] font-bold ${coverageTone(row.status)}`}>{coverageLabel(row.status)}</span> },
    { key: "error", header: "Incidencia", minWidth: "210px", render: (row) => <div title={row.errorCode ?? undefined}><p className="text-xs font-bold text-slate-700">{errorCodeLabel(row.errorCode ?? (row.status === "NOT_FOUND" ? "NOT_FOUND" : row.status === "NO_DATA" ? "NO_DATA" : null))}</p>{row.errorCode && <p className="mt-0.5 font-mono text-[10px] text-slate-400">{row.errorCode}</p>}</div> },
    { key: "attempts", header: "Intentos", align: "center", width: "72px", render: (row) => <span className="text-xs font-bold tabular-nums text-slate-600">{row.attempts}</span> },
    { key: "started", header: "Inicio", width: "132px", render: (row) => <span className="whitespace-nowrap text-[11px] text-slate-500">{formatDateTime(row.startedAt)}</span> },
    { key: "finished", header: "Fin", width: "132px", render: (row) => <span className="whitespace-nowrap text-[11px] text-slate-500">{formatDateTime(row.finishedAt)}</span> },
    { key: "resolved", header: "Estado", width: "98px", render: (row) => row.resolved ? <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-700"><CheckCircle2 size={12} /> Resuelta</span> : <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-1 text-[10px] font-bold text-amber-700"><AlertTriangle size={12} /> Vigente</span> },
    { key: "actions", header: "", align: "center", width: "46px", render: (row) => <button type="button" title="Ver detalle del asociado" aria-label="Ver detalle del asociado" disabled={!row.personId} onClick={() => row.personId && setDetailPersonId(row.personId)} className="rounded-lg p-1.5 text-slate-500 hover:bg-[#fdfaf5] hover:text-[#a67c00] disabled:opacity-30"><Eye size={15} /></button> },
  ];

  return <div className="space-y-4">
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div><h2 className="text-sm font-black uppercase tracking-widest text-slate-500">Incidencias de calidad de datos</h2><p className="mt-1 text-xs text-slate-500">Errores de sincronización y cobertura. No se edita información financiera del SIE.</p></div>
        <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1">{([{ value: "current", label: "Vigentes" }, { value: "resolved", label: `Resueltas (${formatNumber(resolvedCount)})` }, { value: "all", label: "Todas" }] as const).map((option) => <button key={option.value} type="button" onClick={() => setView(option.value)} className={`rounded-lg px-3 py-1.5 text-xs font-bold ${view === option.value ? "bg-white text-[#7f561e] shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>{option.label}</button>)}</div>
      </div>
      <div className="flex flex-wrap items-center gap-2 px-5 py-3">
        <AppSelect aria-label="Filtrar incidencia" value={code} options={codeFilterOptions} onChange={(value) => setFilter("code", value)} searchable portal className="min-w-[240px]" />
        {view !== "resolved" && <AppSelect aria-label="Filtrar cobertura" value={status} options={statusFilterOptions} onChange={(value) => setFilter("status", value)} searchable portal className="min-w-[190px]" />}
        {(code || status || view !== "current") && <button type="button" onClick={clear} className="h-10 rounded-xl border border-red-200 bg-red-50 px-4 text-sm font-bold text-red-600 hover:bg-red-500 hover:text-white">Limpiar</button>}
        <span className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-slate-500"><Info size={12} /> {formatNumber(meta.total)} incidencias</span>
      </div>
      <div className="border-t border-slate-100 bg-slate-50/50 px-5 py-2 text-[11px] font-semibold text-slate-500">Las incidencias resueltas corresponden a ítems reintentados exitosamente. Las vigentes incluyen no encontrados, sin información y errores de validación.</div>
    </section>

    {error ? <section className="flex min-h-64 flex-col items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm"><AlertCircle size={32} className="text-rose-400" /><h3 className="font-black text-slate-800">No pudimos cargar las incidencias</h3><p className="text-sm text-slate-500">{error}</p><button type="button" onClick={() => void load(new AbortController().signal)} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"><RefreshCcw size={15} /> Reintentar</button></section>
      : rows.length === 0 && !isLoading ? <DataEmptyState title="Sin incidencias para mostrar" description="No hay resultados con los filtros seleccionados. Las incidencias resueltas se conservan para trazabilidad." icon={<ShieldAlert size={30} />} />
      : <><DataTable data={numberedRows} columns={columns} rowKey={(row) => row.itemId} loading={isLoading} minWidth="1120px" /><DataPagination page={meta.page} pageSize={pageSize} total={meta.total} totalPages={meta.totalPages} onPageChange={(next) => navigate((params) => params.set("page", String(next)))} onPageSizeChange={(next) => navigate((params) => { params.set("pageSize", String(next)); params.set("page", "1"); })} pageSizeOptions={[10]} /></>}

    <QuotasAssociateDrawer personId={detailPersonId} onClose={() => setDetailPersonId(null)} />
  </div>;
}
