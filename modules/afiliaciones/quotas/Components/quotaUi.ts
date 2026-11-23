import type { QuotaAccountingStatus, QuotaConcept, QuotaSyncItemStatus, QuotaSyncRunStatus } from "@prisma/client";
import type { QuotaFinancialStatus } from "../Models/QuotaAdmin";

export const QUOTA_CURRENCIES = ["S/", "US$"] as const;
export const QUOTA_CONCEPTS: Array<{ value: QuotaConcept; label: string }> = [
  { value: "CUOTA", label: "Cuotas" },
  { value: "INSCRIPCION", label: "Inscripciones" },
];

export function formatMoney(amount: string | null | undefined, currency: string): string {
  if (amount == null || amount === "") return "—";
  const value = Number(amount);
  if (!Number.isFinite(value)) return "—";
  const formatted = new Intl.NumberFormat("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
  return `${currency === "US$" ? "US$" : "S/"} ${formatted}`;
}

export function formatNumber(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("es-PE").format(value);
}

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric" });
}

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("es-PE", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function formatLimaDateTime(value: string | Date | null | undefined): string {
  if (!value) return "Sin sincronizaciones";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "Sin sincronizaciones";
  return new Intl.DateTimeFormat("es-PE", { timeZone: "America/Lima", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(date);
}

export function formatDuration(startedAt: string | Date, finishedAt: string | Date | null | undefined): string {
  if (!finishedAt) return "En curso";
  const start = new Date(startedAt).getTime();
  const end = new Date(finishedAt).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return "—";
  const seconds = Math.round((end - start) / 1000);
  return `${Math.floor(seconds / 60)}m ${String(seconds % 60).padStart(2, "0")}s`;
}

export function conceptLabel(concept: QuotaConcept): string {
  return concept === "CUOTA" ? "Cuota" : "Inscripción";
}

export function accountingStatusLabel(status: QuotaAccountingStatus): string {
  return status === "FACTURADO" ? "Facturado" : "Pendiente";
}

export function accountingStatusTone(status: QuotaAccountingStatus | string | null | undefined): string {
  if (status === "FACTURADO") return "border-blue-100 bg-blue-50 text-blue-700";
  if (status === "PENDIENTE") return "border-amber-100 bg-amber-50 text-amber-700";
  return "border-slate-200 bg-slate-50 text-slate-600";
}

export const CATEGORY_LABELS: Record<string, string> = {
  A: "Activo",
  E: "Estudiante",
  F: "Fallecido",
  H: "Honorario",
  R: "Renunciante",
  T: "Adherente",
  U: "Anulado",
  V: "Vitalicio",
  X: "Separado",
};

export const CATEGORY_STYLES: Record<string, string> = {
  A: "bg-emerald-50 text-emerald-700",
  E: "bg-amber-50 text-amber-700",
  F: "bg-slate-100 text-slate-600",
  H: "bg-indigo-50 text-indigo-700",
  R: "bg-rose-50 text-rose-700",
  T: "bg-sky-50 text-sky-700",
  U: "bg-zinc-100 text-zinc-600",
  V: "bg-teal-50 text-teal-700",
  X: "bg-orange-50 text-orange-700",
  DEFAULT: "bg-[#F7F3EC] text-[#7F561E]",
};

export function categoryStyle(code: string | null | undefined): string {
  return CATEGORY_STYLES[code?.toUpperCase() ?? ""] ?? CATEGORY_STYLES.DEFAULT;
}

export function categoryLabel(code: string | null | undefined, name?: string | null): string {
  if (name) return name;
  if (!code) return "Sin categoría";
  return CATEGORY_LABELS[code.toUpperCase()] ?? code;
}

export function membershipLabel(value: string | null | undefined): string {
  if (!value) return "Sin categoría";
  if (value === "ACTIVE") return "Activo";
  if (value === "STUDENT") return "Estudiante";
  return value;
}

export function financialStatusLabel(value: QuotaFinancialStatus | string | null | undefined): string {
  if (value === "WITH_INFO") return "Con información";
  if (value === "NO_INFO") return "Sin información";
  if (value === "NOT_FOUND") return "No encontrado en SIE";
  if (value === "FAILED") return "Con incidencia";
  if (value === "WITH_INCIDENCES") return "Con incidencia";
  return value ?? "Sin estado";
}

export function financialStatusTone(value: QuotaFinancialStatus | string | null | undefined): string {
  if (value === "WITH_INFO") return "border-emerald-100 bg-emerald-50 text-emerald-700";
  if (value === "NO_INFO") return "border-slate-200 bg-slate-50 text-slate-600";
  if (value === "NOT_FOUND") return "border-amber-100 bg-amber-50 text-amber-700";
  if (value === "FAILED" || value === "WITH_INCIDENCES") return "border-red-100 bg-red-50 text-red-700";
  return "border-slate-200 bg-slate-50 text-slate-600";
}

export function coverageLabel(value: QuotaSyncItemStatus | string | null | undefined): string {
  if (value === "SUCCEEDED") return "Sincronizado";
  if (value === "NO_DATA") return "Sin información";
  if (value === "NOT_FOUND") return "No encontrado";
  if (value === "FAILED") return "Error";
  if (value === "PENDING") return "Pendiente";
  if (value === "RUNNING") return "En proceso";
  return value ?? "—";
}

export function coverageTone(value: QuotaSyncItemStatus | string | null | undefined): string {
  if (value === "SUCCEEDED") return "border-emerald-100 bg-emerald-50 text-emerald-700";
  if (value === "NO_DATA") return "border-slate-200 bg-slate-50 text-slate-600";
  if (value === "NOT_FOUND") return "border-amber-100 bg-amber-50 text-amber-700";
  if (value === "FAILED") return "border-red-100 bg-red-50 text-red-700";
  return "border-slate-200 bg-slate-50 text-slate-600";
}

export function syncStatusLabel(value: QuotaSyncRunStatus | string | null | undefined): string {
  if (value === "SUCCEEDED") return "Completado";
  if (value === "PARTIAL") return "Parcial";
  if (value === "FAILED") return "Fallido";
  if (value === "RUNNING") return "En ejecución";
  if (value === "PENDING") return "Pendiente";
  return value ?? "—";
}

export function syncStatusTone(value: QuotaSyncRunStatus | string | null | undefined): string {
  if (value === "SUCCEEDED") return "border-emerald-100 bg-emerald-50 text-emerald-700";
  if (value === "PARTIAL") return "border-amber-100 bg-amber-50 text-amber-700";
  if (value === "FAILED") return "border-red-100 bg-red-50 text-red-700";
  if (value === "RUNNING") return "border-blue-100 bg-blue-50 text-blue-700";
  return "border-slate-200 bg-slate-50 text-slate-600";
}

export function scopeLabel(value: string | null | undefined): string {
  if (value === "FULL") return "Completa";
  if (value === "BATCH") return "Por lote";
  if (value === "PERSON") return "Individual";
  return value ?? "—";
}

export const ERROR_CODE_LABELS: Record<string, string> = {
  INVALID_YEAR: "Período inválido en el SIE",
  NOT_FOUND: "Asociado no encontrado en el SIE",
  NO_DATA: "Sin información financiera disponible",
  AMBIGUOUS_QUOTA_IDENTITY: "Identidad de cuota ambigua",
  SIE_INVALID_RESPONSE: "Información de origen inválida",
};

export function errorCodeLabel(code: string | null | undefined): string {
  if (!code) return "Sin incidencia";
  return ERROR_CODE_LABELS[code] ?? "Incidencia de sincronización";
}

export function isFutureYear(year: number, reference = new Date().getFullYear()): boolean {
  return year > reference;
}

/** Período anual de referencia usado por las cuotas de membresía (1 ene – 31 dic del año). */
export function annualQuotaPeriodLabel(year: number): string {
  return `${formatDate(`${year}-01-01`)} – ${formatDate(`${year}-12-31`)}`;
}

/**
 * Período a mostrar de una cuota. El SIE no envía fechas para cuotas pendientes;
 * para una próxima cuota (año futuro) se usa el período anual de referencia.
 */
export function quotaPeriodLabel(row: { year: number; accountingStatus: string; periodStart: string | null; periodEnd: string | null }): string {
  const derived = row.accountingStatus === "PENDIENTE" && isFutureYear(row.year);
  const start = row.periodStart ?? (derived ? `${row.year}-01-01` : null);
  const end = row.periodEnd ?? (derived ? `${row.year}-12-31` : null);
  if (start && end) return `${formatDate(start)} – ${formatDate(end)}`;
  return formatDate(start ?? end);
}

export function parseAmount(value: string | null | undefined): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export type QuotaTab = "resumen" | "asociados" | "historico" | "incidencias" | "sincronizaciones";
