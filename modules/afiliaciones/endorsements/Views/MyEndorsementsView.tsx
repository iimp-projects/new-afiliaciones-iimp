"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  FileCheck2,
  Handshake,
  Inbox,
  Search,
  UserRound,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { GlobalModalRoot } from "@/modules/shared/Components/GlobalModalRoot";
import { formatPeruDate } from "@/modules/shared/Utils/formatPeruDateTime";
import {
  AFFILIATE_TYPE_LABELS,
  APPLICATION_STATUSES,
  APPLICATION_STATUS_LABELS,
  ENDORSEMENT_STATUS_LABELS,
  type ApplicationStatusValue,
  type EndorsementHistoryItem,
  type EndorsementHistoryPage,
  type EndorsementStatusValue,
} from "../Models/MyEndorsement";

const PAGE_SIZE = 10;
const UNKNOWN = "No disponible";

const applicationTone: Record<ApplicationStatusValue, string> = {
  DRAFT: "border-slate-200 bg-slate-50 text-slate-600",
  PENDING: "border-slate-200 bg-slate-50 text-slate-600",
  UNDER_EVALUACION: "border-sky-200 bg-sky-50 text-sky-700",
  OBSERVED: "border-amber-200 bg-amber-50 text-amber-700",
  RESOLVED: "border-sky-200 bg-sky-50 text-sky-700",
  READY_FOR_PAYMENT: "border-emerald-200 bg-emerald-50 text-emerald-700",
  COMPLETED: "border-emerald-200 bg-emerald-50 text-emerald-700",
  REJECTED: "border-rose-200 bg-rose-50 text-rose-700",
};

const endorsementTone: Record<EndorsementStatusValue, string> = {
  APPROVED: "border-emerald-200 bg-emerald-50 text-emerald-700",
  REJECTED: "border-rose-200 bg-rose-50 text-rose-700",
  PENDING: "border-amber-200 bg-amber-50 text-amber-700",
  INACTIVE: "border-slate-200 bg-slate-50 text-slate-500",
};

const label = (value?: string | null) => (value && value.trim() ? value : UNKNOWN);

export function MyEndorsementsView() {
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [reloadToken, setReloadToken] = useState(0);
  const [data, setData] = useState<EndorsementHistoryPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [detail, setDetail] = useState<EndorsementHistoryItem | null>(null);
  const [acting, setActing] = useState<number | null>(null);
  const [confirm, setConfirm] = useState<{ item: EndorsementHistoryItem; action: "APPROVE" | "REJECT" } | null>(null);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 350);
    return () => window.clearTimeout(timeout);
  }, [searchInput]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");

    const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
    if (search) params.set("search", search);
    if (status) params.set("status", status);
    if (from) params.set("from", from);
    if (to) params.set("to", to);

    fetch(`/api/mi-cuenta/avales?${params.toString()}`, {
      signal: controller.signal,
      credentials: "same-origin",
      cache: "no-store",
    })
      .then(async (response) => {
        const body = (await response.json()) as { success?: boolean; message?: string; data?: EndorsementHistoryPage };
        if (!response.ok || !body.success || !body.data) {
          throw new Error(body.message || "No fue posible consultar tus avales.");
        }
        setData(body.data);
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return;
        setError(cause instanceof Error ? cause.message : "No fue posible consultar tus avales.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [search, status, from, to, page, reloadToken]);

  const metrics = data?.metrics ?? { total: 0, approved: 0, inProcess: 0 };
  const hasFilters = useMemo(
    () => Boolean(search || status || from || to),
    [search, status, from, to],
  );

  const resetFilters = () => {
    setSearchInput("");
    setSearch("");
    setStatus("");
    setFrom("");
    setTo("");
    setPage(1);
  };

  const review = async () => {
    if (!confirm) return;
    setActing(confirm.item.id);
    try {
      const response = await fetch(`/api/mi-cuenta/avales/${confirm.item.id}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ action: confirm.action }),
      });
      const body = (await response.json().catch(() => ({}))) as { success?: boolean; message?: string };
      if (!response.ok || !body.success) {
        throw new Error(body.message || "No fue posible registrar tu respuesta.");
      }
      toast.success(body.message || "Respuesta registrada.");
      setConfirm(null);
      setDetail(null);
      setReloadToken((current) => current + 1);
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "No fue posible registrar tu respuesta.");
    } finally {
      setActing(null);
    }
  };

  const totalPages = data?.totalPages ?? 0;

  return (
    <div className="w-full space-y-5">
      <header>
        <p className="text-sm font-semibold text-[#A67C00]">Mi cuenta</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          Mis avales
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Historial de avales que otorgaste a postulantes del IIMP y el estado actual de sus solicitudes.
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-3">
        <MetricCard icon={Handshake} label="Avales otorgados" value={metrics.total} helper="Total histórico" />
        <MetricCard icon={FileCheck2} label="Solicitudes aprobadas" value={metrics.approved} helper="Expedientes aprobados" />
        <MetricCard icon={Clock3} label="Solicitudes en proceso" value={metrics.inProcess} helper="En evaluación" />
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 p-5">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="relative">
              <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Buscar por nombre"
                aria-label="Buscar por nombre del solicitante"
                className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-700 outline-none transition focus:border-[#B8892D] focus:ring-2 focus:ring-[#B8892D]/20"
              />
            </div>

            <select
              value={status}
              onChange={(event) => { setStatus(event.target.value); setPage(1); }}
              aria-label="Filtrar por estado de la solicitud"
              className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 outline-none transition focus:border-[#B8892D] focus:ring-2 focus:ring-[#B8892D]/20"
            >
              <option value="">Todos los estados</option>
              {APPLICATION_STATUSES.map((value) => (
                <option key={value} value={value}>{APPLICATION_STATUS_LABELS[value]}</option>
              ))}
            </select>

            <input
              type="date"
              value={from}
              onChange={(event) => { setFrom(event.target.value); setPage(1); }}
              aria-label="Fecha de otorgamiento desde"
              className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-[#B8892D] focus:ring-2 focus:ring-[#B8892D]/20"
            />

            <div className="flex gap-3">
              <input
                type="date"
                value={to}
                onChange={(event) => { setTo(event.target.value); setPage(1); }}
                aria-label="Fecha de otorgamiento hasta"
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-[#B8892D] focus:ring-2 focus:ring-[#B8892D]/20"
              />
              {hasFilters && (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
                >
                  <X size={15} />
                  Limpiar
                </button>
              )}
            </div>
          </div>
        </div>

        {error ? (
          <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-500">
              <AlertCircle size={22} />
            </div>
            <p className="text-sm font-semibold text-slate-700">{error}</p>
            <button
              type="button"
              onClick={() => setReloadToken((current) => current + 1)}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
            >
              Reintentar
            </button>
          </div>
        ) : loading && !data ? (
          <LoadingRows />
        ) : data && data.totalItems === 0 ? (
          <EmptyState hasFilters={hasFilters} onReset={resetFilters} />
        ) : (
          <EndorsementsTable
            items={data?.items ?? []}
            loading={loading}
            acting={acting}
            onDetail={setDetail}
            onReview={(item, action) => setConfirm({ item, action })}
          />
        )}

        {data && data.totalItems > 0 && (
          <div className="flex flex-col items-center justify-between gap-3 border-t border-slate-100 px-5 py-4 sm:flex-row">
            <p className="text-sm text-slate-500">
              {data.totalItems} {data.totalItems === 1 ? "aval" : "avales"}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={page <= 1 || loading}
                className="inline-flex h-9 items-center gap-1 rounded-lg border border-slate-200 px-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <ChevronLeft size={15} />
                Anterior
              </button>
              <span className="text-sm font-semibold text-slate-600">
                Página {page} de {Math.max(totalPages, 1)}
              </span>
              <button
                type="button"
                onClick={() => setPage((current) => Math.min(Math.max(totalPages, 1), current + 1))}
                disabled={page >= totalPages || loading}
                className="inline-flex h-9 items-center gap-1 rounded-lg border border-slate-200 px-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Siguiente
                <ChevronRight size={15} />
              </button>
            </div>
          </div>
        )}
      </section>

      {detail && (
        <EndorsementDetail
          item={detail}
          acting={acting}
          onReview={(action) => setConfirm({ item: detail, action })}
          onClose={() => setDetail(null)}
        />
      )}
      {confirm && (
        <ConfirmReviewModal
          confirm={confirm}
          acting={acting}
          onConfirm={review}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label: title,
  value,
  helper,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  helper: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-[#F8F1E4] text-[#A67C00]">
        <Icon size={18} />
      </div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">{title}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-900">{value}</p>
      <p className="mt-1 text-xs text-slate-400">{helper}</p>
    </div>
  );
}

function EndorsementsTable({
  items,
  loading,
  acting,
  onDetail,
  onReview,
}: {
  items: EndorsementHistoryItem[];
  loading: boolean;
  acting: number | null;
  onDetail: (item: EndorsementHistoryItem) => void;
  onReview: (item: EndorsementHistoryItem, action: "APPROVE" | "REJECT") => void;
}) {
  return (
    <div className="relative overflow-x-auto">
      {loading && <div className="absolute inset-x-0 top-0 h-0.5 animate-pulse bg-[#B8892D]/50" />}
      <table className="w-full min-w-[860px] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-slate-100 text-[11px] uppercase tracking-[0.1em] text-slate-400">
            <th className="px-5 py-3 font-semibold">Solicitante</th>
            <th className="px-5 py-3 font-semibold">Fecha de otorgamiento</th>
            <th className="px-5 py-3 font-semibold">Estado de la solicitud</th>
            <th className="px-5 py-3 font-semibold">Estado del aval</th>
            <th className="px-5 py-3 text-right font-semibold">Acción</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60">
              <td className="px-5 py-3.5">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                    <UserRound size={15} />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-slate-800">{label(item.applicantName)}</p>
                    <p className="text-xs text-slate-400">{AFFILIATE_TYPE_LABELS[item.affiliateType] ?? UNKNOWN}</p>
                  </div>
                </div>
              </td>
              <td className="px-5 py-3.5 text-slate-600">{formatPeruDate(item.endorsementDate)}</td>
              <td className="px-5 py-3.5">
                <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${applicationTone[item.applicationStatus]}`}>
                  {APPLICATION_STATUS_LABELS[item.applicationStatus] ?? item.applicationStatus}
                </span>
              </td>
              <td className="px-5 py-3.5">
                <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${endorsementTone[item.endorsementStatus]}`}>
                  {ENDORSEMENT_STATUS_LABELS[item.endorsementStatus] ?? item.endorsementStatus}
                </span>
              </td>
              <td className="px-5 py-3.5 text-right">
                <div className="flex items-center justify-end gap-2">
                  {item.endorsementStatus === "PENDING" && (
                    <>
                      <button
                        type="button"
                        disabled={acting === item.id}
                        onClick={() => onReview(item, "APPROVE")}
                        className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <Check size={14} />
                        Aprobar
                      </button>
                      <button
                        type="button"
                        disabled={acting === item.id}
                        onClick={() => onReview(item, "REJECT")}
                        className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <X size={14} />
                        Rechazar
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={() => onDetail(item)}
                    className="inline-flex items-center rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-[#D9BF89] hover:text-[#A67C00]"
                  >
                    Ver detalle
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function LoadingRows() {
  return (
    <div className="space-y-3 p-5">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="h-12 animate-pulse rounded-xl bg-slate-100" />
      ))}
    </div>
  );
}

function EmptyState({ hasFilters, onReset }: { hasFilters: boolean; onReset: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#F8F1E4] text-[#A67C00]">
        <Inbox size={26} />
      </div>
      <p className="text-base font-semibold text-slate-800">
        {hasFilters ? "No encontramos avales con esos filtros" : "Aún no has otorgado avales"}
      </p>
      <p className="max-w-md text-sm text-slate-500">
        {hasFilters
          ? "Prueba con otro nombre, fecha o estado para encontrar el aval que buscas."
          : "Cuando otorgues un aval a un postulante del IIMP, aparecerá aquí con el estado de su solicitud."}
      </p>
      {hasFilters && (
        <button
          type="button"
          onClick={onReset}
          className="mt-1 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
        >
          Limpiar filtros
        </button>
      )}
    </div>
  );
}

function EndorsementDetail({
  item,
  acting,
  onReview,
  onClose,
}: {
  item: EndorsementHistoryItem;
  acting: number | null;
  onReview: (action: "APPROVE" | "REJECT") => void;
  onClose: () => void;
}) {
  return (
    <GlobalModalRoot title="Detalle del aval">
      <div className="w-full max-w-lg rounded-3xl bg-white p-7 shadow-2xl">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#A67C00]">Aval otorgado</p>
            <h2 className="mt-1 text-xl font-bold text-slate-900">{label(item.applicantName)}</h2>
            <p className="text-sm text-slate-500">{AFFILIATE_TYPE_LABELS[item.affiliateType] ?? UNKNOWN}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar detalle"
            className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          >
            <X size={18} />
          </button>
        </div>

        <dl className="grid gap-4 sm:grid-cols-2">
          <DetailField label="Código de expediente" value={label(item.applicationCode)} />
          <DetailField label="Fecha de otorgamiento" value={formatPeruDate(item.endorsementDate)} />
          <DetailField
            label="Estado del aval"
            value={ENDORSEMENT_STATUS_LABELS[item.endorsementStatus] ?? item.endorsementStatus}
          />
          <DetailField
            label="Estado de la solicitud"
            value={APPLICATION_STATUS_LABELS[item.applicationStatus] ?? item.applicationStatus}
          />
        </dl>

        <p className="mt-5 rounded-xl bg-slate-50 px-4 py-3 text-xs leading-5 text-slate-500">
          El estado del aval es independiente del estado general del expediente del solicitante.
        </p>

        {item.endorsementStatus === "PENDING" && (
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              disabled={acting === item.id}
              onClick={() => onReview("APPROVE")}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-emerald-600 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Check size={16} />
              Aprobar aval
            </button>
            <button
              type="button"
              disabled={acting === item.id}
              onClick={() => onReview("REJECT")}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <X size={16} />
              Rechazar aval
            </button>
          </div>
        )}

        <button
          type="button"
          onClick={onClose}
          className="mt-5 h-11 w-full rounded-xl bg-[#B8892D] text-sm font-semibold text-white transition hover:bg-[#9E7425]"
        >
          Cerrar
        </button>
      </div>
    </GlobalModalRoot>
  );
}

function DetailField({ label: title, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">{title}</dt>
      <dd className="mt-1 text-sm font-semibold text-slate-800">{value}</dd>
    </div>
  );
}

function ConfirmReviewModal({
  confirm,
  acting,
  onConfirm,
  onCancel,
}: {
  confirm: { item: EndorsementHistoryItem; action: "APPROVE" | "REJECT" };
  acting: number | null;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const isApprove = confirm.action === "APPROVE";
  return (
    <GlobalModalRoot title={isApprove ? "Aprobar aval" : "Rechazar aval"}>
      <div className="w-full max-w-md rounded-3xl bg-white p-7 shadow-2xl">
        <div
          className={`mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full ${
            isApprove ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
          }`}
        >
          {isApprove ? <Check size={26} /> : <X size={26} />}
        </div>
        <h2 className="text-center text-lg font-bold text-slate-900">
          {isApprove ? "¿Aprobar este aval?" : "¿Rechazar este aval?"}
        </h2>
        <p className="mt-2 text-center text-sm text-slate-500">
          {isApprove ? (
            <>
              Confirmas que respaldas la postulación de{" "}
              <strong className="font-semibold text-slate-700">{label(confirm.item.applicantName)}</strong>.
            </>
          ) : (
            <>
              Indicas que no respaldas la postulación de{" "}
              <strong className="font-semibold text-slate-700">{label(confirm.item.applicantName)}</strong>. El
              postulante deberá registrar un nuevo aval.
            </>
          )}
        </p>
        <p className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-center text-xs text-slate-500">
          Esta acción no puede deshacerse.
        </p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={acting !== null}
            className="h-11 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-60"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={acting !== null}
            className={`h-11 rounded-xl text-sm font-semibold text-white transition disabled:opacity-60 ${
              isApprove ? "bg-emerald-600 hover:bg-emerald-700" : "bg-rose-600 hover:bg-rose-700"
            }`}
          >
            {acting !== null ? "Procesando..." : isApprove ? "Sí, aprobar" : "Sí, rechazar"}
          </button>
        </div>
      </div>
    </GlobalModalRoot>
  );
}
