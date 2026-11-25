"use client";
/* eslint-disable @next/next/no-html-link-for-pages -- descarga de PDF desde API route */

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import { Award, BadgeCheck, BriefcaseBusiness, CalendarCheck2, CalendarDays, Download, ExternalLink, IdCard, Info, Printer, QrCode, RefreshCw, ShieldAlert, UserRound } from "lucide-react";
import { MAX_PENDING_QUOTAS } from "../Models/cardRules";
import { shouldAutoIssueCard } from "../Models/autoIssuance";
import { printCardPdf } from "./printCard";
import { Spinner } from "./Spinner";
import { useTransientBusy } from "./useTransientBusy";
import { WalletButtons } from "../wallet/Views/WalletButtons";

export type CardViewData = { firstName: string; paternalLastName: string; maternalLastName: string | null; name: string; code: string | null; category: string | null; photoUrl: string | null; source: "NEW" | "MIGRATED" | null; eligible: boolean; reason: string | null; pendingQuotaCount?: number; notFound: boolean };
export type CardViewState = { generated: boolean; status: "ISSUED" | "REVOKED" | null; verificationToken: string | null; issuedAt: string | null; revokedAt: string | null; revokedReason: string | null };

function formatIssuedAt(value: string | null): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("es-PE", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(value));
}

function useQr(url: string | null) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  useEffect(() => { if (!url) { setDataUrl(null); return; } let cancelled = false; QRCode.toDataURL(url, { width: 360, margin: 2, errorCorrectionLevel: "H" }).then(value => !cancelled && setDataUrl(value)).catch(() => !cancelled && setDataUrl(null)); return () => { cancelled = true; }; }, [url]);
  return dataUrl;
}

function CardFace({ data, verificationUrl, issuedAt = null, mode = "issued" }: { data: CardViewData; verificationUrl: string | null; issuedAt?: string | null; mode?: "issued" | "preview" }) {
  const issued = mode === "issued";
  const qr = useQr(issued ? verificationUrl : null);
  const category = data.category ?? "Por confirmar";
  const code = data.code ?? "Pendiente de sincronización SIE";
  const vigencia = (data.pendingQuotaCount ?? 0) > MAX_PENDING_QUOTAS ? "Restringida" : data.eligible ? "Vigente" : "Por confirmar";
  const issuedAtLabel = formatIssuedAt(issuedAt);

  return <article className="group relative isolate mx-auto aspect-[1.7/1] w-full max-w-[680px] overflow-hidden rounded-[22px] border border-slate-200 bg-white shadow-[0_18px_45px_-24px_rgba(20,35,61,0.5)] transition duration-200 motion-safe:hover:-translate-y-0.5 motion-safe:hover:shadow-[0_24px_50px_-24px_rgba(20,35,61,0.6)]">
    <div className="absolute inset-x-0 top-0 h-[24%] bg-gradient-to-r from-white 48% via-[#f8f1e3] 63% to-[#a87924]" />
    <div className="absolute left-[61%] top-0 h-[24%] w-9 -skew-x-[28deg] border-l border-white/70 bg-white/30" />
    <div className="absolute bottom-[-32%] left-[-4%] h-[52%] w-[76%] rounded-[50%] border border-[#c5953e]/25" />
    <div className="absolute bottom-[-38%] left-[16%] h-[56%] w-[72%] rounded-[50%] border border-[#c5953e]/15" />
    <div className="relative grid h-full grid-rows-[24%_1fr_14%]">
      <header className="flex items-center justify-between gap-4 px-5 sm:px-7">
        <img src="/images/logo-iimp.png" alt="Instituto de Ingenieros de Minas del Perú" className="h-11 w-auto max-w-[52%] object-contain sm:h-14" />
        <p className="pr-1 text-right text-[10px] font-semibold tracking-[0.22em] text-white sm:text-xs">CARNET<br className="sm:hidden" /> INSTITUCIONAL</p>
      </header>
      <div className="grid min-h-0 grid-cols-[minmax(62px,0.8fr)_minmax(0,2.3fr)_minmax(76px,1fr)] items-center gap-3 px-4 py-2 sm:grid-cols-[minmax(108px,1fr)_minmax(0,2.7fr)_minmax(120px,1.15fr)] sm:gap-5 sm:px-7 sm:py-3">
        <div className="aspect-[.78] max-h-[132px] self-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50 shadow-sm sm:max-h-[154px] sm:rounded-2xl">{data.photoUrl ? <img src={data.photoUrl} alt={`Fotografía de ${data.name}`} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center"><UserRound className="h-8 w-8 text-slate-300 sm:h-11 sm:w-11" /></div>}</div>
        <div className="min-w-0 self-center">
          <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-slate-500 sm:text-[11px]">Asociado IIMP</p>
          <h2 className="mt-1 line-clamp-2 break-words text-[15px] font-semibold leading-[1.12] text-[#14233D] sm:text-[24px]">{data.name || "—"}</h2>
          <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-[#f8f1e3] px-2 py-1 text-[9px] font-semibold text-[#936b2e] sm:px-3 sm:py-1.5 sm:text-[12px]"><BadgeCheck size={12} className="sm:h-3.5 sm:w-3.5" />{category}</span>
          <div className="mt-2 border-t border-slate-200 pt-2 sm:mt-3 sm:pt-2.5">
            <div className="grid grid-cols-2 gap-y-2.5 sm:gap-y-3">
              <CardData icon={BriefcaseBusiness} label="Categoría" value={category} />
              <CardData className="border-l border-slate-200 pl-2.5 sm:pl-4" icon={IdCard} label="Código de asociado" value={code} />
              <CardData icon={CalendarDays} label="Vigencia" value={vigencia} />
              <CardData className="border-l border-slate-200 pl-2.5 sm:pl-4" icon={CalendarCheck2} label="Fecha de emisión" value={issuedAtLabel} />
            </div>
          </div>
        </div>
        <div className="flex min-w-0 flex-col items-center gap-1 self-center border-l border-slate-200 pl-2 sm:gap-2 sm:pl-4">{issued && qr ? <img src={qr} alt="Código QR verificable" className="aspect-square w-full max-w-[112px] rounded-lg border border-slate-200 bg-white p-1.5 shadow-sm sm:max-w-[132px] sm:rounded-xl sm:p-2 lg:max-w-[140px]" /> : <div className="flex aspect-square w-full max-w-[112px] items-center justify-center rounded-lg border-2 border-dashed border-[#c5953e]/70 bg-white p-1 text-center text-[8px] font-medium leading-tight text-slate-500 sm:max-w-[132px] sm:rounded-xl sm:p-2 sm:text-[10px]"><QrCode className="mr-0.5 h-3.5 w-3.5 shrink-0 text-[#a87924] sm:mr-1 sm:h-4 sm:w-4" />QR pendiente de emisión</div>}<span className="text-center text-[8px] leading-tight text-slate-500 sm:text-[11px]">{issued ? "Escanear para verificar" : "Vista previa sin QR verificable"}</span></div>
      </div>
      <footer className="relative flex items-center gap-3 px-5 sm:px-7"><span className="h-6 border-l-2 border-[#c5953e]" /><span className="text-base font-semibold tracking-[0.2em] text-slate-700">IIMP</span><span className="border-l border-slate-300 pl-3 text-[8px] font-semibold uppercase tracking-[0.13em] text-slate-500 sm:text-[10px]">Instituto de Ingenieros<br />de Minas del Perú</span></footer>
    </div>
  </article>;
}

function CardData({ icon: Icon, label, value, className = "" }: { icon: typeof IdCard; label: string; value: string; className?: string }) {
  return <div className={`min-w-0 ${className}`}><p className="flex items-center gap-1 text-[7px] font-semibold uppercase tracking-[0.09em] text-slate-500 sm:text-[10px]"><Icon className="h-2.5 w-2.5 shrink-0 text-[#a87924] sm:h-3.5 sm:w-3.5" />{label}</p><p className="mt-0.5 break-words text-[8px] font-semibold leading-tight text-[#14233D] sm:text-[12px]">{value}</p></div>;
}

export { CardFace };

function StatusPanel({ data, card }: { data: CardViewData; card: CardViewState | null }) {
  const vigencia = (data.pendingQuotaCount ?? 0) > MAX_PENDING_QUOTAS ? "Restringida por cuotas pendientes" : data.eligible ? "Vigente" : "Por confirmar";
  const rows = [
    { icon: Award, title: "Estado", value: "Carnet disponible" },
    { icon: CalendarDays, title: "Vigencia institucional", value: vigencia },
    { icon: IdCard, title: "Código de asociado", value: data.code ?? "Pendiente de sincronización SIE" },
    { icon: CalendarCheck2, title: "Fecha de emisión", value: formatIssuedAt(card?.issuedAt ?? null) },
    { icon: QrCode, title: "QR verificable", value: "Disponible" },
  ];
  return <aside id="card-status" className="rounded-[20px] border border-slate-200 bg-white p-5 shadow-[0_12px_35px_-28px_rgba(20,35,61,0.55)] sm:p-6"><div className="flex items-center gap-2.5"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#f8f1e3] text-[#a87924]"><Award size={18} /></span><h2 className="font-semibold text-[#14233D]">Estado del carnet</h2></div><dl className="mt-4 divide-y divide-slate-100 border-t border-slate-100">{rows.map(({ icon: Icon, title, value }) => <div key={title} className="flex gap-3 py-3.5"><Icon size={17} className="mt-0.5 shrink-0 text-slate-400" /><div className="min-w-0"><dt className="text-sm font-medium text-[#14233D]">{title}</dt><dd className="mt-0.5 text-xs leading-5 text-slate-500">{value}</dd></div></div>)}</dl></aside>;
}

function PreparingCard({ label }: { label: string }) {
  return <section className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-[0_20px_50px_-42px_rgba(20,35,61,0.6)] sm:p-6" aria-busy="true">
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
      <div className="mx-auto w-full max-w-[680px]">
        <div className="aspect-[1.7/1] w-full animate-pulse rounded-[22px] bg-slate-100" />
        <div className="mt-5 flex flex-col gap-3 sm:flex-row"><div className="h-12 flex-1 animate-pulse rounded-xl bg-slate-100" /><div className="h-12 flex-1 animate-pulse rounded-xl bg-slate-100" /></div>
      </div>
      <div className="h-56 animate-pulse rounded-[20px] bg-slate-100" />
    </div>
    <p className="mt-5 text-center text-sm font-medium text-slate-500" aria-live="polite">{label}</p>
  </section>;
}

export function CardView({ data, card, issuanceEnabled, verificationBaseUrl, wallet }: { data: CardViewData | null; card: CardViewState | null; issuanceEnabled: boolean; verificationBaseUrl: string; wallet: { googleEnabled: boolean; appleEnabled: boolean; simulation?: boolean } }) {
  const router = useRouter();
  const [localCard, setLocalCard] = useState<CardViewState | null>(null);
  const [phase, setPhase] = useState<"idle" | "preparing" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [retryable, setRetryable] = useState(false);
  const attempted = useRef(false);
  const [downloading, startDownload] = useTransientBusy(2_500);
  const [printing, startPrint] = useTransientBusy(4_000);

  const effectiveCard = card?.generated ? card : localCard ?? card;
  const issued = effectiveCard?.generated === true && effectiveCard.status === "ISSUED";
  const revoked = effectiveCard?.generated === true && effectiveCard.status === "REVOKED";
  const verificationUrl = issued && effectiveCard?.verificationToken ? `${verificationBaseUrl}/verificar-carnet/${effectiveCard.verificationToken}` : null;
  const shouldPrepare = Boolean(data && !data.notFound) && shouldAutoIssueCard({
    eligible: Boolean(data?.eligible),
    generated: Boolean(card?.generated),
    revoked: false,
    issuanceEnabled,
    canIssue: true,
  });

  const prepare = useCallback(async () => {
    attempted.current = true;
    setPhase("preparing");
    setMessage(null);
    setRetryable(false);
    try {
      const response = await fetch("/api/afiliaciones/carnet/me", { method: "POST" });
      const body = await response.json().catch(() => null);
      if (!response.ok || !body?.success) {
        const code: string | undefined = body?.code;
        setPhase("error");
        setMessage(body?.message || "No fue posible preparar tu carné virtual. Intenta nuevamente.");
        setRetryable(code !== "ISSUANCE_DISABLED" && code !== "NOT_ELIGIBLE" && code !== "REVOKED");
        return;
      }
      const issuedCard = body.data?.card;
      setLocalCard({
        generated: true,
        status: "ISSUED",
        verificationToken: issuedCard?.verificationToken ?? null,
        issuedAt: issuedCard?.issuedAt ?? new Date().toISOString(),
        revokedAt: null,
        revokedReason: null,
      });
      setPhase("idle");
      router.refresh();
    } catch {
      setPhase("error");
      setMessage("No fue posible preparar tu carné virtual. Revisa tu conexión e intenta nuevamente.");
      setRetryable(true);
    }
  }, [router]);

  useEffect(() => {
    if (!shouldPrepare) return;
    if (attempted.current) return;
    void prepare();
  }, [shouldPrepare, prepare]);

  if (!data) return <EmptyNotice title="Mi carnet virtual" description="No se encontró la información de tu cuenta." />;
  if (data.notFound) return <EmptyNotice title="Mi carnet virtual" description="No se encontró una persona vinculada a tu cuenta." />;

  const content = () => {
    if (revoked) {
      return <section className="rounded-[20px] border border-red-200 bg-red-50 p-6"><div className="flex items-center gap-2 text-red-700"><ShieldAlert size={19} /><h2 className="font-semibold">Credencial revocada</h2></div><p className="mt-2 text-sm text-red-700">{effectiveCard?.revokedReason || "Esta credencial fue revocada."}</p><p className="mt-2 text-xs text-red-700/80">Para habilitar una nueva credencial, contacta a la administración del IIMP.</p></section>;
    }
    if (!data.eligible && !issued) {
      return <section className="rounded-[20px] border border-amber-200 bg-amber-50 p-6"><h2 className="font-semibold text-amber-900">Carnet no disponible</h2><p className="mt-2 text-sm leading-6 text-amber-800">{data.reason ?? "No se puede preparar el carnet en este momento."}</p></section>;
    }
    if (phase === "error") {
      return <section className="rounded-[20px] border border-red-200 bg-red-50 p-6" role="alert"><h2 className="font-semibold text-red-800">No pudimos preparar tu carné</h2><p className="mt-2 text-sm leading-6 text-red-700">{message}</p>{retryable && <button type="button" onClick={() => void prepare()} className="mt-4 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#a87924] px-5 text-sm font-semibold text-white transition hover:bg-[#8f661d]"><RefreshCw size={18} /> Reintentar</button>}</section>;
    }
    if (issued) {
      return <section className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-[0_20px_50px_-42px_rgba(20,35,61,0.6)] sm:p-6">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
          <div className="min-w-0">
            <CardFace data={data} verificationUrl={verificationUrl} issuedAt={effectiveCard?.issuedAt ?? null} mode="issued" />
            <div className="mx-auto mt-5 flex w-full max-w-[680px] flex-col gap-3 sm:flex-row">
              <a href="/api/afiliaciones/carnet/me/download" onClick={startDownload} aria-busy={downloading} className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-[#a87924] px-5 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-[#8f661d] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#a87924] sm:text-base">{downloading ? <><Spinner className="h-5 w-5" /> Preparando…</> : <><Download size={20} /> Descargar PDF</>}</a>
              <button type="button" onClick={() => { if (printing) return; startPrint(); printCardPdf("/api/afiliaciones/carnet/me/download?mode=print"); }} disabled={printing} aria-busy={printing} className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-xl border border-[#E6C982] bg-white px-5 text-sm font-semibold text-[#936B2E] shadow-sm transition hover:bg-[#FFF8E8] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#a87924] disabled:opacity-60 sm:text-base">{printing ? <><Spinner className="h-5 w-5" /> Preparando…</> : <><Printer size={20} /> Imprimir carné</>}</button>
              {verificationUrl && <a href={verificationUrl} target="_blank" rel="noopener noreferrer" className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 sm:text-base"><ExternalLink size={20} /> Verificar</a>}
            </div>
          </div>
          <StatusPanel data={data} card={effectiveCard} />
        </div>
        {(wallet.googleEnabled || wallet.appleEnabled) && (
          <WalletButtons googleEnabled={wallet.googleEnabled} appleEnabled={wallet.appleEnabled} simulation={wallet.simulation} />
        )}
      </section>;
    }
    if (phase === "preparing" || issuanceEnabled) return <PreparingCard label="Preparando tu carné virtual…" />;
    return <section className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-[0_20px_50px_-42px_rgba(20,35,61,0.6)] sm:p-6">
      <div className="mx-auto w-full max-w-[680px]">
        <CardFace data={data} verificationUrl={null} mode="preview" />
        <div className="mt-5 flex gap-3 rounded-xl border border-[#ead7ab] bg-[#fdf8ec] p-4 text-sm text-[#73521d]"><Info size={18} className="mt-0.5 shrink-0" /><p>La emisión de carnets no está disponible en este momento. Tu credencial se habilitará automáticamente cuando el servicio esté disponible.</p></div>
      </div>
    </section>;
  };

  return <div className="w-full space-y-6 pb-4">
    <header className="relative overflow-hidden rounded-[22px] border border-slate-100 bg-gradient-to-r from-white via-white to-[#f8f1e3]/80 px-5 py-6 sm:px-7"><div className="flex items-center gap-4"><span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#f8f1e3] text-[#a87924]"><IdCard size={24} /></span><div><h1 className="text-2xl font-semibold tracking-tight text-[#14233D] sm:text-[32px]">Mi carnet virtual</h1><p className="mt-1 text-sm text-slate-500">Tu credencial institucional del IIMP, lista para usar.</p></div></div></header>
    {content()}
  </div>;
}

function EmptyNotice({ title, description }: { title: string; description: string }) { return <div className="w-full space-y-5"><header><h1 className="text-3xl font-semibold tracking-tight text-[#14233D]">{title}</h1></header><div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-10 text-center"><p className="text-sm text-slate-500">{description}</p></div></div>; }
