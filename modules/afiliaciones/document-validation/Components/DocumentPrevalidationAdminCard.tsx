"use client";

import { AlertCircle, CheckCircle2, Clock3, HelpCircle, ShieldCheck, XCircle } from "lucide-react";
import { formatPeruDateTime } from "@/modules/shared/Utils/formatPeruDateTime";
import {
  DOCUMENT_TYPE_LABELS,
  RULE_STATUS_LABELS,
  type DocumentExtractionSummaryDTO,
  type RuleEvaluationDTO,
  type RuleStatus,
} from "../Models/DocumentPrevalidationDTO";

export interface DocumentPrevalidationAdminRecord {
  id: string;
  fileUrl: string;
  fileName: string;
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "TECHNICAL_ERROR";
  result: "PREVALIDATED" | "OBSERVED" | "NEEDS_REVIEW" | null;
  extraction: unknown;
  applicantContext?: unknown;
  rules: unknown;
  warnings: unknown;
  modelUsed: string | null;
  modelVersion: string | null;
  rulesVersion: string;
  promptVersion: string;
  extractionSchemaVersion: string;
  durationMs: number | null;
  cacheHit: boolean;
  errorCode: string | null;
  analyzedAt: string | null;
  createdAt: string;
}

const RESULT_STYLES = {
  PREVALIDATED: { label: "Prevalidado por IA", className: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: ShieldCheck },
  OBSERVED: { label: "Observado por IA", className: "bg-amber-50 text-amber-700 border-amber-200", icon: AlertCircle },
  NEEDS_REVIEW: { label: "Requiere revisión", className: "bg-sky-50 text-sky-700 border-sky-200", icon: HelpCircle },
} as const;

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

function asRules(value: unknown): RuleEvaluationDTO[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const record = item as Record<string, unknown>;
    if (typeof record.code !== "string" || typeof record.label !== "string" || typeof record.message !== "string") return [];
    const status = record.status;
    if (status !== "PASS" && status !== "FAIL" && status !== "UNKNOWN" && status !== "NOT_APPLICABLE") return [];
    return [{
      code: record.code as RuleEvaluationDTO["code"],
      label: record.label,
      status,
      message: record.message,
    }];
  });
}

function asWarnings(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function asApplicantContext(value: unknown): {
  universityName: string | null;
  careerName: string | null;
  declaredCycle: number | null;
} | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const cycle = Number(record.declaredCycle);
  return {
    universityName: typeof record.universityName === "string" ? record.universityName : null,
    careerName: typeof record.careerName === "string" ? record.careerName : null,
    declaredCycle: Number.isInteger(cycle) && cycle > 0 ? cycle : null,
  };
}

function asExtraction(value: unknown): DocumentExtractionSummaryDTO | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (typeof record.tipo_documento !== "string") return null;
  return {
    tipoDocumento: record.tipo_documento,
    universidad: typeof record.universidad === "string" ? record.universidad : null,
    carrera: typeof record.carrera === "string" ? record.carrera : null,
    cicloAcademico: typeof record.ciclo_academico === "string" ? record.ciclo_academico : null,
    periodoAcademico: typeof record.periodo_academico === "string" ? record.periodo_academico : null,
  };
}

function statusBadge(record: DocumentPrevalidationAdminRecord) {
  if (record.status === "TECHNICAL_ERROR") {
    return { label: "Error técnico", className: "bg-slate-100 text-slate-600 border-slate-200", icon: AlertCircle };
  }
  if (record.status === "PROCESSING") {
    return { label: "Procesando", className: "bg-slate-100 text-slate-600 border-slate-200", icon: Clock3 };
  }
  if (record.status === "PENDING") {
    return { label: "Pendiente", className: "bg-slate-100 text-slate-600 border-slate-200", icon: Clock3 };
  }
  if (record.result && RESULT_STYLES[record.result]) return RESULT_STYLES[record.result];
  return { label: "Sin resultado", className: "bg-slate-100 text-slate-600 border-slate-200", icon: AlertCircle };
}

export function DocumentPrevalidationAdminCard({ record }: { record: DocumentPrevalidationAdminRecord }) {
  const badge = statusBadge(record);
  const Icon = badge.icon;
  const extraction = asExtraction(record.extraction);
  const applicantContext = asApplicantContext(record.applicantContext);
  const rules = asRules(record.rules);
  const warnings = asWarnings(record.warnings);
  const analyzedAt = record.analyzedAt ?? record.createdAt;

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Resultado de IA</p>
          <h4 className="mt-1 truncate text-sm font-black text-slate-800" title={record.fileName}>
            {record.fileName || "Constancia de estudios"}
          </h4>
          <p className="mt-0.5 text-[11px] text-slate-400">
            Analizado: {analyzedAt ? formatPeruDateTime(analyzedAt) : "No disponible"}
            {typeof record.durationMs === "number" ? ` · ${(record.durationMs / 1000).toFixed(1)} s` : ""}
            {record.cacheHit ? " · extracción reutilizada" : ""}
          </p>
        </div>
        <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${badge.className}`}>
          <Icon size={13} aria-hidden="true" />
          {badge.label}
        </span>
      </div>

      {record.status === "TECHNICAL_ERROR" ? (
        <p className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs leading-relaxed text-slate-600">
          No fue posible completar la revisión automática. El expediente continúa con la revisión administrativa habitual.
          {record.errorCode ? <span className="mt-1 block text-[10px] font-mono text-slate-400">Código: {record.errorCode}</span> : null}
        </p>
      ) : null}

      {extraction ? (
        <dl className="mt-3 grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
          <div className="rounded-lg bg-slate-50 px-2.5 py-1.5">
            <dt className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Tipo detectado</dt>
            <dd className="font-semibold text-slate-700">{DOCUMENT_TYPE_LABELS[extraction.tipoDocumento] ?? extraction.tipoDocumento}</dd>
          </div>
          {extraction.universidad ? (
            <div className="rounded-lg bg-slate-50 px-2.5 py-1.5">
              <dt className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Universidad</dt>
              <dd className="font-semibold text-slate-700">{extraction.universidad}</dd>
            </div>
          ) : null}
          {extraction.carrera ? (
            <div className="rounded-lg bg-slate-50 px-2.5 py-1.5">
              <dt className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Carrera</dt>
              <dd className="font-semibold text-slate-700">{extraction.carrera}</dd>
            </div>
          ) : null}
          <div className="rounded-lg bg-slate-50 px-2.5 py-1.5">
            <dt className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Ciclo / periodo</dt>
            <dd className="font-semibold text-slate-700">
              {extraction.cicloAcademico ?? "No identificado"} / {extraction.periodoAcademico ?? "No identificado"}
            </dd>
          </div>
        </dl>
      ) : null}

      {applicantContext && (applicantContext.careerName || applicantContext.declaredCycle !== null) ? (
        <p className="mt-2 rounded-lg bg-white px-2.5 py-1.5 text-[10px] text-slate-500">
          <span className="font-bold uppercase tracking-wide text-slate-400">Contexto comparado:</span>{" "}
          {applicantContext.careerName ?? "carrera no registrada"}
          {applicantContext.declaredCycle !== null ? ` · ciclo declarado ${applicantContext.declaredCycle}` : ""}
        </p>
      ) : null}

      {rules.length > 0 ? (
        <ul className="mt-3 space-y-1.5" aria-label="Reglas de prevalidación">
          {rules.map((rule) => {
            const RuleIcon = RULE_ICONS[rule.status];
            return (
              <li key={rule.code} className="flex items-start gap-2 rounded-lg bg-slate-50 px-2.5 py-1.5">
                <RuleIcon size={15} strokeWidth={2} className={`mt-0.5 shrink-0 ${RULE_COLORS[rule.status]}`} aria-hidden="true" />
                <div className="min-w-0">
                  <p className="text-[11px] font-bold text-slate-700">
                    <span className="text-slate-400">{rule.code}</span> {rule.label}
                    <span className="ml-1.5 font-semibold text-slate-500">· {RULE_STATUS_LABELS[rule.status]}</span>
                  </p>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500">{rule.message}</p>
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}

      {warnings.length > 0 ? (
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50/60 p-2.5">
          <p className="text-[10px] font-black uppercase tracking-wide text-amber-700">Advertencias del análisis</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-4 text-[11px] text-slate-600">
            {warnings.slice(0, 8).map((warning) => <li key={warning}>{warning}</li>)}
          </ul>
        </div>
      ) : null}

      <p className="mt-3 text-[10px] font-mono text-slate-400">
        Modelo: {record.modelUsed ?? "No disponible"}
        {record.modelVersion ? ` (${record.modelVersion})` : ""} · Reglas v{record.rulesVersion} · Prompt v{record.promptVersion}
      </p>
      <p className="mt-1 border-t border-slate-100 pt-2.5 text-[10px] leading-relaxed text-slate-400">
        El resultado de IA es una prevalidación documental y no certifica la autenticidad del documento. La decisión final corresponde al Área de Asociados.
      </p>
    </article>
  );
}
