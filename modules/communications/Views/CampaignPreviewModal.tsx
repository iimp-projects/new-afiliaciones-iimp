"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { Monitor, Send, Smartphone, X } from "lucide-react";
import { renderTemplate } from "../Services/TemplateRenderer";
import { isValidEmail } from "../Services/Import/EmailProcessing";
import { sendTestEmailAction } from "../Actions/send.actions";
import { ProcessLoadingOverlay } from "@/modules/shared/Components/ProcessLoadingOverlay";
import type { CampaignDetail, CampaignRecipientPreview } from "../Models/Campaign";

const subscribe = () => () => {};
const clientSnapshot = () => true;
const serverSnapshot = () => false;

type PreviewDevice = "desktop" | "mobile";

export function CampaignPreviewModal({
  campaign,
  previewRecipients,
  senderEmail,
  onClose,
}: {
  campaign: CampaignDetail;
  previewRecipients: CampaignRecipientPreview[];
  senderEmail: string | null;
  onClose: () => void;
}) {
  const mounted = useSyncExternalStore(subscribe, clientSnapshot, serverSnapshot);
  const [recipientId, setRecipientId] = useState<number | null>(previewRecipients[0]?.id ?? null);
  const [device, setDevice] = useState<PreviewDevice>("desktop");
  const [toEmail, setToEmail] = useState("");
  const [confirmTest, setConfirmTest] = useState(false);
  const [testBusy, setTestBusy] = useState(false);
  const [testError, setTestError] = useState<string | null>(null);
  const [testSentTo, setTestSentTo] = useState<string | null>(null);

  const busy = testBusy;
  const canTestEmail = campaign.status === "DRAFT" || campaign.status === "READY";
  const emailValid = isValidEmail(toEmail.trim());

  const recipient = useMemo(
    () => previewRecipients.find((r) => r.id === recipientId) ?? null,
    [previewRecipients, recipientId],
  );

  const renderedSubject = useMemo(() => renderTemplate(campaign.subject, recipient ?? {}), [campaign.subject, recipient]);
  const renderedHtml = useMemo(() => renderTemplate(campaign.htmlContent, recipient ?? {}), [campaign.htmlContent, recipient]);

  useEffect(() => {
    const bodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = bodyOverflow;
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) {
        event.preventDefault();
        onClose();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [busy, onClose]);

  const sendTest = async () => {
    setTestBusy(true);
    setTestError(null);
    const response = await sendTestEmailAction(campaign.id, toEmail.trim(), recipientId);
    setTestBusy(false);
    setConfirmTest(false);
    if (!response.success) setTestError(response.message);
    else setTestSentTo(toEmail.trim());
  };

  const fromName = campaign.senderName || "Instituto de Ingenieros de Minas del Perú";
  const fromLabel = senderEmail ? `${fromName} <${senderEmail}>` : fromName;

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="campaign-preview-title"
        className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-[24px] bg-white shadow-2xl"
      >
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-100 bg-slate-50/50 px-8 py-6">
          <div className="min-w-0">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#C5A059]">Correos Masivos</p>
            <h2 id="campaign-preview-title" className="mt-1 text-xl font-black text-slate-800">Vista previa del correo</h2>
            <p className="mt-1 text-xs text-slate-500">Revisa cómo se visualizará el mensaje antes de realizar cualquier envío.</p>
            <div className="mt-3 space-y-1 rounded-2xl border border-slate-200 bg-white p-3 text-xs text-slate-600">
              <p className="truncate"><span className="font-bold text-slate-400">De:</span> {fromLabel}</p>
              <p className="truncate"><span className="font-bold text-slate-400">Para:</span> {recipient ? `${recipient.name || ""} <${recipient.email}>` : "—"}</p>
              <p className="truncate"><span className="font-bold text-slate-400">Asunto:</span> {renderedSubject}</p>
            </div>
          </div>
          <button onClick={onClose} disabled={busy} aria-label="Cerrar" className="rounded-full p-2 text-slate-400 hover:bg-red-50 hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-40">
            <X size={22} />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-8" aria-busy={busy}>
          <div className="mb-5 flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-500">
              Previsualizar como
              <select
                value={recipientId ?? ""}
                onChange={(event) => setRecipientId(Number(event.target.value) || null)}
                className="h-10 min-w-[240px] rounded-xl border border-slate-200 px-3 text-sm font-semibold normal-case tracking-normal outline-none focus:border-[#C5A059]"
              >
                {previewRecipients.length === 0 ? (
                  <option value="">Sin destinatarios</option>
                ) : (
                  previewRecipients.map((r) => <option key={r.id} value={r.id}>{r.name || r.email} &lt;{r.email}&gt;</option>)
                )}
              </select>
            </label>
            <div className="flex rounded-xl bg-slate-100 p-1">
              <button onClick={() => setDevice("desktop")} className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold ${device === "desktop" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500"}`}>
                <Monitor size={14} /> Escritorio
              </button>
              <button onClick={() => setDevice("mobile")} className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold ${device === "mobile" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500"}`}>
                <Smartphone size={14} /> Móvil
              </button>
            </div>
          </div>

          <div className="rounded-2xl bg-slate-100 p-5">
            <div className={`mx-auto overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition-all duration-200 ${device === "mobile" ? "max-w-[375px]" : "max-w-[760px]"}`}>
              <iframe title="Vista previa del correo" sandbox="" srcDoc={renderedHtml} className={`w-full border-0 bg-white ${device === "mobile" ? "h-[600px]" : "h-[520px]"}`} />
            </div>
          </div>

          {canTestEmail && (
            <div className="mt-6 rounded-2xl border border-slate-200 p-6">
              <h3 className="text-sm font-black uppercase tracking-wide text-slate-700">Enviar correo de prueba</h3>
              <p className="mt-1 text-xs text-slate-500">Envía una copia de prueba únicamente a la dirección indicada, sin afectar a la campaña.</p>

              {testSentTo ? (
                <p className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-700">Correo de prueba enviado correctamente a {testSentTo}</p>
              ) : (
                <div className="mt-4 space-y-3">
                  <label className="block">
                    <span className="text-xs font-bold uppercase text-slate-500">Correo de prueba</span>
                    <input
                      value={toEmail}
                      onChange={(event) => setToEmail(event.target.value)}
                      disabled={busy}
                      placeholder="prueba@iimp.org.pe"
                      className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-[#C5A059]"
                    />
                  </label>
                  {testError && <p className="text-sm font-semibold text-red-600">{testError}</p>}
                  {confirmTest ? (
                    <div className="rounded-xl bg-amber-50 p-3 text-xs font-semibold text-amber-800">
                      Se enviará una copia de prueba únicamente a: <strong>{toEmail.trim()}</strong>
                      <div className="mt-3 flex gap-2">
                        <button onClick={() => setConfirmTest(false)} disabled={busy} className="rounded-xl px-4 py-2 text-xs font-bold text-slate-600 disabled:opacity-50">Cancelar</button>
                        <button onClick={() => void sendTest()} disabled={busy} className="inline-flex items-center gap-1.5 rounded-xl bg-[#C5A059] px-5 py-2 text-xs font-black text-white disabled:opacity-50">
                          <Send size={13} /> Enviar prueba
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button onClick={() => setConfirmTest(true)} disabled={busy || !emailValid} className="inline-flex items-center gap-2 rounded-xl bg-[#C5A059] px-5 py-2.5 text-sm font-black text-white shadow-md disabled:opacity-50">
                      <Send size={16} /> Enviar prueba
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <footer className="flex shrink-0 justify-end gap-3 border-t border-slate-100 bg-slate-50/50 px-8 py-5">
          <button onClick={onClose} disabled={busy} className="rounded-xl px-6 py-2.5 text-sm font-bold text-slate-600 disabled:opacity-50">Cerrar</button>
        </footer>
      </div>

      <ProcessLoadingOverlay open={busy} title="Enviando correo de prueba..." description="Estamos enviando la copia de prueba. No cierres esta ventana." />
    </div>,
    document.body,
  );
}
