"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, Download, ExternalLink, IdCard, Printer, RefreshCw, ShieldAlert, ShieldCheck, ShieldX } from "lucide-react";
import { CardFace, type CardViewData, type CardViewState } from "./CardView";
import { MAX_PENDING_QUOTAS } from "../Models/cardRules";
import { shouldAutoIssueCard } from "../Models/autoIssuance";
import { printCardPdf } from "./printCard";
import { Spinner } from "./Spinner";
import { useTransientBusy } from "./useTransientBusy";
import { WalletStatusPanel } from "../wallet/Views/WalletStatusPanel";

type Preview = CardViewData & { issuanceEnabled: boolean; canManage: boolean; verificationUrl: string | null; card: CardViewState };
type Busy = "revoke" | "regenerate" | null;
type Confirmation = "revoke" | "regenerate" | null;

function AdminCarnetSkeleton({ label, split }: { label: string; split: boolean }) {
  return <div className="space-y-5" aria-busy="true" aria-live="polite">
    <div className={split ? "grid gap-6 lg:grid-cols-[minmax(0,1.72fr)_minmax(300px,1fr)] lg:items-start" : "grid gap-6"}>
      <div className="mx-auto w-full max-w-[680px]"><div className="aspect-[1.7/1] w-full animate-pulse rounded-[22px] bg-slate-100" /><div className="mt-5 h-12 w-full animate-pulse rounded-xl bg-slate-100" /></div>
      {split && <div className="h-56 animate-pulse rounded-2xl bg-slate-100" />}
    </div>
    <p className="text-center text-sm font-medium text-slate-500">{label}</p>
  </div>;
}

function formatIssuedAt(value: string | null): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("es-PE", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(value));
}

export function AdminCarnetPanel({ personId, variant = "stacked" }: { personId: number; variant?: "stacked" | "split" }) {
  const router = useRouter();
  const split = variant === "split";
  const indicator = useRef(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loading, setLoading] = useState(true);
  const [preparing, setPreparing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryable, setRetryable] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState<Busy>(null);
  const [confirmation, setConfirmation] = useState<Confirmation>(null);
  const [downloading, startDownload] = useTransientBusy(2_500);
  const [printing, startPrint] = useTransientBusy(4_000);

  useEffect(() => {
    indicator.current = false;
  }, [personId]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/afiliaciones/carnet/${personId}`, { cache: "no-store" });
      const body = await response.json();
      if (!response.ok || !body.success) {
        setError(body.message || "No fue posible consultar el carnet.");
        setRetryable(true);
        setPreview(null);
        return;
      }
      setPreview(body.data);
    } catch {
      setError("No fue posible consultar el carnet.");
      setRetryable(true);
      setPreview(null);
    } finally {
      setLoading(false);
    }
  }, [personId]);

  useEffect(() => {
    void load();
  }, [load]);

  const prepare = useCallback(async () => {
    setPreparing(true);
    setError(null);
    setRetryable(false);
    try {
      const response = await fetch(`/api/afiliaciones/carnet/${personId}/issue`, { method: "POST" });
      const body = await response.json().catch(() => null);
      if (!response.ok || !body?.success) {
        const code: string | undefined = body?.code;
        setError(body?.message || "No fue posible preparar la credencial del asociado.");
        setRetryable(code !== "ISSUANCE_DISABLED" && code !== "NOT_ELIGIBLE" && code !== "REVOKED" && code !== "NOT_FOUND");
        return;
      }
      router.refresh();
      await load();
    } catch {
      setError("No fue posible preparar la credencial del asociado. Intenta nuevamente.");
      setRetryable(true);
    } finally {
      setPreparing(false);
    }
  }, [personId, router, load]);

  const autoPrepare = preview ? shouldAutoIssueCard({
    eligible: preview.eligible,
    generated: preview.card.generated,
    revoked: preview.card.status === "REVOKED",
    issuanceEnabled: preview.issuanceEnabled,
    canIssue: preview.canManage,
  }) : false;

  useEffect(() => {
    if (!autoPrepare) return;
    if (indicator.current) return;
    indicator.current = true;
    void prepare();
  }, [autoPrepare, prepare]);

  const revoke = useCallback(async () => {
    if (!reason.trim()) return;
    setBusy("revoke");
    setError(null);
    try {
      const response = await fetch(`/api/afiliaciones/carnet/${personId}/revoke`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reason: reason.trim() }),
      });
      const body = await response.json();
      if (!response.ok || !body.success) {
        setError(body.message || "No fue posible revocar el carnet.");
        return;
      }
      setReason("");
      setConfirmation(null);
      router.refresh();
      await load();
    } catch {
      setError("No fue posible revocar el carnet.");
    } finally {
      setBusy(null);
    }
  }, [reason, personId, router, load]);

  const regenerate = useCallback(async () => {
    setBusy("regenerate");
    setError(null);
    try {
      const response = await fetch(`/api/afiliaciones/carnet/${personId}/regenerate`, { method: "POST" });
      const body = await response.json();
      if (!response.ok || !body.success) {
        setError(body.message || "No fue posible regenerar el carnet.");
        return;
      }
      setConfirmation(null);
      router.refresh();
      await load();
    } catch {
      setError("No fue posible regenerar el carnet.");
    } finally {
      setBusy(null);
    }
  }, [personId, router, load]);

  if ((loading && !preview) || preparing) return <AdminCarnetSkeleton label="Preparando credencial del asociado…" split={split} />;
  if (!preview) return <div className="space-y-3 p-5 text-sm text-slate-500"><p>{error ?? "No fue posible consultar el carnet."}</p><button type="button" onClick={() => void load()} className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#a87924] px-4 text-xs font-bold text-white hover:bg-[#8f661d]"><RefreshCw size={15} /> Reintentar</button></div>;

  const issued = preview.card.generated && preview.card.status === "ISSUED";
  const revoked = preview.card.generated && preview.card.status === "REVOKED";
  const autoPending = autoPrepare && !error;
  const verificationUrl = issued ? preview.verificationUrl : null;
  const downloadUrl = `/api/afiliaciones/carnet/${personId}/download`;

  const cardContent = () => {
    if (autoPending) return <div className="mx-auto w-full max-w-[680px]"><div className="aspect-[1.7/1] w-full animate-pulse rounded-[22px] bg-slate-100" /><p className="mt-4 text-center text-sm font-medium text-slate-500" aria-live="polite">Preparando credencial del asociado…</p></div>;
    if (issued) return <CardFace data={preview} verificationUrl={verificationUrl} issuedAt={preview.card.issuedAt} mode="issued" />;
    if (revoked) return <section className="mx-auto flex aspect-[1.7/1] w-full max-w-[680px] flex-col items-center justify-center gap-2 rounded-[22px] border border-red-200 bg-red-50 p-6 text-center"><ShieldAlert size={32} className="text-red-500" /><p className="font-semibold text-red-800">Credencial revocada</p><p className="max-w-md text-xs text-red-700">{preview.card.revokedReason || "Esta credencial fue revocada por la administración."}</p></section>;
    if (!preview.eligible) return <section className="mx-auto flex aspect-[1.7/1] w-full max-w-[680px] flex-col items-center justify-center gap-2 rounded-[22px] border border-amber-200 bg-amber-50 p-6 text-center"><ShieldAlert size={32} className="text-amber-600" /><p className="font-semibold text-amber-900">Carnet no disponible</p><p className="max-w-md text-xs leading-5 text-amber-800">{preview.reason}</p></section>;
    if (!preview.issuanceEnabled) return <div className="mx-auto w-full max-w-[680px] space-y-4"><CardFace data={preview} verificationUrl={null} mode="preview" /><p className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs leading-5 text-slate-500">La emisión automática está deshabilitada en este entorno.</p></div>;
    return <div className="mx-auto flex aspect-[1.7/1] w-full max-w-[680px] flex-col items-center justify-center gap-2 rounded-[22px] border border-slate-200 bg-slate-50 p-6 text-center"><IdCard size={32} className="text-slate-400" /><p className="font-semibold text-slate-700">{error ? "Credencial no disponible temporalmente" : "Credencial aún no preparada"}</p><p className="max-w-md text-xs leading-5 text-slate-500">{error ? "Usa Reintentar para volver a intentarlo." : "Se requiere un usuario con permisos de gestión para preparar esta credencial."}</p></div>;
  };

  return <div className="space-y-5">
    {error && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700" role="alert"><p>{error}</p>{retryable && <button type="button" onClick={() => void prepare()} className="mt-3 inline-flex h-10 items-center gap-2 rounded-lg bg-[#a87924] px-4 text-xs font-bold text-white hover:bg-[#8f661d]"><RefreshCw size={15} /> Reintentar</button>}</div>}

    <div className={split ? "grid gap-6 lg:grid-cols-[minmax(0,1.72fr)_minmax(300px,1fr)] lg:items-start" : "grid gap-6"}>
      <div className="min-w-0">{cardContent()}</div>

      <aside className="space-y-5">
        {issued && <>
          <div className="flex items-center gap-2 text-sm font-semibold text-emerald-700"><ShieldCheck size={18} className="text-emerald-600" /> Carnet disponible</div>
          <p className="-mt-2 flex items-center gap-2 text-xs text-slate-500"><CalendarDays size={14} /> Emitido el {formatIssuedAt(preview.card.issuedAt)}</p>
          <div className="space-y-2.5">
            <a href={downloadUrl} onClick={startDownload} aria-busy={downloading} className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#a87924] px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#8f661d] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#a87924]">{downloading ? <><Spinner className="h-5 w-5" /> Preparando…</> : <><Download size={20} /> Descargar PDF</>}</a>
            <button type="button" onClick={() => { if (printing) return; startPrint(); printCardPdf(`${downloadUrl}?mode=print`); }} disabled={busy !== null || printing} aria-busy={printing} className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-[#E6C982] bg-white px-5 text-sm font-semibold text-[#936B2E] shadow-sm transition hover:bg-[#FFF8E8] disabled:opacity-50">{printing ? <><Spinner className="h-5 w-5" /> Preparando…</> : <><Printer size={20} /> Imprimir carné</>}</button>
            {verificationUrl && <a href={verificationUrl} target="_blank" rel="noopener noreferrer" className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"><ExternalLink size={18} /> Verificar credencial</a>}
          </div>
          <p className="text-xs leading-5 text-slate-500">Vigencia institucional: {(preview.pendingQuotaCount ?? 0) > MAX_PENDING_QUOTAS ? "restringida por cuotas pendientes" : "vigente"}.</p>
        </>}

        {revoked && <>
          <div className="flex items-center gap-2 text-sm font-semibold text-red-700"><ShieldX size={18} /> Credencial revocada</div>
          {preview.canManage ? <button type="button" onClick={() => setConfirmation("regenerate")} disabled={busy !== null || !preview.issuanceEnabled} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-[#E6C982] bg-white px-4 text-sm font-semibold text-[#936B2E] hover:bg-[#FFF8E8] disabled:opacity-50"><RefreshCw size={18} /> Regenerar credencial</button> : <p className="text-xs text-slate-500">Modo solo consulta: no tienes permiso para regenerar.</p>}
          {!preview.issuanceEnabled && <p className="text-xs text-slate-500">La emisión está deshabilitada en este entorno.</p>}
        </>}

        {!preview.eligible && <p className="text-xs leading-5 text-slate-500">La credencial se habilitará cuando el asociado cumpla las condiciones institucionales vigentes.</p>}

        {preview.eligible && !preview.card.generated && !preview.issuanceEnabled && <p className="text-xs leading-5 text-slate-500">La emisión automática se habilitará cuando el servicio esté disponible.</p>}

        {preview.eligible && !preview.card.generated && preview.issuanceEnabled && !preview.canManage && <p className="text-xs leading-5 text-slate-500">Modo solo consulta: no tienes permisos para preparar credenciales.</p>}

        {issued && preview.canManage && <div className="border-t border-slate-100 pt-4">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Acciones administrativas</p>
          {confirmation !== "revoke" ? <div className="mt-3 space-y-2">
            <input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Motivo de revocación (obligatorio)" maxLength={500} className="h-10 w-full rounded-lg border border-slate-200 px-3 text-xs" />
            <button type="button" onClick={() => setConfirmation("revoke")} disabled={busy !== null || !reason.trim()} className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-red-200 bg-white px-4 text-xs font-bold text-red-700 hover:bg-red-50 disabled:opacity-50"><ShieldX size={15} /> Revocar carné</button>
          </div> : <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-xs leading-5 text-red-700">
            <p className="font-semibold">¿Confirmas la revocación?</p>
            <p className="mt-1">El QR actual dejará de ser válido inmediatamente. Motivo: {reason.trim()}</p>
            <div className="mt-3 flex gap-2">
              <button type="button" onClick={revoke} disabled={busy !== null} aria-busy={busy === "revoke"} className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-red-600 px-3 text-xs font-bold text-white hover:bg-red-700 disabled:opacity-50">{busy === "revoke" ? <><Spinner className="h-3.5 w-3.5" /> Revocando…</> : "Sí, revocar"}</button>
              <button type="button" onClick={() => setConfirmation(null)} disabled={busy !== null} className="inline-flex h-9 items-center rounded-lg border border-red-200 bg-white px-3 text-xs font-bold text-red-700 hover:bg-red-100 disabled:opacity-50">Cancelar</button>
            </div>
          </div>}
        </div>}

        {issued && !preview.canManage && <p className="text-xs text-slate-500">Modo solo consulta: no tienes permiso para gestionar esta credencial.</p>}

        {preview.card.generated && <WalletStatusPanel personId={personId} canManage={preview.canManage} />}
      </aside>
    </div>

    {revoked && preview.canManage && confirmation === "regenerate" && <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
      <p className="font-semibold">¿Regenerar la credencial?</p>
      <p className="mt-1 text-xs">Se generará un nuevo QR y el código anterior dejará de ser válido.</p>
      <div className="mt-3 flex gap-2">
        <button type="button" onClick={regenerate} disabled={busy !== null} aria-busy={busy === "regenerate"} className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-[#B8892D] px-3 text-xs font-bold text-white hover:bg-[#9E7425] disabled:opacity-50">{busy === "regenerate" ? <><Spinner className="h-3.5 w-3.5" /> Regenerando…</> : "Sí, regenerar"}</button>
        <button type="button" onClick={() => setConfirmation(null)} disabled={busy !== null} className="inline-flex h-9 items-center rounded-lg border border-amber-200 bg-white px-3 text-xs font-bold text-amber-800 hover:bg-amber-100 disabled:opacity-50">Cancelar</button>
      </div>
    </div>}
  </div>;
}
