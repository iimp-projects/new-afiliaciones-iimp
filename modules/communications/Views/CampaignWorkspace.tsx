"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, Loader2, Send } from "lucide-react";
import { CampaignForm } from "./CampaignForm";
import { renderTemplate } from "../Services/TemplateRenderer";
import { backToDraftAction, cancelCampaignAction, markCampaignReadyAction, setCampaignRecipientsAction } from "../Actions/campaign.actions";
import { fetchDeliveryHistoryAction, processCampaignBatchAction, retryCampaignFailedAction, sendIndividualEmailAction, sendTestEmailAction, startCampaignSendAction } from "../Actions/send.actions";
import { formatDateTimeEsPe } from "@/modules/shared/Utils/formatDateTime";
import { CAMPAIGN_POLL_INTERVAL_MS } from "../Config/campaignSend";
import type { CampaignDetail, CampaignRecipientPreview, CampaignRecipientSelection } from "../Models/Campaign";
import type { CampaignSendProgress } from "../Models/CampaignSend";
import type { CampaignRecipientView, CampaignSendStats, DeliveryView } from "../Repositories/EmailDeliveryRepository";

const statusLabel: Record<string, string> = {
  DRAFT: "BORRADOR",
  READY: "LISTA",
  SENDING: "ENVIANDO",
  COMPLETED: "COMPLETADA",
  PARTIAL: "PARCIAL",
  CANCELLED: "CANCELADA",
};

const recipientStatusLabel: Record<string, { label: string; className: string }> = {
  PENDING: { label: "PENDIENTE", className: "bg-slate-100 text-slate-600" },
  SENDING: { label: "ENVIANDO", className: "bg-amber-100 text-amber-700" },
  SENT: { label: "ENVIADO", className: "bg-emerald-100 text-emerald-700" },
  ERROR: { label: "ERROR", className: "bg-red-100 text-red-700" },
};

function formatDate(value?: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return formatDateTimeEsPe(date);
}

export function CampaignWorkspace({
  campaign,
  selection,
  previewRecipients,
  campaignRecipients,
  stats,
}: {
  campaign: CampaignDetail;
  selection: CampaignRecipientSelection;
  previewRecipients: CampaignRecipientPreview[];
  campaignRecipients: CampaignRecipientView[];
  stats: CampaignSendStats;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<"resumen" | "contenido" | "destinatarios" | "preview">("resumen");
  const [confirmReady, setConfirmReady] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [testModal, setTestModal] = useState(false);
  const [confirmSend, setConfirmSend] = useState(false);
  const [confirmRetry, setConfirmRetry] = useState(false);
  const [liveProgress, setLiveProgress] = useState<CampaignSendProgress | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isDraft = campaign.status === "DRAFT";
  const isReady = campaign.status === "READY";
  const isPartial = campaign.status === "PARTIAL";

  const progress = useMemo<CampaignSendProgress>(() => {
    if (liveProgress) return liveProgress;
    const processed = stats.sent + stats.error;
    return {
      campaignId: campaign.id,
      status: campaign.status,
      total: stats.recipients,
      sent: stats.sent,
      sending: stats.sending,
      pending: stats.pending,
      error: stats.error,
      processed,
      percent: stats.recipients === 0 ? 0 : Math.round((processed / stats.recipients) * 100),
      done: campaign.status === "COMPLETED" || campaign.status === "PARTIAL" || campaign.status === "CANCELLED",
    };
  }, [liveProgress, stats, campaign.id, campaign.status]);

  useEffect(() => {
    if (campaign.status !== "SENDING") return;
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    const tick = async () => {
      const response = await processCampaignBatchAction(campaign.id);
      if (cancelled) return;
      if (response.success) {
        setLiveProgress(response.progress);
        if (response.finished) {
          if (timer) clearInterval(timer);
          timer = null;
          router.refresh();
        }
      }
    };

    void tick();
    timer = setInterval(tick, CAMPAIGN_POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, [campaign.id, campaign.status, router]);

  const action = async (fn: () => Promise<{ success: boolean; message?: string }>) => {
    setBusy(true);
    setError(null);
    const response = await fn();
    setBusy(false);
    if (!response.success) setError(response.message ?? "No se pudo completar la operación.");
    else {
      setConfirmReady(false);
      setConfirmCancel(false);
      router.refresh();
    }
  };

  return (
    <main className="mx-auto w-full max-w-[1200px] p-6 md:p-8">
      <div className="mb-4 flex items-center gap-2 text-sm text-slate-500">
        <button onClick={() => router.push("/intranet/correos-masivos")} className="font-semibold hover:text-[#C5A059]">Correos Masivos</button>
        <span>/</span>
        <span className="font-bold text-slate-800">{campaign.name}</span>
      </div>

      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[.18em] text-[#C79A3B]">Campaña</p>
          <h1 className="text-2xl font-black tracking-tight text-slate-800">{campaign.name}</h1>
          <span className="mt-2 inline-block rounded-full bg-slate-100 px-3 py-1 text-[11px] font-black uppercase text-slate-600">{statusLabel[campaign.status] ?? campaign.status}</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {(isDraft || isReady) && (
            <button onClick={() => setTestModal(true)} className="inline-flex items-center gap-2 rounded-xl border border-[#C5A059] px-5 py-2.5 text-sm font-black text-[#7f561e]">
              <Send size={16} /> Enviar prueba
            </button>
          )}
          {isDraft && (
            <button onClick={() => setConfirmReady(true)} className="inline-flex items-center gap-2 rounded-xl bg-[#C5A059] px-5 py-2.5 text-sm font-black text-white shadow-md">
              <Send size={16} /> Marcar como lista para enviar
            </button>
          )}
          {isReady && (
            <button onClick={() => setConfirmSend(true)} className="inline-flex items-center gap-2 rounded-xl bg-[#152238] px-5 py-2.5 text-sm font-black text-white shadow-md">
              <Send size={16} /> Enviar campaña
            </button>
          )}
          {isPartial && (
            <button onClick={() => setConfirmRetry(true)} className="inline-flex items-center gap-2 rounded-xl bg-[#C5A059] px-5 py-2.5 text-sm font-black text-white shadow-md">
              <Send size={16} /> Reintentar fallidos
            </button>
          )}
          {isReady && (
            <button onClick={() => void action(() => backToDraftAction(campaign.id).then((r) => ({ success: r.success, message: r.success ? undefined : r.message })))} className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-bold text-slate-600">
              Volver a borrador
            </button>
          )}
          {(isDraft || isReady) && (
            <button onClick={() => setConfirmCancel(true)} className="rounded-xl border border-red-200 px-5 py-2.5 text-sm font-bold text-red-600">
              Cancelar
            </button>
          )}
        </div>
      </header>

      {error && (
        <div className="mt-4 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
          <AlertTriangle size={18} className="mt-0.5 shrink-0" /> {error}
        </div>
      )}

      <div className="mt-6 flex w-fit rounded-xl bg-slate-100 p-1">
        {(["resumen", "contenido", "destinatarios", "preview"] as const).map((item) => (
          <button key={item} onClick={() => setTab(item)} className={`rounded-lg px-4 py-2 text-sm font-bold capitalize ${tab === item ? "bg-white shadow-sm text-slate-800" : "text-slate-500"}`}>
            {item === "preview" ? "Vista previa" : item}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {tab === "resumen" && (
          <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div><dt className="text-xs font-bold uppercase text-slate-400">Nombre</dt><dd className="font-bold text-slate-800">{campaign.name}</dd></div>
              <div><dt className="text-xs font-bold uppercase text-slate-400">Asunto</dt><dd className="font-semibold text-slate-700">{campaign.subject}</dd></div>
              <div><dt className="text-xs font-bold uppercase text-slate-400">Estado</dt><dd className="font-semibold text-slate-700">{statusLabel[campaign.status]}</dd></div>
              <div><dt className="text-xs font-bold uppercase text-slate-400">Fecha creación</dt><dd className="font-semibold text-slate-700">{formatDate(campaign.createdAt)}</dd></div>
              <div><dt className="text-xs font-bold uppercase text-slate-400">Creado por</dt><dd className="font-semibold text-slate-700">{campaign.createdByName || "—"}</dd></div>
              <div><dt className="text-xs font-bold uppercase text-slate-400">Destinatarios</dt><dd className="font-bold text-slate-800">{stats.recipients} destinatarios</dd></div>
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <div className="rounded-2xl bg-slate-50 p-4 text-sm font-bold text-slate-700">Total: {progress.total}</div>
              <div className="rounded-2xl bg-slate-50 p-4 text-sm font-bold text-slate-700">Pendientes: {progress.pending}</div>
              <div className="rounded-2xl bg-amber-50 p-4 text-sm font-bold text-amber-700">Enviando: {progress.sending}</div>
              <div className="rounded-2xl bg-emerald-50 p-4 text-sm font-bold text-emerald-700">Enviados: {progress.sent}</div>
              <div className="rounded-2xl bg-red-50 p-4 text-sm font-bold text-red-700">Errores: {progress.error}</div>
            </div>
            <div className="mt-4">
              <div className="mb-1 flex items-center justify-between text-xs font-bold text-slate-500">
                <span>{progress.processed} / {progress.total} procesados</span>
                <span>{progress.percent}%</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-[#C5A059] transition-all" style={{ width: `${progress.percent}%` }} />
              </div>
            </div>
          </section>
        )}

        {tab === "contenido" && (
          <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            {isDraft ? <CampaignForm campaignId={campaign.id} initial={campaign} /> : (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800">
                La campaña no está en borrador. Vuelve a borrador para editar el contenido.
              </div>
            )}
          </div>
        )}

        {tab === "destinatarios" && (
          isDraft ? (
            <RecipientsTab campaignId={campaign.id} isDraft={isDraft} selection={selection} />
          ) : (
            <SendTab campaignId={campaign.id} isReady={isReady} campaignRecipients={campaignRecipients} />
          )
        )}

        {tab === "preview" && <PreviewTab campaign={campaign} previewRecipients={previewRecipients} />}
      </div>

      {confirmReady && (
        <ConfirmModal title="Preparar campaña" onClose={() => setConfirmReady(false)} onConfirm={() => void action(() => markCampaignReadyAction(campaign.id).then((r) => ({ success: r.success, message: r.success ? undefined : r.message })))} busy={busy}>
          <p className="text-sm text-slate-600">Destinatarios únicos: <strong>{campaign.recipientCount}</strong></p>
          <p className="mt-2 text-sm text-slate-600">Asunto: <strong>{campaign.subject}</strong></p>
          <p className="mt-3 rounded-xl bg-amber-50 p-3 text-xs font-semibold text-amber-800">¿Confirmas que la campaña está lista? Esto <strong>NO</strong> enviará ningún correo.</p>
        </ConfirmModal>
      )}

      {confirmCancel && (
        <ConfirmModal title="Cancelar campaña" onClose={() => setConfirmCancel(false)} onConfirm={() => void action(() => cancelCampaignAction(campaign.id).then((r) => ({ success: r.success, message: r.success ? undefined : r.message })))} busy={busy}>
          <p className="text-sm text-slate-600">La campaña pasará a estado <strong>CANCELADA</strong> y no se podrá editar.</p>
        </ConfirmModal>
      )}

      {testModal && <TestEmailModal campaign={campaign} previewRecipients={previewRecipients} onClose={() => setTestModal(false)} />}

      {confirmSend && <MassSendModal campaign={campaign} stats={stats} onClose={() => setConfirmSend(false)} onConfirmed={() => { setConfirmSend(false); router.refresh(); }} />}

      {confirmRetry && <RetryModal campaign={campaign} errorCount={stats.error} onClose={() => setConfirmRetry(false)} onConfirmed={() => { setConfirmRetry(false); router.refresh(); }} />}
    </main>
  );
}

function RecipientsTab({ campaignId, isDraft, selection }: { campaignId: number; isDraft: boolean; selection: CampaignRecipientSelection }) {
  const [selectedLists, setSelectedLists] = useState<number[]>([]);
  const [individuals, setIndividuals] = useState<number[]>(selection.selectedRecipientIds);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const uniqueCount = useMemo(() => {
    const set = new Set<number>();
    for (const recipient of selection.recipients) {
      if (recipient.listIds.some((id) => selectedLists.includes(id))) set.add(recipient.id);
    }
    for (const id of individuals) set.add(id);
    return set.size;
  }, [selectedLists, individuals, selection.recipients]);

  const toggleList = (id: number) => setSelectedLists((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  const toggleIndividual = (id: number) => setIndividuals((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const save = async () => {
    setBusy(true);
    setMessage(null);
    const response = await setCampaignRecipientsAction(campaignId, { listIds: selectedLists, recipientIds: individuals });
    setBusy(false);
    setMessage(response.success ? `Se guardaron ${response.count} destinatarios únicos.` : response.message);
  };

  const filtered = selection.recipients.filter((recipient) => {
    if (!search) return true;
    const haystack = `${recipient.name ?? ""} ${recipient.company ?? ""} ${recipient.email}`.toLowerCase();
    return haystack.includes(search.toLowerCase());
  });

  return (
    <section className="space-y-5">
      <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <h3 className="mb-4 text-sm font-black uppercase tracking-wide text-slate-700">Listas disponibles</h3>
        <div className="grid gap-2 sm:grid-cols-2">
          {selection.lists.map((list) => (
            <label key={list.id} className="flex cursor-pointer items-center justify-between rounded-xl border border-slate-200 p-3 hover:bg-slate-50">
              <span className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <input type="checkbox" disabled={!isDraft} checked={selectedLists.includes(list.id)} onChange={() => toggleList(list.id)} className="h-4 w-4 accent-[#C5A059]" />
                {list.name}
              </span>
              <span className="text-xs font-bold text-slate-400">{list.memberCount} destinatarios</span>
            </label>
          ))}
        </div>
      </div>

      <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-black uppercase tracking-wide text-slate-700">Destinatarios individuales</h3>
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar nombre, empresa, email" className="h-9 w-64 rounded-lg border border-slate-200 px-3 text-xs outline-none focus:border-[#C5A059]" />
        </div>
        <div className="mt-4 max-h-72 space-y-1 overflow-y-auto">
          {filtered.map((recipient) => (
            <label key={recipient.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-slate-50">
              <input type="checkbox" disabled={!isDraft} checked={individuals.includes(recipient.id)} onChange={() => toggleIndividual(recipient.id)} className="h-4 w-4 accent-[#C5A059]" />
              <span className="font-semibold text-slate-700">{recipient.name || "—"}</span>
              <span className="text-slate-400">({recipient.email})</span>
            </label>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between rounded-2xl bg-[#fdfaf5] p-4">
        <p className="text-sm font-bold text-slate-700">Seleccionados: <span className="text-[#C5A059]">{uniqueCount} destinatarios únicos</span></p>
        {isDraft && (
          <button onClick={() => void save()} disabled={busy} className="inline-flex items-center gap-2 rounded-xl bg-[#C5A059] px-6 py-2.5 text-sm font-black text-white shadow-md disabled:opacity-50">
            {busy && <Loader2 size={16} className="animate-spin" />} Guardar destinatarios
          </button>
        )}
      </div>
      {message && <p className="text-sm font-semibold text-emerald-700">{message}</p>}
    </section>
  );
}

function SendTab({ campaignId, isReady, campaignRecipients }: { campaignId: number; isReady: boolean; campaignRecipients: CampaignRecipientView[] }) {
  const [sendTarget, setSendTarget] = useState<CampaignRecipientView | null>(null);
  const [history, setHistory] = useState<CampaignRecipientView | null>(null);

  return (
    <section className="rounded-3xl bg-white shadow-sm ring-1 ring-slate-200">
      <header className="flex items-center gap-2 border-b border-slate-100 px-6 py-4">
        <h3 className="text-sm font-black uppercase tracking-wide text-slate-700">Destinatarios</h3>
      </header>
      {campaignRecipients.length === 0 ? (
        <div className="px-6 py-14 text-center text-sm font-semibold text-slate-500">No hay destinatarios asociados.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-4 py-2">Nombre</th>
                <th className="px-4 py-2">Email</th>
                <th className="px-4 py-2">Estado</th>
                <th className="px-4 py-2">Envíos</th>
                <th className="px-4 py-2">Último envío</th>
                <th className="px-4 py-2">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {campaignRecipients.map((recipient) => {
                const status = recipientStatusLabel[recipient.status] ?? recipientStatusLabel.PENDING;
                return (
                  <tr key={recipient.recipientId} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-semibold text-slate-700">{recipient.name || "—"}</td>
                    <td className="px-4 py-3 text-slate-600">{recipient.email}</td>
                    <td className="px-4 py-3"><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${status.className}`}>{status.label}</span></td>
                    <td className="px-4 py-3 text-slate-600">{recipient.sendCount}</td>
                    <td className="px-4 py-3 text-slate-500">{formatDate(recipient.lastSentAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        {isReady && (
                          <button onClick={() => setSendTarget(recipient)} className="rounded-lg bg-[#C5A059] px-3 py-1.5 text-[11px] font-black text-white">
                            {recipient.sendCount > 0 ? "Reenviar" : "Enviar"}
                          </button>
                        )}
                        <button onClick={() => setHistory(recipient)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-bold text-slate-600">
                          Historial
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {sendTarget && <SendConfirmModal campaignId={campaignId} recipient={sendTarget} onClose={() => setSendTarget(null)} />}
      {history && <HistoryModal campaignId={campaignId} recipient={history} onClose={() => setHistory(null)} />}
    </section>
  );
}

function SendConfirmModal({ campaignId, recipient, onClose }: { campaignId: number; recipient: CampaignRecipientView; onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const resend = recipient.sendCount > 0;

  const send = async () => {
    setBusy(true);
    setError(null);
    const response = await sendIndividualEmailAction(campaignId, recipient.recipientId);
    setBusy(false);
    if (!response.success) setError(response.message);
    else onClose();
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md rounded-[24px] bg-white p-6 shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center gap-2">
          <Send size={18} className="text-[#C5A059]" />
          <h3 className="text-lg font-black text-slate-800">{resend ? "Reenviar" : "Confirmar envío"}</h3>
        </div>
        <div className="mt-4 space-y-2 text-sm text-slate-600">
          <p>Destinatario: <strong>{recipient.name || recipient.email} &lt;{recipient.email}&gt;</strong></p>
          {resend && (
            <>
              <p>Este destinatario ya recibió esta campaña.</p>
              <p>Envíos anteriores: <strong>{recipient.sendCount}</strong></p>
              <p>Último envío: <strong>{formatDate(recipient.lastSentAt)}</strong></p>
            </>
          )}
          <p className="rounded-xl bg-amber-50 p-3 text-xs font-semibold text-amber-800">Este correo será enviado realmente.</p>
        </div>
        {error && <p className="mt-3 text-sm font-semibold text-red-600">{error}</p>}
        <div className="mt-6 flex justify-end gap-3">
          <button onClick={onClose} className="rounded-xl px-5 py-2.5 text-sm font-bold text-slate-600">Cancelar</button>
          <button onClick={() => void send()} disabled={busy} className="rounded-xl bg-[#C5A059] px-6 py-2.5 text-sm font-black text-white shadow-md disabled:opacity-50">
            {busy && <Loader2 size={15} className="mr-1 inline animate-spin" />} {resend ? "Reenviar" : "Enviar"}
          </button>
        </div>
      </div>
    </div>
  );
}

function HistoryModal({ campaignId, recipient, onClose }: { campaignId: number; recipient: CampaignRecipientView; onClose: () => void }) {
  const [deliveries, setDeliveries] = useState<DeliveryView[] | null>(null);

  useEffect(() => {
    void fetchDeliveryHistoryAction(campaignId, recipient.recipientId).then(setDeliveries);
  }, [campaignId, recipient.recipientId]);

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-2xl rounded-[24px] bg-white p-6 shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-black text-slate-800">Historial de envíos — {recipient.email}</h3>
          <button onClick={onClose} className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100">✕</button>
        </div>
        {!deliveries ? (
          <p className="mt-6 text-sm text-slate-500">Cargando…</p>
        ) : deliveries.length === 0 ? (
          <p className="mt-6 text-sm text-slate-500">Sin intentos de envío.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-400">
                <tr><th className="px-3 py-2">Intento</th><th className="px-3 py-2">Estado</th><th className="px-3 py-2">Fecha</th><th className="px-3 py-2">Message ID</th><th className="px-3 py-2">Error</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {deliveries.map((delivery) => {
                  const status = recipientStatusLabel[delivery.status] ?? recipientStatusLabel.PENDING;
                  return (
                    <tr key={delivery.id}>
                      <td className="px-3 py-2 font-bold text-slate-700">#{delivery.attemptNumber}</td>
                      <td className="px-3 py-2"><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${status.className}`}>{status.label}</span></td>
                      <td className="px-3 py-2 text-slate-500">{formatDate(delivery.sentAt ?? delivery.createdAt)}</td>
                      <td className="px-3 py-2 text-slate-500">{delivery.messageId || "-"}</td>
                      <td className="px-3 py-2 text-slate-500">{delivery.errorMessage || "-"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function TestEmailModal({ campaign, previewRecipients, onClose }: { campaign: CampaignDetail; previewRecipients: CampaignRecipientPreview[]; onClose: () => void }) {
  const [toEmail, setToEmail] = useState("");
  const [referenceId, setReferenceId] = useState<number | null>(previewRecipients[0]?.id ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const reference = previewRecipients.find((r) => r.id === referenceId) ?? null;

  const send = async () => {
    setBusy(true);
    setError(null);
    const response = await sendTestEmailAction(campaign.id, toEmail, referenceId);
    setBusy(false);
    if (!response.success) setError(response.message);
    else setDone(true);
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md rounded-[24px] bg-white p-6 shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center gap-2">
          <Send size={18} className="text-[#C5A059]" />
          <h3 className="text-lg font-black text-slate-800">Enviar correo de prueba</h3>
        </div>

        {done ? (
          <p className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-700">Correo de prueba enviado correctamente.</p>
        ) : (
          <div className="mt-5 space-y-4">
            <label className="block">
              <span className="text-xs font-bold uppercase text-slate-500">Correo destinatario</span>
              <input value={toEmail} onChange={(event) => setToEmail(event.target.value)} placeholder="prueba@iimp.org.pe" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-[#C5A059]" />
            </label>
            <label className="block">
              <span className="text-xs font-bold uppercase text-slate-500">Destinatario de referencia para personalización</span>
              <select value={referenceId ?? ""} onChange={(event) => setReferenceId(Number(event.target.value) || null)} className="mt-1 h-10 w-full rounded-xl border border-slate-200 px-3 text-sm font-semibold">
                <option value="">Sin personalización</option>
                {previewRecipients.map((r) => <option key={r.id} value={r.id}>{r.name || r.email} &lt;{r.email}&gt;</option>)}
              </select>
            </label>
            <p className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
              El correo será enviado a: <strong>{toEmail || "—"}</strong><br />
              La personalización utilizará: <strong>{reference ? `${reference.name || ""} / ${reference.company || ""}` : "—"}</strong>
            </p>
            {error && <p className="text-sm font-semibold text-red-600">{error}</p>}
            <div className="flex justify-end gap-3">
              <button onClick={onClose} className="rounded-xl px-5 py-2.5 text-sm font-bold text-slate-600">Cancelar</button>
              <button onClick={() => void send()} disabled={busy || !toEmail.trim()} className="rounded-xl bg-[#C5A059] px-6 py-2.5 text-sm font-black text-white shadow-md disabled:opacity-50">
                {busy && <Loader2 size={15} className="mr-1 inline animate-spin" />} Enviar prueba
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function PreviewTab({ campaign, previewRecipients }: { campaign: CampaignDetail; previewRecipients: CampaignRecipientPreview[] }) {
  const [recipientId, setRecipientId] = useState<number | null>(previewRecipients[0]?.id ?? null);
  const recipient = previewRecipients.find((r) => r.id === recipientId) ?? null;

  const renderedSubject = renderTemplate(campaign.subject, recipient ?? {});
  const renderedHtml = renderTemplate(campaign.htmlContent, recipient ?? {});

  return (
    <section className="space-y-5">
      <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <h3 className="mb-4 text-sm font-black uppercase tracking-wide text-slate-700">Vista previa para</h3>
        {previewRecipients.length === 0 ? (
          <p className="text-sm text-slate-500">La campaña no tiene destinatarios asociados.</p>
        ) : (
          <select value={recipientId ?? ""} onChange={(event) => setRecipientId(Number(event.target.value))} className="h-10 rounded-xl border border-slate-200 px-3 text-sm font-semibold">
            {previewRecipients.map((r) => <option key={r.id} value={r.id}>{r.name || r.email} &lt;{r.email}&gt;</option>)}
          </select>
        )}
      </div>

      <div className="mx-auto w-full max-w-[680px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 bg-slate-50 px-5 py-3 text-xs">
          <p><span className="font-bold text-slate-400">DE:</span> <span className="text-slate-700">{campaign.senderName || "Instituto de Ingenieros de Minas del Perú"}</span></p>
          <p><span className="font-bold text-slate-400">PARA:</span> <span className="text-slate-700">{recipient?.name || ""} &lt;{recipient?.email || ""}&gt;</span></p>
          <p><span className="font-bold text-slate-400">ASUNTO:</span> <span className="text-slate-700">{renderedSubject}</span></p>
        </div>
        <div className="p-5">
          <iframe title="Vista previa" sandbox="" srcDoc={renderedHtml} className="min-h-[420px] w-full border-0 bg-white" />
        </div>
      </div>
    </section>
  );
}

function ConfirmModal({ title, children, onClose, onConfirm, busy }: { title: string; children: React.ReactNode; onClose: () => void; onConfirm: () => void; busy: boolean }) {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md rounded-[24px] bg-white p-6 shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center gap-2">
          <CheckCircle2 size={18} className="text-[#C5A059]" />
          <h3 className="text-lg font-black text-slate-800">{title}</h3>
        </div>
        <div className="mt-4">{children}</div>
        <div className="mt-6 flex justify-end gap-3">
          <button onClick={onClose} className="rounded-xl px-5 py-2.5 text-sm font-bold text-slate-600">Cancelar</button>
          <button onClick={onConfirm} disabled={busy} className="rounded-xl bg-[#C5A059] px-6 py-2.5 text-sm font-black text-white shadow-md disabled:opacity-50">
            {busy && <Loader2 size={15} className="mr-1 inline animate-spin" />} Confirmar
          </button>
        </div>
      </div>
    </div>
  );
}

function MassSendModal({ campaign, stats, onClose, onConfirmed }: { campaign: CampaignDetail; stats: CampaignSendStats; onClose: () => void; onConfirmed: () => void }) {
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const enabled = confirmation === "ENVIAR";

  const confirm = async () => {
    setBusy(true);
    setError(null);
    const response = await startCampaignSendAction(campaign.id);
    setBusy(false);
    if (!response.success) setError(response.message);
    else onConfirmed();
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md rounded-[24px] bg-white p-6 shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center gap-2">
          <Send size={18} className="text-[#C5A059]" />
          <h3 className="text-lg font-black text-slate-800">Enviar campaña</h3>
        </div>
        <div className="mt-4 space-y-2 text-sm text-slate-600">
          <p>Nombre: <strong>{campaign.name}</strong></p>
          <p>Asunto: <strong>{campaign.subject}</strong></p>
          <p>Cantidad de destinatarios únicos: <strong>{stats.recipients}</strong></p>
          <p>Remitente: <strong>{campaign.senderName || "IIMP"}{campaign.senderEmail ? ` <${campaign.senderEmail}>` : ""}</strong></p>
          <p>Reply-To: <strong>{campaign.replyTo || "—"}</strong></p>
          <p>Estado actual: <strong>{statusLabel[campaign.status]}</strong></p>
        </div>
        <p className="mt-3 rounded-xl bg-amber-50 p-3 text-xs font-semibold text-amber-800">Esta acción iniciará el envío de correos a <strong>{stats.recipients}</strong> destinatarios.</p>
        <label className="mt-4 block">
          <span className="text-xs font-bold uppercase text-slate-500">Escribe ENVIAR para confirmar</span>
          <input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} placeholder="ENVIAR" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-[#C5A059]" />
        </label>
        {error && <p className="mt-3 text-sm font-semibold text-red-600">{error}</p>}
        <div className="mt-6 flex justify-end gap-3">
          <button onClick={onClose} className="rounded-xl px-5 py-2.5 text-sm font-bold text-slate-600">Cancelar</button>
          <button onClick={() => void confirm()} disabled={!enabled || busy} className="rounded-xl bg-[#C5A059] px-6 py-2.5 text-sm font-black text-white shadow-md disabled:opacity-50">
            {busy && <Loader2 size={15} className="mr-1 inline animate-spin" />} Iniciar envío
          </button>
        </div>
      </div>
    </div>
  );
}

function RetryModal({ campaign, errorCount, onClose, onConfirmed }: { campaign: CampaignDetail; errorCount: number; onClose: () => void; onConfirmed: () => void }) {
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const enabled = confirmation === "REINTENTAR";

  const confirm = async () => {
    setBusy(true);
    setError(null);
    const response = await retryCampaignFailedAction(campaign.id);
    setBusy(false);
    if (!response.success) setError(response.message);
    else onConfirmed();
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md rounded-[24px] bg-white p-6 shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center gap-2">
          <Send size={18} className="text-[#C5A059]" />
          <h3 className="text-lg font-black text-slate-800">Reintentar {errorCount} fallidos</h3>
        </div>
        <p className="mt-4 text-sm text-slate-600">Esta acción reintentará el envío únicamente a los <strong>{errorCount}</strong> destinatarios que presentaron errores. No se reenviará a quienes ya recibieron el correo.</p>
        <label className="mt-4 block">
          <span className="text-xs font-bold uppercase text-slate-500">Escribe REINTENTAR para confirmar</span>
          <input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} placeholder="REINTENTAR" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-[#C5A059]" />
        </label>
        {error && <p className="mt-3 text-sm font-semibold text-red-600">{error}</p>}
        <div className="mt-6 flex justify-end gap-3">
          <button onClick={onClose} className="rounded-xl px-5 py-2.5 text-sm font-bold text-slate-600">Cancelar</button>
          <button onClick={() => void confirm()} disabled={!enabled || busy} className="rounded-xl bg-[#C5A059] px-6 py-2.5 text-sm font-black text-white shadow-md disabled:opacity-50">
            {busy && <Loader2 size={15} className="mr-1 inline animate-spin" />} Reintentar
          </button>
        </div>
      </div>
    </div>
  );
}
