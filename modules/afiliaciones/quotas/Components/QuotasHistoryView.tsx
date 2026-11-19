"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AlertCircle, Eye, RefreshCcw, UserRound, X } from "lucide-react";
import { DataEmptyState, DataPagination, DataTable, type DataTableColumn } from "@/modules/shared/Components/DataManagement";
import type { QuotaHistoryRow } from "../Models/QuotaAdmin";
import { QuotasAssociateDrawer } from "./QuotasAssociateDrawer";
import { QuotasFilterBar, type QuotaFilterValues } from "./QuotasFilterBar";
import { CategoryBadge } from "./CategoryBadge";
import { accountingStatusLabel, accountingStatusTone, conceptLabel, formatDate, formatMoney, formatNumber } from "./quotaUi";

type HistoryRow = QuotaHistoryRow & { sequence: number };

const FILTER_KEYS = ["search", "category", "membershipStatus", "accountingStatus", "financialStatus", "currency", "concept", "year", "yearFrom", "yearTo", "pendingMin", "pendingMax", "hasIncidences", "sort", "direction"];

export function QuotasHistoryView() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [rows, setRows] = useState<QuotaHistoryRow[]>([]);
  const [meta, setMeta] = useState({ page: 1, pageSize: 10, total: 0, totalPages: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [detailPersonId, setDetailPersonId] = useState<number | null>(null);

  const values = useMemo<QuotaFilterValues>(() => {
    const result: QuotaFilterValues = {};
    for (const key of FILTER_KEYS) { const value = searchParams.get(key); if (value) result[key] = value; }
    return result;
  }, [searchParams]);
  const personId = Number(searchParams.get("personId")) || null;
  const page = Math.max(1, Number(searchParams.get("page") ?? 1) || 1);
  const pageSize = 10;
  const queryString = searchParams.toString();

  const load = useCallback(async (signal: AbortSignal) => {
    setIsLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
      for (const key of FILTER_KEYS) { const value = searchParams.get(key); if (value) params.set(key, value); }
      if (personId) params.set("personId", String(personId));
      const response = await fetch(`/api/afiliaciones/quotas/history?${params.toString()}`, { signal, cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body?.message ?? "No se pudo listar.");
      setRows(body.data ?? []);
      setMeta(body.meta ?? { page, pageSize, total: 0, totalPages: 0 });
    } catch (cause) {
      if ((cause as Error)?.name !== "AbortError") setError("No pudimos cargar el histórico. Inténtalo nuevamente.");
    } finally {
      if (!signal.aborted) setIsLoading(false);
    }
  }, [page, pageSize, searchParams, personId]);

  useEffect(() => { const controller = new AbortController(); void load(controller.signal); return () => controller.abort(); }, [load, queryString]);

  const navigate = (mutate: (params: URLSearchParams) => void) => {
    const params = new URLSearchParams(searchParams.toString());
    mutate(params);
    router.replace(`${pathname}${params.toString() ? `?${params.toString()}` : ""}`);
  };
  const applyFilters = useCallback((next: QuotaFilterValues) => navigate((params) => {
    for (const key of FILTER_KEYS) params.delete(key);
    for (const [key, value] of Object.entries(next)) if (value) params.set(key, value);
    params.set("page", "1");
  }), [pathname, router, searchParams]);
  const clearFilters = useCallback(() => navigate((params) => { for (const key of FILTER_KEYS) params.delete(key); params.delete("personId"); params.delete("page"); }), [pathname, router, searchParams]);
  const goToPage = (next: number) => navigate((params) => params.set("page", String(next)));
  const changePageSize = (next: number) => navigate((params) => { params.set("pageSize", String(next)); params.set("page", "1"); });

  const numberedRows: HistoryRow[] = rows.map((row, index) => ({ ...row, sequence: (meta.page - 1) * pageSize + index + 1 }));

  const columns: DataTableColumn<HistoryRow>[] = [
    { key: "sequence", header: "#", align: "center", width: "44px", render: (row) => <span className="text-xs font-semibold tabular-nums text-slate-400">{row.sequence}</span> },
    { key: "associate", header: "Asociado", minWidth: "190px", render: (row) => <button type="button" onClick={() => row.personId && setDetailPersonId(row.personId)} className="text-left"><span className="block text-sm font-bold text-slate-800 hover:text-[#a67c00]">{row.personName ?? "Sin nombre"}</span><span className="mt-0.5 block font-mono text-[11px] text-slate-500">{row.institutionalCode ?? "Sin código"}</span></button> },
    { key: "category", header: "Categoría", width: "128px", render: (row) => <CategoryBadge code={row.categoryCode} name={row.categoryName} /> },
    { key: "concept", header: "Concepto", width: "92px", render: (row) => <span className="text-xs font-semibold text-slate-700">{conceptLabel(row.concept)}</span> },
    { key: "year", header: "Año", width: "58px", render: (row) => <span className="text-xs font-bold text-slate-700">{row.year}</span> },
    { key: "number", header: "N°", width: "48px", render: (row) => <span className="text-xs font-semibold text-slate-500">{row.quotaNumber ?? "—"}</span> },
    { key: "period", header: "Período", width: "155px", render: (row) => <span className="whitespace-nowrap text-[11px] text-slate-500">{row.periodStart ? `${formatDate(row.periodStart)}${row.periodEnd ? ` – ${formatDate(row.periodEnd)}` : ""}` : "—"}</span> },
    { key: "amount", header: "Importe", align: "right", width: "122px", render: (row) => <span className="whitespace-nowrap text-xs font-bold tabular-nums text-slate-800">{formatMoney(row.amount, row.currency)}</span> },
    { key: "status", header: "Estado", width: "102px", render: (row) => <span className={`inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-bold ${accountingStatusTone(row.accountingStatus)}`}>{accountingStatusLabel(row.accountingStatus)}</span> },
    { key: "paid", header: "Pago", width: "102px", render: (row) => <span className="whitespace-nowrap text-[11px] text-slate-500">{formatDate(row.paidAt)}</span> },
    { key: "receipt", header: "Comprob.", width: "106px", render: (row) => <span className="whitespace-nowrap text-[11px] text-slate-500">{row.receiptSerie || row.receiptNumber ? `${row.receiptSerie ?? ""} ${row.receiptNumber ?? ""}`.trim() : "—"}</span> },
    { key: "present", header: "Presencia", width: "92px", render: (row) => row.isPresentInLastSuccessfulSync ? <span className="rounded-md bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-700">Vigente</span> : <span className="rounded-md bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-500">Ausente</span> },
    { key: "actions", header: "", align: "center", width: "46px", render: (row) => <button type="button" title="Ver detalle del asociado" aria-label="Ver detalle del asociado" disabled={!row.personId} onClick={() => row.personId && setDetailPersonId(row.personId)} className="rounded-lg p-1.5 text-slate-500 hover:bg-[#fdfaf5] hover:text-[#a67c00] disabled:opacity-30"><Eye size={15} /></button> },
  ];

  return <div className="space-y-4">
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-2 border-b border-slate-100 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div><h2 className="text-sm font-black uppercase tracking-widest text-slate-500">Histórico general de cuotas</h2><p className="mt-1 text-xs text-slate-500">Registros individuales del SIE. Por defecto se muestran todos los conceptos; los ausentes se conservan y se identifican.</p></div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-slate-500">{formatNumber(meta.total)} registros</span>
      </div>
      {personId && <div className="flex items-center justify-between border-b border-slate-100 bg-[#fdfaf5] px-5 py-2 text-xs font-bold text-[#7f561e]"><span className="inline-flex items-center gap-1.5"><UserRound size={14} /> Filtrado por asociado #{personId}</span><button type="button" onClick={() => navigate((params) => { params.delete("personId"); params.set("page", "1"); })} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 hover:bg-white"><X size={13} /> Quitar</button></div>}
      <QuotasFilterBar values={values} loading={isLoading} onApply={applyFilters} onClear={clearFilters} defaultConcept="" />
    </section>

    {error ? <section className="flex min-h-64 flex-col items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm"><AlertCircle size={32} className="text-rose-400" /><h3 className="font-black text-slate-800">No pudimos cargar el histórico</h3><p className="text-sm text-slate-500">{error}</p><button type="button" onClick={() => void load(new AbortController().signal)} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"><RefreshCcw size={15} /> Reintentar</button></section>
      : rows.length === 0 && !isLoading ? <DataEmptyState title="No se encontraron registros" description="Ajusta los filtros, el concepto o el año para ampliar el histórico." action={<button type="button" onClick={clearFilters} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50">Limpiar filtros</button>} />
      : <><DataTable data={numberedRows} columns={columns} rowKey={(row) => row.id} loading={isLoading} minWidth="1280px" /><DataPagination page={meta.page} pageSize={pageSize} total={meta.total} totalPages={meta.totalPages} onPageChange={goToPage} onPageSizeChange={changePageSize} pageSizeOptions={[10]} /></>}

    <QuotasAssociateDrawer personId={detailPersonId} onClose={() => setDetailPersonId(null)} />
  </div>;
}
