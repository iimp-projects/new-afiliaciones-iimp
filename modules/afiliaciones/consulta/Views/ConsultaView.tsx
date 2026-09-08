"use client";
import React, { useEffect, useState } from "react";
import { X } from "lucide-react";

import { ExistingApplicationGate } from "@/modules/afiliaciones/postulacion/Components/ExistingApplicationGate";
import { ApplicationStateNotice } from "@/modules/afiliaciones/postulacion/Components/ApplicationStateNotice";
import { ProcessLoadingOverlay } from "@/modules/shared/Components/ProcessLoadingOverlay";

import { ConsultaHero } from "../Components/ConsultaHero";
import { ConsultaHeader } from "../Components/ConsultaHeader";
import { ConsultationForm } from "../Components/ConsultationForm";
import { StatusInReview } from "../Components/StatusInReview";
import { StatusObserved } from "../Components/StatusObserved";

import { StatusRejected } from "../Components/StatusRejected";
import { StatusPaymentReady } from "../Components/StatusPaymentReady"; // <-- IMPORTACIÓN
import { useConsulta } from "../Hooks/useConsulta";
import { StatusCompleted } from "../Components/StatusCompleted";
import { PaymentLoadingOverlay } from "@/modules/afiliaciones/payments/Components/PaymentLoadingOverlay";
import type { ApplicationStatusData } from "../Models/ApplicationStatus";
import type { BillingDataInput } from "@/modules/afiliaciones/payments/DTOs/billing.schema";

type RestoreState = "IDLE" | "RESTORING_PAYMENT" | "RESTORED" | "RESTORE_FAILED";
type RestorePayload = {
  application: ApplicationStatusData;
  billingData?: BillingDataInput | null;
  payment?: { id: number; status: "PAID" | "FAILED" | "PENDING"; amount: number; currency: "PEN"; paymentDate?: string; transactionId?: string; authorizationCode?: string; cardBrand?: string; cardType?: string; maskedCard?: string; traceNumber?: string };
  failure?: { message?: string; code?: string } | null;
};

const restoreRequests = new Map<string, Promise<RestorePayload | null>>();

function restorePayment(reference: string): Promise<RestorePayload | null> {
  const existingRequest = restoreRequests.get(reference);
  if (existingRequest) return existingRequest;

  const request = fetch(`/api/payments/restore?payment_callback=${encodeURIComponent(reference)}`, { credentials: "include" })
    .then(async (response) => response.ok ? response.json() as Promise<RestorePayload> : null);

  restoreRequests.set(reference, request);
  return request;
}

interface ConsultaViewProps {
  initialPaymentCallback?: string;
}

export function ConsultaView({ initialPaymentCallback }: ConsultaViewProps) {
  const { loading, statusData, setStatusData, handleConsult, handleRefresh, currentStatus, challenge, setChallenge, error, loadApplication, notice } = useConsulta();
  const [authorizedGate, setAuthorizedGate] = useState(false);
  const [showObservations, setShowObservations] = useState(false);
  useEffect(() => { if (!initialPaymentCallback && new URLSearchParams(window.location.search).has("applicationId")) setAuthorizedGate(true); }, [initialPaymentCallback]);
  const [restored, setRestored] = useState<RestorePayload | null>(null);
  const [restoreState, setRestoreState] = useState<RestoreState>(initialPaymentCallback ? "RESTORING_PAYMENT" : "IDLE");

  useEffect(() => {
    if (!initialPaymentCallback || restoreState !== "RESTORING_PAYMENT") return;
    let active = true;

    void restorePayment(initialPaymentCallback)
      .then((payload) => {
        if (!active) return;
        if (!payload) {
          setRestoreState("RESTORE_FAILED");
          return;
        }
        setStatusData(payload.application);
        setRestored(payload);
        setRestoreState("RESTORED");
      })
      .catch(() => { if (active) setRestoreState("RESTORE_FAILED"); });
    return () => { active = false; };
  }, [initialPaymentCallback, restoreState, setStatusData]);

  // ESTADO 1: INGRESO DE DATOS (Pantalla dividida)
  if (restoreState === "RESTORING_PAYMENT") {
    return <PaymentLoadingOverlay title="Confirmando tu pago..." description="Estamos verificando la información de tu afiliación." secondaryText="Por favor, espera unos segundos." />;
  }

  if (restoreState === "RESTORE_FAILED") {
    return <main className="grid min-h-screen place-items-center bg-slate-50 px-4"><div className="max-w-md text-center"><h1 className="font-bold text-slate-800">No pudimos recuperar el pago</h1><p className="mt-2 text-sm text-slate-600">La referencia no es válida o ya expiró. Vuelve a consultar tu solicitud.</p></div></main>;
  }

  if (!statusData) {
    return (
      <main className="flex flex-col md:flex-row h-screen w-full overflow-hidden bg-surface font-sans antialiased animate-in fade-in duration-500">
        <ConsultaHero />
        <ProcessLoadingOverlay open={loading} title="Preparando consulta..." description="Estamos procesando tu solicitud de forma segura." />
        {(challenge || authorizedGate) && <ExistingApplicationGate challenge={challenge || undefined} authorized={authorizedGate} context="CONSULTA" onClose={() => { setChallenge(null); setAuthorizedGate(false); }} onQuery={async (application) => { await loadApplication(application); setAuthorizedGate(false); setShowObservations(false); }} />}
        <section className="w-full md:w-[45%] h-full flex flex-col relative overflow-hidden bg-surface-container-lowest overflow-y-auto scrollbar-thin scrollbar-thumb-outline-variant">
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary-container/20 rounded-full blur-3xl pointer-events-none -translate-y-1/2 translate-x-1/4"></div>
          <div className="w-full max-w-[420px] px-6 py-10 mx-auto my-auto relative z-10">
            <ConsultaHeader />
            <ConsultationForm onSubmit={handleConsult} loading={loading} />
            {!challenge && error && <p role="alert" className="mt-4 text-sm text-red-600">{error}</p>}
          </div>
        </section>
      </main>
    );
  }

  if (notice.action === "DRAFT_RECOVERY" || notice.action === "UNKNOWN") {
    return <main className="min-h-screen grid place-items-center bg-slate-50 p-6"><ApplicationStateNotice status={currentStatus || "UNKNOWN"} context="CONSULTA" onPrimary={statusData.recoveryUrl ? () => { window.location.href = statusData.recoveryUrl!; } : undefined} onClose={() => setStatusData(null)} /></main>;
  }
  if (notice.action === "COMPLETED") {
    return <StatusCompleted data={statusData} onFinish={() => setStatusData(null)} />;
  }
  if (notice.action === "CONTINUE_PAYMENT" || Boolean(restored)) {
    return <StatusPaymentReady data={statusData} onCancel={() => setStatusData(null)} initialBillingData={restored?.billingData} restoredPayment={restored?.payment} failureMessage={restored?.failure?.message} failureCode={restored?.failure?.code} />;
  }

  // ESTADO 3: RESULTADOS NORMALES (En evaluación, Observado, Rechazado)
  return (
    <div className="w-full min-h-screen bg-[#F7F8FA] relative font-sans antialiased flex flex-col animate-in fade-in duration-500">
      <div className="absolute top-0 left-0 w-full h-[45vh] bg-gradient-to-br from-[#2a1700] via-[#C5A059]/95 to-[#4a2d00] z-0 overflow-hidden">
        <div className="absolute inset-0 z-0 opacity-20 mix-blend-overlay bg-cover bg-center" style={{ backgroundImage: "url('/images/minero.jpg')" }}></div>
        <div className="absolute bottom-0 left-0 w-full h-24 bg-gradient-to-t from-[#F7F8FA] to-transparent z-10"></div>
      </div>

      <div className="relative z-20 flex flex-col flex-1">
        <nav className="w-full px-6 py-6 flex justify-between items-center max-w-5xl mx-auto">
          <img src="/images/logo-iimp.png" alt="IIMP Logo" className="h-12 w-auto brightness-0 invert drop-shadow-md" />
        </nav>

        <div className="text-center pt-2 pb-8 px-4">
          <span className="inline-block px-4 py-1.5 rounded-full bg-white/10 text-white text-xs font-bold uppercase tracking-widest mb-3 border border-white/20 backdrop-blur-md shadow-sm">
            Portal Oficial de Afiliaciones
          </span>
          <h1 className="text-3xl md:text-5xl font-black text-white tracking-tight mb-3 drop-shadow-md">
            Estado de tu Expediente
          </h1>
          <p className="text-base text-white/90 font-medium max-w-xl mx-auto leading-relaxed drop-shadow-sm">
            A continuación, te mostramos el detalle y progreso de las evaluaciones correspondientes a tu solicitud.
          </p>
        </div>

        <main className="flex-1 w-full max-w-3xl mx-auto px-4 sm:px-6 pb-20">
          <div className="bg-white rounded-[32px] border border-gray-200 shadow-2xl p-6 sm:p-10 animate-in fade-in slide-in-from-bottom-8 duration-700">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 pb-6 border-b border-slate-100">
              <div>
                <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">N° de Expediente</h2>
                <p className="text-lg font-extrabold text-[#C5A059] font-mono tracking-wider">{statusData.applicationCode}</p>
              </div>
            </div>

            <ApplicationStateNotice status={currentStatus || "UNKNOWN"} context="CONSULTA" canStartNew={statusData.canStartNew} onPrimary={notice.action === "REVIEW_OBSERVATIONS" ? () => setShowObservations(true) : notice.action === "START_NEW_APPLICATION" ? () => { window.location.href = statusData.affiliateType === "STUDENT" ? "/postulacion/estudiante" : "/postulacion/asociado"; } : undefined} />
            {notice.action === "VIEW_STATUS" && <StatusInReview data={statusData} />}
            {notice.action === "REVIEW_OBSERVATIONS" && showObservations && <StatusObserved data={statusData as never} onUploadSuccess={handleRefresh} />}
            {notice.action === "VIEW_REJECTION" || currentStatus === "REJECTED" ? <StatusRejected data={statusData} /> : null}

            <div className="mt-10 pt-6 border-t border-slate-100 flex flex-col items-center">
              <button onClick={() => setStatusData(null)} className="w-full h-12 rounded-xl bg-slate-50 border border-slate-200 text-slate-600 font-bold text-sm hover:bg-slate-100 hover:text-slate-800 transition-all flex items-center justify-center gap-2">
                <X size={18} className="text-slate-400" /> Cerrar detalle de solicitud
              </button>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
