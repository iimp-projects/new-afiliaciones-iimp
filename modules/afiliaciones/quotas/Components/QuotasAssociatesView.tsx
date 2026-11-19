"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AlertCircle, Eye, History, RefreshCcw, Search, ShieldAlert } from "lucide-react";
import { DataEmptyState, DataPagination, DataTable, type DataTableColumn } from "@/modules/shared/Components/DataManagement";
import type { QuotaAssociateRow } from "../Models/QuotaAdmin";
import { QuotasAssociateDrawer } from "./QuotasAssociateDrawer";
import { QuotasFilterBar, type QuotaFilterValues } from "./QuotasFilterBar";
import { CategoryBadge } from "./CategoryBadge";
import { financialStatusLabel, financialStatusTone, formatDate, formatMoney, formatNumber, annualQuotaPeriodLabel } from "./quotaUi";

type AssociateRow = QuotaAssociateRow & { sequence: number };

const FILTER_KEYS = ["search", "category", "membershipStatus", "accountingStatus", "financialStatus", "currency", "concept", "year", "yearFrom", "yearTo", "pendingMin", "pendingMax", "hasIncidences", "sort", "direction"];

export function QuotasAssociatesView() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [rows, setRows] = useState<QuotaAssociateRow[]>([]);
  const [meta, setMeta] = useState({ page: 1, pageSize: 10, total: 0, totalPages: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [detailPersonId, setDetailPersonId] = useState<number | null>(null);

  const values = useMemo<QuotaFilterValues>(() => {
    const result: QuotaFilterValues = { concept: "CUOTA", sort: "name", direction: "asc" };
    for (const key of FILTER_KEYS) { const value = searchParams.get(key); if (value) result[key] = value; }
    return result;
  }, [searchParams]);
  const page = Math.max(1, Number(searchParams.get("page") ?? 1) || 1);
  const pageSize = 10;
  const queryString = searchParams.toString();

  const load = useCallback(async (signal: AbortSignal) => {
    setIsLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
      for (const key of FILTER_KEYS) { const value = searchParams.get(key); if (value) params.set(key, value); }
      if (!params.has("concept")) params.set("concept", "CUOTA");
      const response = await fetch(`/api/afiliaciones/quotas/associates?${params.toString()}`, { signal, cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body?.message ?? "No se pudo listar.");
      setRows(body.data ?? []);
      setMeta(body.meta ?? { page, pageSize, total: 0, totalPages: 0 });
    } catch (cause) {
      if ((cause as Error)?.name !== "AbortError") setError("No pudimos cargar los asociados. Inténtalo nuevamente.");
    } finally {
      if (!signal.aborted) setIsLoading(false);
    }
  }, [page, pageSize, searchParams]);

  useEffect(() => { const controller = new AbortController(); void load(controller.signal); return () => controller.abort(); }, [load, queryString]);

  const navigate = (mutate: (params: URLSearchParams) => void) => {
    const params = new URLSearchParams(searchParams.toString());
    mutate(params);
    router.replace(`${pathname}${params.toString() ? `?${params.toString()}` : ""}`);
  };
  const clearFilters = useCallback(() => navigate((params) => { for (const key of FILTER_KEYS) params.delete(key); params.delete("page"); }), [pathname, router, searchParams]);
  const applyFilters = useCallback((next: QuotaFilterValues) => navigate((params) => {
    for (const key of FILTER_KEYS) params.delete(key);
    for (const [key, value] of Object.entries(next)) if (value) params.set(key, value);
    params.set("page", "1");
  }), [pathname, router, searchParams]);
  const goToPage = (next: number) => navigate((params) => params.set("page", String(next)));
  const changePageSize = (next: number) => navigate((params) => { params.set("pageSize", String(next)); params.set("page", "1"); });

  const numberedRows: AssociateRow[] = rows.map((row, index) => ({ ...row, sequence: (meta.page - 1) * pageSize + index + 1 }));

  const columns: DataTableColumn<AssociateRow>[] = [
    { key: "sequence", header: "#", align: "center", width: "36px", render: (row) => <span className="text-xs font-semibold tabular-nums text-slate-400">{row.sequence}</span> },
    { key: "code", header: "Código", width: "72px", render: (row) => <span className="font-mono text-xs font-bold text-slate-700">{row.institutionalCode ?? "—"}</span> },
    { key: "name", header: "Asociado", minWidth: "150px", render: (row) => <p className="text-sm font-bold text-slate-800">{row.fullName}</p> },
    { key: "category", header: "Categoría", width: "104px", render: (row) => <CategoryBadge code={row.categoryCode} name={row.categoryName} /> },
    { key: "pending", header: "Pend.", align: "center", width: "52px", render: (row) => <span className="text-xs font-bold tabular-nums text-amber-700">{formatNumber(row.pendienteCount)}</span> },
    { key: "pen", header: "Pend. PEN", align: "right", width: "104px", render: (row) => <span className="whitespace-nowrap text-xs font-bold tabular-nums text-slate-800">{formatMoney(row.pendientePen, "S/")}</span> },
    { key: "usd", header: "Pend. USD", align: "right", width: "100px", render: (row) => <span className="whitespace-nowrap text-xs font-bold tabular-nums text-slate-800">{formatMoney(row.pendienteUsd, "US$")}</span> },
    { key: "nextPayment", header: "Próx. cuota", align: "center", width: "116px", render: (row) => row.nextPaymentYear != null ? <span title="Próxima cuota a pagar (período referencial)" className="block text-[10px] font-medium leading-tight text-slate-600">{annualQuotaPeriodLabel(row.nextPaymentYear)}</span> : <span className="text-xs text-slate-300">—</span> },
    { key: "status", header: "Estado", width: "108px", render: (row) => <span className={`inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-bold ${financialStatusTone(row.financialStatus)}`}>{financialStatusLabel(row.financialStatus)}</span> },
    { key: "sync", header: "Última sync", width: "88px", render: (row) => <span className="whitespace-nowrap text-[11px] font-medium text-slate-500">{formatDate(row.lastSync)}</span> },
    { key: "actions", header: "", align: "center", width: "84px", render: (row) => <div className="flex items-center justify-center gap-0.5">
      <button type="button" title="Ver detalle de cuotas" aria-label={`Ver detalle de ${row.fullName}`} onClick={() => setDetailPersonId(row.personId)} className="rounded-lg p-2 text-slate-500 hover:bg-[#fdfaf5] hover:text-[#a67c00]"><Eye size={16} /></button>
      <button type="button" title="Ver histórico del asociado" aria-label={`Ver histórico de ${row.fullName}`} onClick={() => navigate((params) => { params.set("tab", "historico"); params.set("personId", String(row.personId)); params.set("search", ""); params.delete("page"); })} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700"><History size={16} /></button>
      {(row.errorCode || row.financialStatus === "FAILED") && <button type="button" title={`Incidencia: ${row.errorCode ?? "sin detalle"}`} aria-label={`Ver incidencia de ${row.fullName}`} onClick={() => setDetailPersonId(row.personId)} className="rounded-lg p-2 text-amber-600 hover:bg-amber-50"><ShieldAlert size={16} /></button>}
    </div> },
  ];

  return <div className="space-y-4">
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-2 border-b border-slate-100 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div><h2 className="text-sm font-black uppercase tracking-widest text-slate-500">Listado económico de asociados</h2><p className="mt-1 text-xs text-slate-500">Cuotas pendientes reportadas (excluye períodos futuros, mostrados como próxima cuota). No se interpretan como deuda exigible ni se suman monedas.</p></div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-slate-500"><Search size={12} /> {formatNumber(meta.total)} asociados</span>
      </div>
      <QuotasFilterBar values={values} loading={isLoading} onApply={applyFilters} onClear={clearFilters} />
      <div className="flex h-[36px] items-center border-t border-slate-100 bg-slate-50/50 px-5 text-xs font-bold text-slate-500">{formatNumber(meta.total)} asociados encontrados</div>
    </section>

    {error ? <section className="flex min-h-64 flex-col items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm"><AlertCircle size={32} className="text-rose-400" /><h3 className="font-black text-slate-800">No pudimos cargar los asociados</h3><p className="text-sm text-slate-500">{error}</p><button type="button" onClick={() => void load(new AbortController().signal)} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"><RefreshCcw size={15} /> Reintentar</button></section>
      : rows.length === 0 && !isLoading ? <DataEmptyState title="No se encontraron asociados" description="Ajusta los filtros o limpia la búsqueda para ver el universo completo." action={<button type="button" onClick={clearFilters} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50">Limpiar filtros</button>} />
      : <><DataTable data={numberedRows} columns={columns} rowKey={(row) => row.personId} loading={isLoading} minWidth="1000px" compact /><DataPagination page={meta.page} pageSize={pageSize} total={meta.total} totalPages={meta.totalPages} onPageChange={goToPage} onPageSizeChange={changePageSize} pageSizeOptions={[10]} /></>}

    <QuotasAssociateDrawer personId={detailPersonId} onClose={() => setDetailPersonId(null)} />
  </div>;
}
