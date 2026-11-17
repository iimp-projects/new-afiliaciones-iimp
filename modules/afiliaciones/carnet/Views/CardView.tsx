"use client";
/* eslint-disable @next/next/no-html-link-for-pages -- descarga de PDF desde API route */

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import { Award, BadgeCheck, BriefcaseBusiness, CalendarCheck2, CalendarDays, Check, Download, FileText, IdCard, Info, QrCode, ShieldAlert, UserRound } from "lucide-react";

export type CardViewData = { firstName: string; paternalLastName: string; maternalLastName: string | null; name: string; code: string | null; category: string | null; photoUrl: string | null; source: "NEW" | "MIGRATED" | null; eligible: boolean; reason: string | null; notFound: boolean };
export type CardViewState = { generated: boolean; status: "ISSUED" | "REVOKED" | null; verificationToken: string | null; revokedAt: string | null; revokedReason: string | null };

function useQr(url: string | null) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  useEffect(() => { if (!url) { setDataUrl(null); return; } let cancelled = false; QRCode.toDataURL(url, { width: 320, margin: 1, errorCorrectionLevel: "H" }).then(value => !cancelled && setDataUrl(value)).catch(() => !cancelled && setDataUrl(null)); return () => { cancelled = true; }; }, [url]);
  return dataUrl;
}

function CardFace({ data, verificationUrl, mode = "issued" }: { data: CardViewData; verificationUrl: string | null; mode?: "issued" | "preview" }) {
  const issued = mode === "issued";
  const qr = useQr(issued ? verificationUrl : null);
  const category = data.category ?? "Por confirmar";
  const code = data.code ?? "Pendiente de sincronización SIE";

  return <article className="group relative isolate aspect-[1.7/1] w-full overflow-hidden rounded-[22px] border border-slate-200 bg-white shadow-[0_18px_45px_-24px_rgba(20,35,61,0.5)] transition duration-200 motion-safe:hover:-translate-y-0.5 motion-safe:hover:shadow-[0_24px_50px_-24px_rgba(20,35,61,0.6)]">
    <div className="absolute inset-x-0 top-0 h-[24%] bg-gradient-to-r from-white 48% via-[#f8f1e3] 63% to-[#a87924]" />
    <div className="absolute left-[61%] top-0 h-[24%] w-9 -skew-x-[28deg] border-l border-white/70 bg-white/30" />
    <div className="absolute bottom-[-32%] left-[-4%] h-[52%] w-[76%] rounded-[50%] border border-[#c5953e]/25" />
    <div className="absolute bottom-[-38%] left-[16%] h-[56%] w-[72%] rounded-[50%] border border-[#c5953e]/15" />
    <div className="relative grid h-full grid-rows-[24%_1fr_14%]">
      <header className="flex items-center justify-between gap-4 px-5 sm:px-7">
        <img src="/images/logo-iimp.png" alt="Instituto de Ingenieros de Minas del Perú" className="h-11 w-auto max-w-[52%] object-contain sm:h-14" />
        <p className="pr-1 text-right text-[10px] font-semibold tracking-[0.22em] text-white sm:text-xs">CARNET<br className="sm:hidden" /> INSTITUCIONAL</p>
      </header>
      <div className="grid min-h-0 grid-cols-[minmax(62px,0.8fr)_minmax(0,2.3fr)_minmax(76px,1fr)] items-center gap-3 px-4 py-2 sm:grid-cols-[minmax(108px,1fr)_minmax(0,2.7fr)_minmax(116px,1.15fr)] sm:gap-5 sm:px-7 sm:py-3">
        <div className="aspect-[.78] max-h-[132px] self-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50 shadow-sm sm:rounded-2xl">{data.photoUrl ? <img src={data.photoUrl} alt={`Fotografía de ${data.name}`} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center"><UserRound className="h-8 w-8 text-slate-300 sm:h-11 sm:w-11" /></div>}</div>
        <div className="min-w-0 self-center">
          <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-slate-500 sm:text-[11px]">Asociado IIMP</p>
          <h2 className="mt-1 line-clamp-2 break-words text-[15px] font-semibold leading-[1.12] text-[#14233D] sm:text-[22px]">{data.name || "—"}</h2>
          <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-[#f8f1e3] px-2 py-1 text-[9px] font-semibold text-[#936b2e] sm:px-2.5 sm:text-[11px]"><BadgeCheck size={12} />{category}</span>
          <div className="mt-2 border-t border-slate-200 pt-2 sm:mt-3 sm:pt-2.5">
            <div className="grid grid-cols-2 gap-y-2.5 sm:gap-y-3">
              <CardData icon={BriefcaseBusiness} label="Categoría" value={category} />
              <CardData className="border-l border-slate-200 pl-2.5 sm:pl-4" icon={IdCard} label="Código de asociado" value={code} />
              <CardData icon={CalendarDays} label="Vigencia" value="Por confirmar" />
              <CardData className="border-l border-slate-200 pl-2.5 sm:pl-4" icon={CalendarCheck2} label="Fecha de emisión" value="—" />
            </div>
          </div>
        </div>
        <div className="flex min-w-0 flex-col items-center gap-1 self-center border-l border-slate-200 pl-2 sm:gap-1.5 sm:pl-4">{issued && qr ? <img src={qr} alt="Código QR verificable" className="aspect-square w-full max-w-[112px] rounded-lg border border-slate-200 bg-white p-1 shadow-sm sm:max-w-[118px] sm:rounded-xl sm:p-1.5" /> : <div className="flex aspect-square w-full max-w-[112px] items-center justify-center rounded-lg border-2 border-dashed border-[#c5953e]/70 bg-white p-1 text-center text-[8px] font-medium leading-tight text-slate-500 sm:max-w-[118px] sm:rounded-xl sm:p-2 sm:text-[10px]"><QrCode className="mr-0.5 h-3.5 w-3.5 shrink-0 text-[#a87924] sm:mr-1 sm:h-4 sm:w-4" />QR pendiente de emisión</div>}<span className="text-center text-[8px] leading-tight text-slate-500 sm:text-[11px]">{issued ? "Escanear para verificar" : "Vista previa sin QR verificable"}</span></div>
      </div>
      <footer className="relative flex items-center gap-3 px-5 sm:px-7"><span className="h-6 border-l-2 border-[#c5953e]" /><span className="text-base font-semibold tracking-[0.2em] text-slate-700">IIMP</span><span className="border-l border-slate-300 pl-3 text-[8px] font-semibold uppercase tracking-[0.13em] text-slate-500 sm:text-[10px]">Instituto de Ingenieros<br />de Minas del Perú</span></footer>
    </div>
  </article>;
}

function CardData({ icon: Icon, label, value, className = "" }: { icon: typeof IdCard; label: string; value: string; className?: string }) {
  return <div className={`min-w-0 ${className}`}><p className="flex items-center gap-1 text-[7px] font-semibold uppercase tracking-[0.09em] text-slate-500 sm:text-[9px]"><Icon className="h-2.5 w-2.5 shrink-0 text-[#a87924] sm:h-3.5 sm:w-3.5" />{label}</p><p className="mt-0.5 break-words text-[8px] font-semibold leading-tight text-[#14233D] sm:text-[11px]">{value}</p></div>;
}

export { CardFace };

function StatusPanel({ data, issued, revoked }: { data: CardViewData; issued: boolean; revoked: boolean }) {
  const status = revoked ? "Credencial revocada" : issued ? "Carnet emitido" : "Vista previa — no emitido";
  const rows = [{ icon: CalendarDays, title: "Vigencia", value: "Por confirmar" }, { icon: IdCard, title: "Código de asociado", value: data.code ?? "Pendiente de sincronización SIE" }, { icon: QrCode, title: "QR verificable", value: issued ? "Disponible" : revoked ? "No disponible" : "Pendiente de emisión" }, { icon: UserRound, title: "Datos del asociado", value: data.name || "No disponible" }];
  return <aside id="card-status" className="rounded-[20px] border border-slate-200 bg-white p-5 shadow-[0_12px_35px_-28px_rgba(20,35,61,0.55)] sm:p-6"><div className="flex items-start justify-between gap-3"><div className="flex items-center gap-2.5"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#f8f1e3] text-[#a87924]"><Award size={18} /></span><h2 className="font-semibold text-[#14233D]">Estado del carnet</h2></div><span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${revoked ? "bg-red-50 text-red-700" : issued ? "bg-emerald-50 text-emerald-700" : "bg-[#f8f1e3] text-[#936b2e]"}`}>{status}</span></div><dl className="mt-5 divide-y divide-slate-100 border-t border-slate-100">{rows.map(({ icon: Icon, title, value }) => <div key={title} className="flex gap-3 py-4"><Icon size={17} className="mt-0.5 shrink-0 text-slate-400" /><div className="min-w-0"><dt className="text-sm font-medium text-[#14233D]">{title}</dt><dd className="mt-0.5 text-xs leading-5 text-slate-500">{value}</dd></div></div>)}</dl></aside>;
}

function Progress({ issued }: { issued: boolean }) { const steps = ["Diseño del carnet", "Emisión", "Activación del QR", "Carnet activo"]; const complete = issued ? 4 : 1; return <section className="rounded-[20px] border border-slate-200 bg-white p-5 shadow-[0_12px_35px_-28px_rgba(20,35,61,0.4)] sm:p-7"><h2 className="text-lg font-semibold text-[#14233D]">Proceso de emisión</h2><p className="mt-1 text-sm text-slate-500">Sigue las etapas para la emisión de tu carnet institucional.</p><ol className="mt-7 grid gap-5 sm:grid-cols-4 sm:gap-0">{steps.map((step, index) => { const done = index < complete; const current = index === complete; return <li key={step} className="relative flex items-center gap-3 sm:block sm:pr-4">{index < steps.length - 1 && <span className={`absolute left-4 top-8 h-[calc(100%-12px)] w-px sm:left-8 sm:top-8 sm:h-px sm:w-[calc(100%-1.5rem)] ${done ? "bg-[#c5953e]" : "bg-slate-200"}`} />}<span className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-xs ${done ? "border-[#c5953e] bg-[#c5953e] text-white" : current ? "border-[#c5953e] bg-[#f8f1e3] text-[#936b2e]" : "border-slate-200 bg-white text-slate-400"}`}>{done ? <Check size={15} /> : index + 1}</span><div className="sm:mt-3"><p className="text-sm font-medium text-[#14233D]">{step}</p><p className="text-xs text-slate-500">{done ? "Completado" : current ? "Pendiente" : "No iniciado"}</p></div></li>; })}</ol></section>; }

export function CardView({ data, card, issuanceEnabled }: { data: CardViewData | null; card: CardViewState | null; issuanceEnabled: boolean }) {
  const router = useRouter(); const [loading, setLoading] = useState(false); const [error, setError] = useState<string | null>(null);
  const generate = useCallback(async () => { setLoading(true); setError(null); try { const response = await fetch("/api/afiliaciones/carnet/me", { method: "POST" }); const body = await response.json(); if (!response.ok || !body.success) { setError(body.message || "No fue posible generar el carnet."); return; } router.refresh(); } catch { setError("No fue posible generar el carnet."); } finally { setLoading(false); } }, [router]);
  if (!data) return <EmptyNotice title="Mi carnet virtual" description="No se encontró la información de tu cuenta." />; if (data.notFound) return <EmptyNotice title="Mi carnet virtual" description="No se encontró una persona vinculada a tu cuenta." />;
  const issued = card?.generated === true && card.status === "ISSUED"; const revoked = card?.generated === true && card.status === "REVOKED"; const verificationUrl = issued && card?.verificationToken ? `${window.location.origin}/verificar-carnet/${card.verificationToken}` : null; const preview = !issued && !revoked && data.eligible;
  return <div className="w-full space-y-6 pb-4"><header className="relative overflow-hidden rounded-[22px] border border-slate-100 bg-gradient-to-r from-white via-white to-[#f8f1e3]/80 px-5 py-6 sm:px-7"><div className="flex items-center gap-4"><span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#f8f1e3] text-[#a87924]"><IdCard size={24} /></span><div><h1 className="text-2xl font-semibold tracking-tight text-[#14233D] sm:text-[32px]">Mi carnet virtual</h1><p className="mt-1 text-sm text-slate-500">Credencial institucional del IIMP.</p></div></div></header>{revoked ? <section className="rounded-[20px] border border-red-200 bg-red-50 p-6"><div className="flex items-center gap-2 text-red-700"><ShieldAlert size={19} /><h2 className="font-semibold">Credencial revocada</h2></div><p className="mt-2 text-sm text-red-700">{card?.revokedReason || "Esta credencial fue revocada."}</p></section> : !data.eligible ? <section className="rounded-[20px] border border-amber-200 bg-amber-50 p-6"><h2 className="font-semibold text-amber-900">Carnet no disponible</h2><p className="mt-2 text-sm leading-6 text-amber-800">{data.reason ?? "No se puede generar el carnet en este momento."}</p></section> : <><section className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-[0_20px_50px_-42px_rgba(20,35,61,0.6)] sm:p-6"><div className="grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,1fr)] xl:items-start"><div className="min-w-0 space-y-4"><CardFace data={data} verificationUrl={verificationUrl} mode={issued ? "issued" : "preview"} />{preview && <div className="flex gap-3 rounded-xl border border-[#ead7ab] bg-[#fdf8ec] p-3.5 text-sm text-[#73521d]"><Info size={18} className="mt-0.5 shrink-0" /><p><strong className="font-semibold">Vista previa — no emitido.</strong><span className="mt-0.5 block text-xs leading-5 text-[#876e43]">Este es el diseño de tu carnet institucional; aún no se emitió una credencial verificable.</span></p></div>}<div className="flex flex-col gap-3 sm:flex-row">{issued ? <a href="/api/afiliaciones/carnet/me/download" className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#a87924] px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-[#8f661d]"><Download size={16} /> Descargar PDF</a> : issuanceEnabled ? <button type="button" onClick={generate} disabled={loading} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#a87924] px-4 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-[#8f661d] disabled:opacity-60"><IdCard size={16} />{loading ? "Generando…" : "Generar mi carnet"}</button> : null}<button type="button" onClick={() => document.getElementById("card-status")?.scrollIntoView({ behavior: "smooth", block: "center" })} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-sm font-medium text-[#14233D] transition hover:bg-slate-50"><FileText size={16} /> Ver detalles</button></div>{error && <p className="text-sm text-red-600" role="alert">{error}</p>}</div><StatusPanel data={data} issued={issued} revoked={false} /></div></section><Progress issued={issued} /></>}</div>;
}

function EmptyNotice({ title, description }: { title: string; description: string }) { return <div className="w-full space-y-5"><header><h1 className="text-3xl font-semibold tracking-tight text-[#14233D]">{title}</h1></header><div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-10 text-center"><p className="text-sm text-slate-500">{description}</p></div></div>; }
