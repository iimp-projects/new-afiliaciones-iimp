"use client";
import { useEffect, useState } from "react";
import { GlobalModalRoot } from "@/modules/shared/Components/GlobalModalRoot";
import { VerificationChannelModal, OtpVerificationModal } from "@/modules/shared/Components/VerificationModals";
import { ProcessLoadingOverlay } from "@/modules/shared/Components/ProcessLoadingOverlay";
import { queryApi } from "@/modules/afiliaciones/consulta/Services/QueryApi";
import type { ValidationResponseDTO, VerificationChoice } from "../DTOs/validation-response.dto";
import { resolveApplicationAction, type ApplicationContext, type AuthorizedApplicationSummary } from "../Models/ApplicationAction";
import type { VerificationChannel } from "@/modules/shared/Models/Verification";
import { ApplicationStateNotice } from "./ApplicationStateNotice";

export function ExistingApplicationGate({ challenge, authorized = false, context, onClose, onQuery, onStartNew, affiliateType }: {
  challenge?: ValidationResponseDTO; authorized?: boolean; context: ApplicationContext; onClose: () => void;
  onQuery?: (application: AuthorizedApplicationSummary) => Promise<void>; onStartNew?: () => void;
  affiliateType?: "ACTIVE" | "STUDENT";
}) {
  const [choice, setChoice] = useState<VerificationChoice | null>(() => challenge?.options.length === 1 ? challenge.options[0] : null);
  const [channel, setChannel] = useState<VerificationChannel>(challenge?.channels[0]?.channel || "EMAIL");
  const [phase, setPhase] = useState(authorized ? "APPLICATION" : challenge?.hasApplication === false ? "NONE" : "CHANNEL");
  const [apps, setApps] = useState<AuthorizedApplicationSummary[]>([]);
  const [selected, setSelected] = useState<AuthorizedApplicationSummary | null>(null);
  const [code, setCode] = useState("");
  const [sentAt, setSentAt] = useState(0);
  const [busy, setBusy] = useState(authorized);
  const [loadingTitle, setLoadingTitle] = useState(authorized ? "Preparando consulta..." : "");
  const [error, setError] = useState("");
  const run = async (title: string, action: () => Promise<void>) => {
    if (busy) return;
    setBusy(true); setLoadingTitle(title); setError("");
    try { await action(); } catch (cause) { setError(cause instanceof Error ? cause.message : "No se pudo procesar la solicitud."); }
    finally { setBusy(false); }
  };
  const choose = async (application: AuthorizedApplicationSummary) => {
    if (context === "CONSULTA" && onQuery) { await onQuery(application); }
    else { setSelected(application); setPhase("NOTICE"); }
  };
  const loadApplications = async () => {
    const result = (await queryApi.applications()).filter(application => !affiliateType || application.affiliateType === affiliateType);
    setApps(result); setPhase("APPLICATION");
    if (result.length === 1) await choose(result[0]);
  };
  useEffect(() => {
    if (!authorized) return;
    let active = true;
    void queryApi.applications().then(async result => {
      if (!active) return;
      const available = result.filter(application => !affiliateType || application.affiliateType === affiliateType);
      setApps(available);
      if (available.length === 1) await choose(available[0]);
    }).catch(cause => { if (active) setError(cause instanceof Error ? cause.message : "Verifica tu identidad nuevamente."); })
      .finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
    // Initialize once per gate; later selections are explicit user actions.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const send = () => run("Enviando código...", async () => { if (!choice) return; await queryApi.send(choice.context, channel); setSentAt(Date.now()); setCode(""); setPhase("OTP"); });
  const verify = () => run("Validando código...", async () => { if (!choice) return; await queryApi.verify(choice.context, code); await loadApplications(); });
  const navigate = () => {
    if (!selected) return;
    const action = resolveApplicationAction(selected.status, context, selected.canStartNew).action;
    if (action === "START_NEW_APPLICATION" && onStartNew) { onStartNew(); return; }
    window.location.href = selected.recoveryUrl || `/consulta?applicationId=${selected.id}`;
  };
  if (phase === "CHANNEL" && choice) return <VerificationChannelModal title="Encontramos una solicitud asociada a este documento" description="Verifica tu identidad para conocer su estado y las acciones disponibles." channels={choice.channels} channel={channel} onChannel={setChannel} onSend={send} onClose={onClose} loading={busy} error={error} />;
  if (phase === "OTP") return <OtpVerificationModal code={code} onCode={setCode} onVerify={verify} onResend={send} onChangeChannel={() => setPhase("CHANNEL")} onClose={onClose} loading={busy} loadingTitle={loadingTitle} error={error} sentAt={sentAt} destination={choice?.channels.find(item => item.channel === channel)?.destination || "tu medio registrado"} />;
  return <GlobalModalRoot title="Solicitud de afiliación">
    <ProcessLoadingOverlay open={busy} title={loadingTitle} description="Estamos preparando tu solicitud." />
    {phase === "NOTICE" && selected ? <ApplicationStateNotice status={selected.status} context={context} canStartNew={selected.canStartNew} onPrimary={navigate} onClose={onClose} /> : phase === "NONE" ? <ApplicationStateNotice status={null} context={context} onPrimary={() => { window.location.href = "/postulacion"; }} onClose={onClose} /> : <div className="bg-white rounded-3xl p-8 w-full max-w-lg max-h-[90dvh] overflow-y-auto">
      <h2 className="text-xl font-bold text-slate-800 mb-5">{phase === "CHANNEL" ? "Selecciona un medio registrado" : "Selecciona la solicitud"}</h2>
      {phase === "CHANNEL" ? challenge?.options.map((option, index) => <button type="button" key={option.context} className="block w-full rounded-xl border p-4 mb-3 text-left" onClick={() => { setChoice(option); setChannel(option.channels[0]?.channel || "EMAIL"); }}>Medio registrado {index + 1}<span className="block text-sm text-slate-500">{Array.from(new Set(option.channels.map(item => item.destination))).join(" · ") || "Sin contactos disponibles"}</span></button>) : apps.map(application => <button type="button" key={application.id} disabled={busy} onClick={() => void run("Preparando consulta...", () => choose(application))} className="block w-full rounded-xl border p-4 mb-3 text-left"><strong>{application.affiliateType === "STUDENT" ? "Estudiante" : "Asociado activo"}</strong><span className="block text-sm">{new Date(application.createdAt).toLocaleDateString("es-PE")} · {resolveApplicationAction(application.status, context).badge}</span></button>)}
      {error && <p role="alert" className="text-sm text-slate-600 my-4">{error}</p>}
      <button type="button" disabled={busy} onClick={onClose} className="w-full h-12 rounded-xl border font-bold text-slate-600">Cerrar</button>
    </div>}
  </GlobalModalRoot>;
}
