"use client";

import { AlertCircle, Database, ExternalLink, RefreshCw } from "lucide-react";
import type { AssociateSieProfileViewState } from "./AssociateSieProfileSection";
import { sortSieQuotas } from "./AssociateSieProfileSection";
import type { AssociateSieProfileResponse } from "../Services/AssociateSieProfileService";
import { formatCalendarDate, formatPeruDateTime } from "@/modules/shared/Utils/formatPeruDateTime";

type RegisteredQuota = Extract<AssociateSieProfileResponse, { registered: true }>["quotas"][number];

export type MembershipSieQuotaSummaryData = {
  invoicedCount: number;
  pendingCount: number;
  pendingAmounts: Array<{ currency: "S/" | "US$"; amount: number }>;
  latestPeriod: RegisteredQuota | null;
  latestInvoicedPeriod: RegisteredQuota | null;
};

export function summarizeMembershipSieQuotas(quotas: RegisteredQuota[]): MembershipSieQuotaSummaryData {
  const membershipQuotas = quotas.filter((quota) => quota.concepto === "CUOTA");
  const invoiced = membershipQuotas.filter((quota) => quota.estadoContable === "Facturado");
  const pending = membershipQuotas.filter((quota) => quota.estadoContable === "Pendiente");
  const amounts = new Map<"S/" | "US$", number>();

  for (const quota of pending) amounts.set(quota.moneda, (amounts.get(quota.moneda) ?? 0) + quota.monto);

  return {
    invoicedCount: invoiced.length,
    pendingCount: pending.length,
    pendingAmounts: (["S/", "US$"] as const).flatMap((currency) => {
      const amount = amounts.get(currency);
      return amount === undefined ? [] : [{ currency, amount }];
    }),
    latestPeriod: sortSieQuotas(membershipQuotas)[0] ?? null,
    latestInvoicedPeriod: sortSieQuotas(invoiced)[0] ?? null,
  };
}

const date = (value: string) => value ? formatCalendarDate(value) : "—";
const amount = (value: number, currency: "S/" | "US$") => `${currency} ${new Intl.NumberFormat("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)}`;

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-slate-100 bg-slate-50 p-4"><p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{label}</p><p className="mt-1 text-sm font-black text-slate-800">{value}</p></div>;
}

function DetailButton({ onViewDetails }: { onViewDetails: () => void }) {
  return <button type="button" onClick={onViewDetails} className="inline-flex items-center gap-1.5 rounded-xl border border-[#E6C982] px-3 py-2 text-xs font-bold text-[#936B2E] hover:bg-[#FFF8E8]"><ExternalLink size={14}/>Ver detalle en SIE</button>;
}

export function MembershipSieQuotaSummary({ state, canReadMemberships, onRetry, onViewDetails }: { state: AssociateSieProfileViewState; canReadMemberships: boolean; onRetry: () => void; onViewDetails: () => void }) {
  if (!canReadMemberships || state.kind === "forbidden") return <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex gap-3"><AlertCircle className="mt-0.5 shrink-0 text-slate-400" size={20}/><div><h2 className="font-black text-slate-800">Cuotas SIE</h2><p className="mt-1 text-sm leading-6 text-slate-500">Sin permiso para consultar cuotas en SIE.</p></div></div></section>;
  if (state.kind === "unauthenticated") return <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex gap-3"><AlertCircle className="mt-0.5 shrink-0 text-slate-400" size={20}/><div><h2 className="font-black text-slate-800">Sesión expirada</h2><p className="mt-1 text-sm leading-6 text-slate-500">Inicia sesión nuevamente para consultar cuotas en SIE.</p></div></div></section>;
  if (state.kind === "idle") return <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="font-black text-slate-800">Cuotas SIE</h2><p className="mt-1 text-sm leading-6 text-slate-500">La información de cuotas aún no fue consultada.</p></section>;
  if (state.kind === "loading") return <section className="animate-pulse rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="h-4 w-32 rounded bg-slate-200"/><p className="mt-4 text-sm text-slate-500">Consultando cuotas en SIE…</p></section>;
  if (state.kind === "error") return <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5"><div className="flex gap-3"><AlertCircle className="mt-0.5 shrink-0 text-amber-600" size={20}/><div><h2 className="font-black text-amber-900">Cuotas SIE no disponibles</h2><p className="mt-1 text-sm leading-6 text-amber-800">{state.message}</p>{state.retryable && <button type="button" onClick={onRetry} className="mt-3 inline-flex items-center gap-1.5 rounded-xl border border-amber-300 px-3 py-2 text-xs font-bold text-amber-800 hover:bg-amber-100"><RefreshCw size={14}/>Reintentar</button>}</div></div></section>;
  if (!state.data.registered) return <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex gap-3"><Database className="mt-0.5 shrink-0 text-slate-400" size={20}/><div><h2 className="font-black text-slate-800">Cuotas SIE</h2><p className="mt-1 text-sm leading-6 text-slate-500">El asociado no está registrado en SIE.</p><p className="mt-2 text-xs text-slate-400">Última consulta: {formatPeruDateTime(state.data.checkedAt)}</p><DetailButton onViewDetails={onViewDetails}/></div></div></section>;

  const summary = summarizeMembershipSieQuotas(state.data.quotas);
  const latestPeriod = summary.latestPeriod;
  const latestInvoiced = summary.latestInvoicedPeriod;
  return <section className="rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-slate-50 px-5 py-4"><div><h2 className="text-sm font-black uppercase tracking-wide text-slate-800">Resumen de cuotas SIE</h2><p className="mt-0.5 text-xs font-medium text-slate-500">Consulta informativa; no modifica pagos ni estado institucional.</p></div><DetailButton onViewDetails={onViewDetails}/></div><div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4"><Metric label="Cuotas facturadas" value={String(summary.invoicedCount)}/><Metric label="Cuotas pendientes" value={String(summary.pendingCount)}/><Metric label="Último período registrado" value={latestPeriod ? (latestPeriod.fechaInicio && latestPeriod.fechaFin ? `${date(latestPeriod.fechaInicio)} — ${date(latestPeriod.fechaFin)}` : String(latestPeriod.anno)) : "No disponible"}/><Metric label="Fin del último período facturado" value={latestInvoiced?.fechaFin ? date(latestInvoiced.fechaFin) : "No disponible"}/></div>{summary.pendingAmounts.length > 0 && <div className="border-t border-slate-100 px-5 py-4"><p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Monto pendiente informado por SIE</p><div className="mt-2 flex flex-wrap gap-2">{summary.pendingAmounts.map((item) => <span key={item.currency} className="rounded-full bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-800">{item.currency}: {amount(item.amount, item.currency)}</span>)}</div></div>}<p className="border-t border-slate-100 px-5 py-3 text-xs text-slate-400">Última consulta SIE: {formatPeruDateTime(state.data.checkedAt)}</p></section>;
}
