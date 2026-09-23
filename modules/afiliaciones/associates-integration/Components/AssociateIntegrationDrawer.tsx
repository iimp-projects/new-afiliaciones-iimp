"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Copy, LoaderCircle, RefreshCw, X } from "lucide-react";
import { AssociateIntegrationStatusBadge } from "./AssociateIntegrationTable";
import { affiliateLabels, AssociateIntegrationDetail, formatAssociateIntegrationDate, triggerLabels } from "./associateIntegration.types";

type DrawerTab = "Resumen" | "Datos de inscripción" | "Payload SIE" | "Historial de intentos" | "Resultado SIE";
type Props = { detail: AssociateIntegrationDetail | null; loading: boolean; retrying: boolean; initialTab: "Resumen" | "Payload SIE"; onClose: () => void; onRetry: (id: number) => void };
export type SieTransmissionState = "NOT_ATTEMPTED" | "LOCAL_FAILURE" | "TRANSPORT_FAILURE" | "SYNCED" | "PROCESSING";
const tabs: DrawerTab[] = ["Resumen", "Datos de inscripción", "Payload SIE", "Historial de intentos", "Resultado SIE"];

function Field({ label, value }: { label: string; value: unknown }) {
  return <div className="border-b border-slate-100 py-3 last:border-0"><dt className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</dt><dd className="mt-1 break-words text-sm font-semibold text-slate-700">{value === null || value === undefined || value === "" ? "No disponible" : String(value)}</dd></div>;
}

export function getSieTransmissionState(detail: AssociateIntegrationDetail): SieTransmissionState {
  const attempts = detail.attemptHistory ?? [];
  if (attempts.some((attempt) => attempt.result === "SYNCED") || detail.status === "SYNCED") return "SYNCED";
  if (attempts.length > 0) return "TRANSPORT_FAILURE";
  if (detail.status === "FAILED" && detail.error.code) return "LOCAL_FAILURE";
  if (detail.status === "PROCESSING") return "PROCESSING";
  return "NOT_ATTEMPTED";
}

function transmissionSummary(detail: AssociateIntegrationDetail) {
  const state = getSieTransmissionState(detail);
  if (state === "SYNCED") return { title: "Sincronización completada", description: "SIE aceptó la inscripción y se guardó su resultado externo.", tone: "emerald" };
  if (state === "TRANSPORT_FAILURE") return { title: "El último envío a SIE no se completó", description: "El historial conserva el resultado técnico y el error sanitizado del proveedor.", tone: "rose" };
  if (state === "LOCAL_FAILURE") return { title: "No se realizó ningún envío a SIE", description: "La validación local falló antes del transporte; por ello no existe POST /asociados registrado.", tone: "rose" };
  if (state === "PROCESSING") return { title: "Envío SIE en preparación", description: "La inscripción fue reclamada para sincronización; el resultado aparecerá al finalizar el transporte.", tone: "sky" };
  return { title: "Aún no se realizó un envío a SIE", description: "La inscripción todavía no ha iniciado el proceso de sincronización.", tone: "amber" };
}

async function copyText(value: string) {
  if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(value); return; }
  const textarea = document.createElement("textarea");
  textarea.value = value; textarea.setAttribute("readonly", ""); textarea.style.position = "fixed"; textarea.style.opacity = "0";
  document.body.appendChild(textarea); textarea.select();
  const copied = document.execCommand("copy"); document.body.removeChild(textarea);
  if (!copied) throw new Error("COPY_FAILED");
}

function ResultTab({ detail }: { detail: AssociateIntegrationDetail }) {
  const summary = transmissionSummary(detail);
  const attempts = detail.attemptHistory ?? [];
  const latestAttempt = attempts[0];
  const state = getSieTransmissionState(detail);
  const tone = summary.tone === "emerald" ? "border-emerald-200 bg-emerald-50 text-emerald-900" : summary.tone === "rose" ? "border-rose-200 bg-rose-50 text-rose-900" : summary.tone === "sky" ? "border-sky-200 bg-sky-50 text-sky-900" : "border-amber-200 bg-amber-50 text-amber-900";

  return <div className="space-y-5">
    <section className={`rounded-xl border p-4 ${tone}`}><h3 className="font-black">{summary.title}</h3><p className="mt-1 text-sm leading-6">{summary.description}</p></section>
    {state === "SYNCED" && <><h3 className="text-xs font-black uppercase tracking-widest text-emerald-700">Resultado de SIE</h3><dl className="grid gap-x-6 sm:grid-cols-2"><Field label="Código asociado SIE" value={detail.result.externalAssociateCode} /><Field label="Mensaje" value={detail.result.externalMessage} /><Field label="Fecha de sincronización" value={formatAssociateIntegrationDate(detail.syncedAt)} /><Field label="HTTP" value={latestAttempt?.httpStatus} /></dl>{detail.result.receiptType || detail.result.serie || detail.result.numero || detail.result.pdfReference ? <><h3 className="text-xs font-black uppercase tracking-widest text-slate-700">Comprobante externo</h3><dl className="grid gap-x-6 sm:grid-cols-2"><Field label="Tipo" value={detail.result.receiptType} /><Field label="Serie" value={detail.result.serie} /><Field label="Número" value={detail.result.numero} /><Field label="Referencia PDF" value={detail.result.pdfReference} /></dl></> : <p className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">SIE no devolvió datos de comprobante para este envío.</p>}</>}
    {state === "TRANSPORT_FAILURE" && <><h3 className="text-xs font-black uppercase tracking-widest text-rose-700">Resultado del último intento</h3><dl className="grid gap-x-6 sm:grid-cols-2"><Field label="Estado" value={latestAttempt?.result ?? detail.status} /><Field label="HTTP" value={latestAttempt?.httpStatus ?? detail.error.httpStatus} /><Field label="Código" value={latestAttempt?.errorCode ?? detail.error.code} /><Field label="Mensaje" value={latestAttempt?.message ?? detail.error.message} /><Field label="Identificador" value={latestAttempt?.errorIdentifier ?? detail.error.identifier} /><Field label="Fecha" value={formatAssociateIntegrationDate(latestAttempt?.finishedAt ?? latestAttempt?.startedAt)} /><Field label="Duración" value={latestAttempt?.durationMs === null || latestAttempt?.durationMs === undefined ? null : `${latestAttempt.durationMs} ms`} /></dl></>}
    {state === "LOCAL_FAILURE" && <><h3 className="text-xs font-black uppercase tracking-widest text-rose-700">Validación local previa al transporte</h3><dl className="grid gap-x-6 sm:grid-cols-2"><Field label="Estado" value={detail.status} /><Field label="Código" value={detail.error.code} /><Field label="Mensaje" value={detail.error.message} /><Field label="Identificador" value={detail.error.identifier} /><Field label="Fecha" value={formatAssociateIntegrationDate(detail.updatedAt)} /></dl></>}
    {(state === "NOT_ATTEMPTED" || state === "PROCESSING") && <dl className="grid gap-x-6 sm:grid-cols-2"><Field label="Estado actual" value={detail.status} /><Field label="Origen" value={triggerLabels[detail.trigger]} /><Field label="Fecha de creación" value={formatAssociateIntegrationDate(detail.createdAt)} /><Field label="Intentos de envío" value={attempts.length} /></dl>}
  </div>;
}

function AttemptHistoryTab({ detail }: { detail: AssociateIntegrationDetail }) {
  const attempts = detail.attemptHistory ?? [];
  if (!attempts.length) return <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-600"><p className="font-black text-slate-800">Aún no existen envíos lógicos registrados.</p><p className="mt-1">El sistema todavía no ha ejecutado POST /asociados.</p></div>;
  return <ol className="space-y-3 border-l-2 border-slate-100 pl-5">{attempts.map((attempt) => <li key={attempt.attemptNumber} className="relative"><span className="absolute -left-[27px] top-1 h-3 w-3 rounded-full bg-[#C5A059]" /><p className="font-black text-slate-800">Intento #{attempt.attemptNumber}</p><p className="mt-1 text-xs font-semibold text-slate-500">{attempt.result ?? "En curso"} · {formatAssociateIntegrationDate(attempt.finishedAt ?? attempt.startedAt)} · HTTP {attempt.httpStatus ?? "No disponible"} · {attempt.durationMs ?? "No disponible"}{attempt.durationMs === null || attempt.durationMs === undefined ? "" : " ms"}</p>{(attempt.message || attempt.externalMessage) && <p className="mt-1 text-xs text-slate-600">{attempt.message ?? attempt.externalMessage}</p>}{attempt.errorCode && <p className="mt-1 text-xs font-bold text-rose-700">Código: {attempt.errorCode}</p>}{attempt.externalAssociateCode && <p className="mt-1 text-xs font-bold text-emerald-700">Código SIE: {attempt.externalAssociateCode}</p>}</li>)}</ol>;
}

export function AssociateIntegrationDrawer({ detail, loading, retrying, initialTab, onClose, onRetry }: Props) {
  const mounted = typeof document !== "undefined";
  const [tab, setTab] = useState<DrawerTab>(initialTab);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">("idle");
  useEffect(() => { if (!detail && !loading) return; const previous = document.body.style.overflow; document.body.style.overflow = "hidden"; const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); }; window.addEventListener("keydown", closeOnEscape); return () => { document.body.style.overflow = previous; window.removeEventListener("keydown", closeOnEscape); }; }, [detail, loading, onClose]);
  if (!mounted || (!loading && !detail)) return null;
  const payloadJson = detail ? JSON.stringify(detail.sanitizedPayloadPreview, null, 2) : "";
  const copyPayload = async () => { try { await copyText(payloadJson); setCopyState("copied"); window.setTimeout(() => setCopyState("idle"), 2000); } catch { setCopyState("error"); window.setTimeout(() => setCopyState("idle"), 2500); } };
  const attempts = detail?.attemptHistory ?? [];
  const content = !detail ? null : tab === "Resumen" ? <dl className="grid gap-x-6 sm:grid-cols-2"><Field label="Expediente" value={detail.applicationCode} /><Field label="Estado SIE" value={detail.status} /><Field label="Origen" value={triggerLabels[detail.trigger]} /><Field label="Tipo" value={affiliateLabels[detail.affiliateType]} /><Field label="Envíos lógicos registrados" value={attempts.length} /><Field label="Último intento" value={formatAssociateIntegrationDate(attempts[0]?.finishedAt ?? attempts[0]?.startedAt)} /><Field label="Último resultado" value={getSieTransmissionState(detail)} /><Field label="Código SIE" value={detail.result.externalAssociateCode} /><Field label="Último error" value={detail.error.code ?? detail.error.message} /></dl> : tab === "Datos de inscripción" ? <><h3 className="text-xs font-black uppercase tracking-widest text-slate-700">Asociado</h3><dl className="mt-2 grid gap-x-6 sm:grid-cols-2"><Field label="Nombre" value={detail.associate.fullName} /><Field label="Documento" value={`${detail.associate.documentType ?? "No disponible"} · ${detail.associate.maskedDocumentNumber}`} /><Field label="Dirección disponible" value={detail.associate.addressAvailable ? "Sí" : "No"} /></dl><h3 className="mt-5 text-xs font-black uppercase tracking-widest text-slate-700">Facturación</h3><dl className="mt-2 grid gap-x-6 sm:grid-cols-2"><Field label="Comprobante" value={detail.billing.receiptType} /><Field label="Documento" value={`${detail.billing.billingDocumentType ?? "No disponible"} · ${detail.billing.maskedBillingDocument}`} /><Field label="Dirección fiscal disponible" value={detail.billing.billingAddressAvailable ? "Sí" : "No"} /></dl><h3 className="mt-5 text-xs font-black uppercase tracking-widest text-slate-700">Servicios</h3>{detail.services.map((service) => <p key={service.concepto} className="mt-2 rounded-xl bg-slate-50 px-3 py-2 text-xs font-semibold">{service.concepto} · Año {service.anno} · {service.moneda} {service.monto} · {service.cortesia ? "Cortesía" : "Regular"}</p>)}</> : tab === "Payload SIE" ? <div><button onClick={() => void copyPayload()} className="mb-4 inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50">{copyState === "copied" ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}{copyState === "copied" ? "Copiado" : "Copiar JSON"}</button>{copyState === "error" && <p role="status" className="mb-3 text-xs font-bold text-rose-600">No se pudo copiar el JSON.</p>}<pre className="overflow-x-auto whitespace-pre rounded-xl bg-slate-900 p-4 text-xs leading-5 text-slate-100">{payloadJson}</pre></div> : tab === "Historial de intentos" ? <AttemptHistoryTab detail={detail} /> : <ResultTab detail={detail} />;
  return createPortal(<div className="fixed inset-0 z-[99990]"><button aria-label="Cerrar detalle" onClick={onClose} className="absolute inset-0 bg-slate-900/50 backdrop-blur-[2px]" /><aside role="dialog" aria-modal="true" aria-label="Detalle de inscripción SIE" className="fixed inset-y-0 right-0 z-[99999] flex w-full flex-col overflow-hidden border-l border-slate-200 bg-white shadow-2xl sm:w-[500px] md:w-[700px] lg:w-[850px]"><div className="absolute right-4 top-4 z-10"><button aria-label="Cerrar detalle" onClick={onClose} className="rounded-full border border-slate-200 bg-white p-2 text-slate-500 hover:bg-rose-50 hover:text-rose-600"><X size={18} /></button></div>{loading ? <div className="grid h-full place-items-center"><LoaderCircle className="animate-spin text-[#C5A059]" /></div> : detail && <><header className="shrink-0 border-b border-slate-100 px-5 pb-6 pt-16 sm:px-8"><AssociateIntegrationStatusBadge status={detail.status} /><h2 className="mt-3 text-xl font-black text-slate-800">{detail.associate.fullName}</h2><p className="text-sm font-semibold text-slate-500">{affiliateLabels[detail.affiliateType]} · {detail.associate.documentType ?? "No disponible"} {detail.associate.maskedDocumentNumber}</p><p className="mt-2 text-xs font-bold text-slate-400">Expediente: {detail.applicationCode} · {triggerLabels[detail.trigger]}</p></header><nav className="flex shrink-0 overflow-x-auto border-b-2 border-slate-100 bg-white px-2 sm:px-6">{tabs.map((item) => <button key={item} onClick={() => setTab(item)} className={`min-w-max px-3 py-3.5 text-xs font-bold ${tab === item ? "border-b-[3px] border-[#C5A059] text-[#C5A059]" : "text-slate-500 hover:text-[#C5A059]"}`}>{item}</button>)}</nav><main className="flex-1 overflow-y-auto bg-slate-50/70 p-5 sm:p-8"><section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">{content}</section></main><footer className="flex shrink-0 items-center justify-between border-t border-slate-100 bg-white px-5 py-4 sm:px-8"><span className="text-xs font-bold text-slate-400">Última actualización: {formatAssociateIntegrationDate(detail.updatedAt)}</span>{detail.status === "RETRYABLE" && <button disabled={retrying} onClick={() => onRetry(detail.integrationId)} className="inline-flex items-center gap-2 rounded-lg bg-[#C5A059] px-4 py-2.5 text-xs font-black text-white"><RefreshCw size={15} />{retrying ? "Reintentando..." : "Reintentar envío"}</button>}</footer></>}</aside></div>, document.body);
}
