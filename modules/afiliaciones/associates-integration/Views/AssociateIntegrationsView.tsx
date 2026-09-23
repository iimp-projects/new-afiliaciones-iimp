"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertCircle, Download, RefreshCcw } from "lucide-react";
import { DataEmptyState, DataLoadingState, DataManagementShell, type DataManagementHeaderAction } from "@/modules/shared/Components/DataManagement";
import { AssociateIntegrationDrawer } from "../Components/AssociateIntegrationDrawer";
import { AssociateIntegrationFilters } from "../Components/AssociateIntegrationFilters";
import { AssociateIntegrationPagination } from "../Components/AssociateIntegrationPagination";
import { AssociateIntegrationTable } from "../Components/AssociateIntegrationTable";
import { AssociateIntegrationDetail, AssociateIntegrationRow, emptyAssociateIntegrationFilters } from "../Components/associateIntegration.types";

export const canRetry = (status: string) => status === "RETRYABLE";
export function buildAssociateIntegrationsQuery(filters: Record<string, string | number | undefined>) { const params = new URLSearchParams(); Object.entries(filters).forEach(([key, value]) => { if (value !== undefined && value !== "") params.set(key, String(value)); }); return params.toString(); }

export function AssociateIntegrationsView() {
  const [rows, setRows] = useState<AssociateIntegrationRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [filters, setFilters] = useState(emptyAssociateIntegrationFilters);
  const [applied, setApplied] = useState(emptyAssociateIntegrationFilters);
  const [detail, setDetail] = useState<AssociateIntegrationDetail | null>(null);
  const [drawerTab, setDrawerTab] = useState<"Resumen" | "Payload SIE">("Resumen");
  const [isLoading, setIsLoading] = useState(true);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [confirmRetryId, setConfirmRetryId] = useState<number | null>(null);
  const [retrying, setRetrying] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setError("");
    setIsLoading(true);
    try {
      const query = buildAssociateIntegrationsQuery({ page, pageSize, ...applied });
      const response = await fetch(`/api/security/associate-integrations?${query}`);
      const body = await response.json();
      if (!response.ok) throw new Error(body.message);
      setRows(body.data ?? []);
      setTotal(body.pagination?.total ?? 0);
    } catch {
      setError("No pudimos cargar las integraciones. Inténtalo nuevamente.");
    } finally {
      setIsLoading(false);
    }
  }, [page, pageSize, applied]);

  useEffect(() => { const loadTimer = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(loadTimer); }, [load]);

  const hasFilters = Object.values(filters).some(Boolean);

  const openDetail = async (id: number, tab: "Resumen" | "Payload SIE" = "Resumen") => {
    setDrawerTab(tab);
    setIsDetailLoading(true);
    setDetail(null);
    try {
      const response = await fetch(`/api/security/associate-integrations/${id}`);
      const body = await response.json();
      if (response.ok) setDetail(body.data);
      else setMessage("No fue posible cargar el detalle de la integración.");
    } finally {
      setIsDetailLoading(false);
    }
  };

  const retry = async (id: number) => {
    setRetrying(id);
    setConfirmRetryId(null);
    try {
      const response = await fetch(`/api/security/associate-integrations/${id}/retry`, { method: "POST" });
      const body = await response.json();
      if (response.status === 409) setMessage("La integración ya está siendo procesada o su estado cambió. Actualizamos la información.");
      else if (!response.ok) setMessage(body.message ?? "No fue posible realizar el reintento.");
      else if (body.data?.status === "SYNCED") setMessage("Integración sincronizada correctamente.");
      else if (body.data?.status === "FAILED") setMessage("La integración requiere revisión antes de volver a intentarse.");
      else setMessage("El envío no se completó. El estado quedó actualizado para su seguimiento.");
      await load();
      if (detail?.integrationId === id) await openDetail(id);
    } finally {
      setRetrying(null);
    }
  };

  const clearFilters = () => { setFilters(emptyAssociateIntegrationFilters); setApplied(emptyAssociateIntegrationFilters); setPage(1); };
  const headerActions: DataManagementHeaderAction[] = [{ key: "export", label: "Exportar Excel", icon: Download, tooltip: "Requiere una exportación completa del listado filtrado.", onClick: () => setMessage("La exportación completa requiere un endpoint que entregue todos los registros filtrados.") }];

  return <DataManagementShell title="Inscripciones SIE" description="Seguimiento y control de las inscripciones enviadas al sistema SIE." resultCount={total} compactSpacing headerActions={headerActions} filters={<AssociateIntegrationFilters values={filters} loading={isLoading} onChange={setFilters} onApply={() => { setPage(1); setApplied(filters); }} onClear={clearFilters} />}>
    {message && <p role="status" className="rounded-xl border border-blue-100 bg-blue-50 p-3 text-sm font-bold text-blue-800">{message}</p>}
    {error ? <section className="flex min-h-64 flex-col items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm"><AlertCircle size={34} className="text-rose-400" /><div><h2 className="font-black text-slate-800">No pudimos cargar las integraciones</h2><p className="mt-1 text-sm text-slate-500">Verifica tu conexión e inténtalo nuevamente.</p></div><button onClick={() => void load()} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 shadow-sm hover:bg-slate-50"><RefreshCcw size={15} /> Reintentar carga</button></section> : isLoading ? <section className="rounded-2xl border border-slate-200 bg-white shadow-sm"><DataLoadingState /></section> : rows.length === 0 ? <DataEmptyState title="No se encontraron inscripciones SIE" description="Ajusta los filtros o espera nuevas inscripciones generadas por el flujo de afiliación." action={hasFilters ? <button onClick={clearFilters} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"><RefreshCcw size={15} /> Limpiar filtros</button> : undefined} /> : <><AssociateIntegrationTable rows={rows} onOpenDetail={(id, tab) => void openDetail(id, tab)} onRetry={setConfirmRetryId} /><AssociateIntegrationPagination total={total} page={page} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={(nextSize) => { setPageSize(nextSize); setPage(1); }} /></>}
    <AssociateIntegrationDrawer key={`${detail?.integrationId ?? "loading"}-${drawerTab}`} detail={detail} loading={isDetailLoading} retrying={retrying !== null} initialTab={drawerTab} onClose={() => { setDetail(null); setIsDetailLoading(false); }} onRetry={setConfirmRetryId} />
    {confirmRetryId !== null && <div role="dialog" aria-modal="true" aria-label="Confirmar reintento" className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 p-4"><div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl"><header className="border-b border-slate-100 px-5 py-4"><h2 className="font-black text-slate-800">¿Reintentar sincronización?</h2></header><div className="p-5"><p className="text-sm leading-6 text-slate-600">Se volverá a enviar esta afiliación a SIE. El pago y la aprobación interna no se modificarán.</p><div className="mt-6 flex justify-end gap-2"><button onClick={() => setConfirmRetryId(null)} className="rounded-lg px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50">Cancelar</button><button onClick={() => void retry(confirmRetryId)} className="rounded-lg bg-[#C5A059] px-4 py-2 text-sm font-bold text-white hover:bg-[#a67c00]">Confirmar reintento</button></div></div></div></div>}
  </DataManagementShell>;
}
