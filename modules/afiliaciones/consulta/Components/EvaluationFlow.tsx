"use client";

import React, { Fragment } from "react";
import { Check, Users, Building2, Truck, Landmark, CreditCard } from "lucide-react";
import type { ApplicationStatusData, AreaStatusType } from "../Models/ApplicationStatus";
import {
  areaStatusLabel,
  areaStatusTone,
  deriveEvaluationFlow,
  formatRegistrationDate,
  type EvaluationFlowState,
  type ParallelReview,
  type StageState,
} from "../Models/EvaluationFlow";

const AREA_ICONS: Record<ParallelReview["key"], React.ComponentType<{ size?: number | string; strokeWidth?: number | string; className?: string }>> = {
  sponsors: Users,
  associates: Building2,
  logistics: Truck,
};

const STAGE_ICONS = {
  board: Landmark,
  payment: CreditCard,
};

function StatusBadge({ status }: { status: AreaStatusType }) {
  const tone = areaStatusTone(status);
  const styles: Record<string, string> = {
    success: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    warning: "bg-amber-50 text-amber-700 ring-amber-200",
    danger: "bg-rose-50 text-rose-700 ring-rose-200",
    neutral: "bg-slate-100 text-slate-500 ring-slate-200",
  };
  const dot: Record<string, string> = {
    success: "bg-emerald-500",
    warning: "bg-amber-500",
    danger: "bg-rose-500",
    neutral: "bg-slate-400",
  };
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-bold ring-1 ${styles[tone]}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${dot[tone]}`} aria-hidden="true" />
      {areaStatusLabel(status)}
    </span>
  );
}

function StageMark({ state }: { state: StageState }) {
  if (state === "completed") {
    return <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 text-emerald-600"><Check size={12} strokeWidth={3} /></span>;
  }
  if (state === "active") {
    return <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#C5A059] text-white text-[11px] font-black">●</span>;
  }
  return <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-200 text-slate-400" />;
}

function AreaCard({ review }: { review: ParallelReview }) {
  const Icon = AREA_ICONS[review.key];
  return (
    <div className="flex flex-col gap-2.5 rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-center gap-2.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
          <Icon size={16} strokeWidth={1.8} />
        </span>
        <span className="text-sm font-bold text-slate-700">{review.label}</span>
      </div>
      <div className="flex items-center gap-2">
        <StatusBadge status={review.status} />
      </div>
      {review.subtext ? <p className="text-[11px] font-medium text-slate-400">{review.subtext}</p> : null}
    </div>
  );
}

function SingleStageCard({ icon, label, status }: { icon: "board" | "payment"; label: string; status: AreaStatusType }) {
  const Icon = STAGE_ICONS[icon];
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-center gap-2.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
          <Icon size={16} strokeWidth={1.8} />
        </span>
        <span className="text-sm font-bold text-slate-700">{label}</span>
      </div>
      <StatusBadge status={status} />
    </div>
  );
}

const STAGE_META: Array<{ num: number; title: string; stateKey: keyof Pick<EvaluationFlowState, "stage1" | "stage2" | "stage3"> }> = [
  { num: 1, title: "Revisión en paralelo", stateKey: "stage1" },
  { num: 2, title: "Directorio / Comité", stateKey: "stage2" },
  { num: 3, title: "Pago de Incorporación", stateKey: "stage3" },
];

function Timeline({ flow }: { flow: EvaluationFlowState }) {
  return (
    <div className="hidden sm:flex items-start justify-between gap-2">
      {STAGE_META.map((step, index) => {
        const state = flow[step.stateKey];
        const isActive = state === "active";
        const isDone = state === "completed";
        return (
          <Fragment key={step.num}>
            <div className={`flex flex-col items-center gap-1.5 flex-1 ${isActive ? "" : "opacity-90"}`}>
              <div className={`flex w-full items-center ${index === 0 ? "" : ""}`}>
                <div className={`h-px flex-1 ${index === 0 ? "bg-transparent" : isDone ? "bg-emerald-200" : "bg-slate-200"}`} />
                <StageMark state={state} />
                <div className={`h-px flex-1 ${index === STAGE_META.length - 1 ? "bg-transparent" : isDone ? "bg-emerald-200" : "bg-slate-200"}`} />
              </div>
              <span className={`text-center text-[11px] font-black uppercase tracking-wide leading-tight ${isActive ? "text-[#C5A059]" : isDone ? "text-slate-600" : "text-slate-400"}`}>
                {step.num}. {step.title}
              </span>
            </div>
          </Fragment>
        );
      })}
    </div>
  );
}

function StageSection({ num, title, description, state, children }: { num: number; title: string; description: string; state: StageState; children: React.ReactNode }) {
  const ring = state === "active" ? "border-[#C5A059]/40" : state === "completed" ? "border-emerald-200/60" : "border-slate-200";
  return (
    <section className={`rounded-2xl border ${ring} bg-white/70 p-4 sm:p-5`}>
      <div className="mb-3 flex items-start gap-3">
        <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-800 text-[11px] font-black text-white">{num}</span>
        <div>
          <h3 className="text-sm font-black text-slate-800">{title}</h3>
          <p className="text-xs text-slate-500">{description}</p>
        </div>
        {state === "active" && <span className="ml-auto rounded-full bg-[#C5A059]/10 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wide text-[#a3722a]">En curso</span>}
      </div>
      {children}
    </section>
  );
}

interface EvaluationFlowProps {
  data: ApplicationStatusData;
}

export function EvaluationFlow({ data }: EvaluationFlowProps) {
  const flow = deriveEvaluationFlow(data);
  const areas = (data.areas ?? {}) as ApplicationStatusData["areas"];
  const boardStatus = (areas.board?.status ?? "PENDING") as AreaStatusType;
  const paymentStatus = (areas.payment?.status ?? "PENDING") as AreaStatusType;

  return (
    <div className="space-y-4">
      {/* Cabecera compacta del expediente */}
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3 border-b border-slate-100 pb-5">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">N° de Expediente</p>
          <p className="font-mono text-base font-extrabold tracking-wide text-slate-800">{data.applicationCode}</p>
        </div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Tipo de solicitud</p>
          <p className="text-sm font-bold text-slate-700">{flow.affiliateLabel}</p>
        </div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Fecha de registro</p>
          <p className="text-sm font-bold text-slate-700">{formatRegistrationDate(data.submissionDate)}</p>
        </div>
      </div>

      {/* Confirmación discreta de recepción */}
      {data.status === "PENDING" && (
        <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
          <Check size={16} className="text-emerald-500" aria-hidden="true" />
          Solicitud recibida correctamente
        </div>
      )}

      {/* Proceso de evaluación */}
      <div>
        <h2 className="mb-4 text-sm font-black uppercase tracking-wide text-slate-700">Proceso de evaluación</h2>
        <Timeline flow={flow} />
      </div>

      <div className="space-y-4">
        <StageSection num={1} title="Revisión en paralelo" description="Estas revisiones avanzan de forma independiente." state={flow.stage1}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {flow.parallelReviews.map((review) => (
              <AreaCard key={review.key} review={review} />
            ))}
          </div>
        </StageSection>

        <StageSection num={2} title="Directorio / Comité" description="Revisión final tras la aprobación de las áreas previas." state={flow.stage2}>
          <SingleStageCard icon="board" label="Directorio / Comité" status={boardStatus} />
        </StageSection>

        <StageSection num={3} title="Pago de Incorporación" description="Verificación del pago y habilitación." state={flow.stage3}>
          <SingleStageCard icon="payment" label="Pago de Incorporación" status={paymentStatus} />
        </StageSection>
      </div>

      {/* Nota informativa discreta */}
      <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-xs leading-relaxed text-slate-500">
        Te notificaremos por correo electrónico cada vez que tu postulación avance de etapa.
        También puedes ingresar a esta sección para consultar el estado actualizado de tu expediente.
      </div>
    </div>
  );
}
