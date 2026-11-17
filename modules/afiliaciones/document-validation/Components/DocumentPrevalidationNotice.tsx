"use client";

import {
  AlertCircle,
  CheckCircle2,
  FileWarning,
  HelpCircle,
  Loader2,
  RefreshCw,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import {
  DOCUMENT_TYPE_LABELS,
  RULE_STATUS_LABELS,
  type DocumentExtractionSummaryDTO,
  type PrevalidationUiStatus,
  type RuleEvaluationDTO,
  type RuleStatus,
} from "../Models/DocumentPrevalidationDTO";

interface DocumentPrevalidationNoticeProps {
  state: PrevalidationUiStatus;
  message?: string;
  rules?: RuleEvaluationDTO[];
  warnings?: string[];
  extraction?: DocumentExtractionSummaryDTO | null;
  durationMs?: number;
  onReplace?: () => void;
}

const STATUS_STYLES: Readonly<Record<PrevalidationUiStatus, {
  container: string;
  icon: typeof CheckCircle2;
  iconClass: string;
  title: string;
  badgeLabel: string;
  badgeClass: string;
  defaultMessage: string;
  live: "polite" | "assertive";
  role: "status" | "alert";
}>> = {
  PROCESSING: {
    container: "border-sky-200 bg-sky-50/80",
    icon: Loader2,
    iconClass: "animate-spin text-sky-600",
    title: "Analizando tu constancia de estudios",
    badgeLabel: "Analizando",
    badgeClass: "border-sky-300 bg-white text-sky-700",
    defaultMessage: "Esto puede tomar unos segundos. No cierres esta pantalla.",
    live: "polite",
    role: "status",
  },
  PREVALIDATED: {
    container: "border-emerald-200 bg-emerald-50/80",
    icon: ShieldCheck,
    iconClass: "text-emerald-600",
    title: "¡Constancia válida!",
    badgeLabel: "Válida",
    badgeClass: "border-emerald-300 bg-white text-emerald-700",
    defaultMessage: "El documento cumple con los requisitos verificados automáticamente.",
    live: "assertive",
    role: "alert",
  },
  OBSERVED: {
    container: "border-red-300 bg-red-50/90",
    icon: FileWarning,
    iconClass: "text-red-600",
    title: "Constancia observada",
    badgeLabel: "Observada",
    badgeClass: "border-red-300 bg-white text-red-700",
    defaultMessage: "Revisa el detalle y adjunta una constancia corregida.",
    live: "assertive",
    role: "alert",
  },
  NEEDS_REVIEW: {
    container: "border-red-300 bg-red-50/90",
    icon: HelpCircle,
    iconClass: "text-red-600",
    title: "Constancia en revisión",
    badgeLabel: "Por revisar",
    badgeClass: "border-red-300 bg-white text-red-700",
    defaultMessage: "El Área de Asociados revisará tu documento.",
    live: "assertive",
    role: "alert",
  },
  TECHNICAL_ERROR: {
    container: "border-red-200 bg-red-50/70",
    icon: AlertCircle,
    iconClass: "text-red-500",
    title: "No pudimos analizar la constancia",
    badgeLabel: "Sin análisis",
    badgeClass: "border-red-200 bg-white text-red-600",
    defaultMessage: "Puedes continuar; el Área de Asociados revisará tu documento.",
    live: "assertive",
    role: "alert",
  },
};

const RULE_ICONS: Readonly<Record<RuleStatus, typeof CheckCircle2>> = {
  PASS: CheckCircle2,
  FAIL: XCircle,
  UNKNOWN: HelpCircle,
  NOT_APPLICABLE: HelpCircle,
};

const RULE_COLORS: Readonly<Record<RuleStatus, string>> = {
  PASS: "text-emerald-600",
  FAIL: "text-red-500",
  UNKNOWN: "text-amber-500",
  NOT_APPLICABLE: "text-slate-400",
};

function extractionItems(extraction: DocumentExtractionSummaryDTO | null | undefined): Array<[string, string]> {
  if (!extraction) return [];
  const items: Array<[string, string]> = [];
  items.push(["Tipo", DOCUMENT_TYPE_LABELS[extraction.tipoDocumento] ?? "Documento"]);
  if (extraction.universidad) items.push(["Universidad", extraction.universidad]);
  if (extraction.carrera) items.push(["Carrera", extraction.carrera]);
  if (extraction.cicloAcademico) items.push(["Ciclo", extraction.cicloAcademico]);
  if (extraction.periodoAcademico) items.push(["Periodo", extraction.periodoAcademico]);
  return items;
}

export function DocumentPrevalidationNotice({
  state,
  message,
  rules = [],
  warnings = [],
  extraction,
  durationMs,
  onReplace,
}: DocumentPrevalidationNoticeProps) {
  const style = STATUS_STYLES[state];
  const Icon = style.icon;
  const isErrorState =
    state === "OBSERVED" || state === "NEEDS_REVIEW" || state === "TECHNICAL_ERROR";
  const items = isErrorState ? [] : extractionItems(extraction);
  const showRules = state === "PREVALIDATED" && rules.length > 0;
  const showWarnings = state === "PREVALIDATED" && warnings.length > 0;
  const errorSupplement =
    state === "NEEDS_REVIEW"
      ? warnings
          .slice(0, 2)
          .map((warning) => warning.trim())
          .filter(Boolean)
          .join(" ")
      : "";
  const description = [message ?? style.defaultMessage, errorSupplement]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      role={style.role}
      aria-live={style.live}
      aria-busy={state === "PROCESSING"}
      className={`mt-4 rounded-2xl border p-4 sm:p-5 ${style.container}`}
    >
      <div className="flex items-start gap-3">
        <Icon size={22} strokeWidth={2} className={`mt-0.5 shrink-0 ${style.iconClass}`} aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${style.badgeClass}`}>
              {style.badgeLabel}
            </span>
            <p className="text-sm font-black text-slate-800">{style.title}</p>
          </div>
          <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
            {description}
          </p>

          {state === "PROCESSING" && (
            <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/80" aria-hidden="true">
              <div className="h-full w-2/3 animate-pulse rounded-full bg-sky-400" />
            </div>
          )}

          {items.length > 0 && (
            <dl className="mt-3 grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
              {items.map(([label, value]) => (
                <div key={label} className="flex min-w-0 items-baseline gap-1.5 rounded-lg bg-white/70 px-2.5 py-1.5">
                  <dt className="shrink-0 font-bold uppercase tracking-wide text-slate-400">{label}</dt>
                  <dd className="min-w-0 truncate font-semibold text-slate-700" title={value}>{value}</dd>
                </div>
              ))}
            </dl>
          )}

          {showRules && (
            <ul className="mt-3 space-y-1.5" aria-label="Resultado por requisito">
              {rules.map((rule) => {
                const RuleIcon = RULE_ICONS[rule.status];
                return (
                  <li key={rule.code} className="flex items-start gap-2 rounded-lg bg-white/70 px-2.5 py-2">
                    <RuleIcon size={16} strokeWidth={2} className={`mt-0.5 shrink-0 ${RULE_COLORS[rule.status]}`} aria-hidden="true" />
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-700">
                        <span className="text-slate-400">{rule.code}</span> {rule.label}
                        <span className="ml-1.5 font-semibold text-slate-500">· {RULE_STATUS_LABELS[rule.status]}</span>
                      </p>
                      <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{rule.message}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {showWarnings && (
            <div className="mt-3 rounded-lg border border-amber-200 bg-white/70 p-2.5">
              <p className="text-[11px] font-black uppercase tracking-wide text-amber-700">Datos por verificar</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs text-slate-600">
                {warnings.slice(0, 6).map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-3">
            {onReplace && state !== "PROCESSING" && (
              <button
                type="button"
                onClick={onReplace}
                className="inline-flex items-center gap-2 rounded-xl border border-[#C5A059] bg-white px-3 py-2 text-xs font-bold text-[#8b6a2b] outline-none transition hover:bg-[#C5A059]/10 focus-visible:ring-2 focus-visible:ring-[#C5A059]/40"
              >
                <RefreshCw size={14} aria-hidden="true" />
                Reemplazar documento
              </button>
            )}
            {typeof durationMs === "number" && durationMs > 0 && state === "PREVALIDATED" && (
              <span className="text-[11px] font-medium text-slate-400">
                Revisión automática completada.
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
