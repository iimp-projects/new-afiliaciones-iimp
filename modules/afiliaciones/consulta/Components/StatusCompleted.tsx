"use client";

import confetti from "canvas-confetti";
import { CheckCircle2, CreditCard, FileText, Info, Mail, UserRound } from "lucide-react";
import Image from "next/image";
import { useEffect, useRef } from "react";
import type { ApplicationStatusData } from "../Models/ApplicationStatus";

interface Props { data: ApplicationStatusData; onFinish?: () => void; }
const date = (value?: string | Date | null) => value ? new Intl.DateTimeFormat("es-PE", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : undefined;
const money = (amount: number, currency: string) => new Intl.NumberFormat("es-PE", { style: "currency", currency, minimumFractionDigits: 2 }).format(amount).replace(currency, "S/");
const cardType = (value?: string | null) => value === "C" ? "Crédito" : value === "D" ? "Débito" : value;

export function StatusCompleted({ data, onFinish }: Props) {
  const payment = data.completedPayment;
  const billing = payment?.billing;
  const invoice = billing?.invoice;
  const student = data.affiliateType === "STUDENT";
  const personal = data.draftData?.personalInformation ?? {};
  const confettiFired = useRef(false);

  useEffect(() => {
    if (confettiFired.current || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    confettiFired.current = true;
    const duration = 2 * 1000;
    const animationEnd = Date.now() + duration;
    const colors = ["#C5A059", "#E8D09E", "#D6A84A", "#2F3136", "#F7F8FA"];
    const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;
    const interval = window.setInterval(() => {
      const timeLeft = animationEnd - Date.now();
      if (timeLeft <= 0) { window.clearInterval(interval); return; }
      const particleCount = 70 * (timeLeft / duration);
      confetti({ startVelocity: 30, spread: 360, ticks: 60, zIndex: 150, particleCount, colors, origin: { x: randomInRange(0.05, 0.3), y: Math.random() * 0.25 } });
      confetti({ startVelocity: 30, spread: 360, ticks: 60, zIndex: 150, particleCount, colors, origin: { x: randomInRange(0.7, 0.95), y: Math.random() * 0.25 } });
    }, 180);
    return () => window.clearInterval(interval);
  }, []);

  return <main className="min-h-screen overflow-x-hidden bg-[#F7F8FA] font-sans text-slate-800">
    <div className="relative overflow-hidden bg-[#2a1700] text-white">
      <div className="absolute inset-0 z-0 bg-gradient-to-br from-[#2a1700] via-[#C5A059]/90 to-[#4a2d00]" />
      <div className="absolute inset-0 z-0 bg-cover bg-center opacity-20 mix-blend-overlay" style={{ backgroundImage: "url('/images/minero.jpg')" }} />
      <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-[#F7F8FA] to-transparent" />
      <nav className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-7"><Image src="/images/logo-iimp.png" alt="IIMP Logo" width={180} height={64} className="h-12 w-auto brightness-0 invert drop-shadow-md" /></nav>
      <div className="relative z-10 mx-auto max-w-6xl px-6 pb-16 text-center"><span className="inline-block rounded-full border border-white/25 bg-white/10 px-4 py-1.5 text-xs font-bold uppercase tracking-widest backdrop-blur-md">Portal Oficial de Afiliaciones</span><CheckCircle2 className="mx-auto mt-7 h-14 w-14 text-emerald-300 drop-shadow" /><h1 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">¡Bienvenido al IIMP!</h1><p className="mt-1 text-xl font-black">Afiliación completada</p><p className="mx-auto mt-3 max-w-xl text-sm text-white/90">Tu proceso de afiliación ha finalizado correctamente.</p><p className="text-sm text-white/90">{student ? "Tu inscripción no tiene costo." : "El pago fue confirmado y tu incorporación como asociado fue completada."}</p></div>
    </div>
    <section className="relative z-20 mx-auto -mt-8 w-full max-w-6xl px-4 pb-12 sm:px-6"><div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-xl sm:p-8 lg:p-10">
      <header className="flex flex-col gap-3 border-b border-slate-100 pb-6 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-[11px] font-black uppercase tracking-widest text-slate-400">N° de expediente</p><p className="mt-1 font-mono text-xl font-black tracking-wide text-[#C5A059]">{data.applicationCode}</p></div><div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-left sm:text-right"><span className="inline-flex items-center gap-1.5 text-xs font-black text-emerald-700"><CheckCircle2 size={15} /> AFILIACIÓN COMPLETADA</span><p className="mt-1 text-xs font-bold text-emerald-800">{student ? "Asociado Estudiante" : "Asociado Activo"}</p></div></header>
      <div className="mt-6 space-y-5">
      <Panel icon={<FileText size={18} />} title="Detalle de afiliación"><dl className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4"><Row label="Tipo de afiliación" value={student ? "Asociado Estudiante" : "Asociado Activo"} /><Row label="Fecha de incorporación" value={date(data.submissionDate)} /><Row label="Código de asociado" value={data.applicationCode} /><Row label="Estado institucional" value={data.status === "COMPLETED" ? "Afiliación completada" : data.status} /><Row label="Categoría" value={data.affiliateType} /></dl></Panel>
      <div className="grid gap-5 lg:grid-cols-2"><Panel icon={<UserRound size={18} />} title="Datos del asociado"><dl className="grid gap-5 sm:grid-cols-2"><Row label="Nombre completo" value={data.applicantName} /><Row label="Documento" value={personal.documentNumber} /><Row label="Correo" value={personal.email} /><Row label="Teléfono" value={personal.phone} /><Row label="Empresa" value={personal.company} /><Row label="Cargo" value={personal.position} /></dl></Panel>{!student && payment ? <Panel icon={<CreditCard size={18} />} title="Resumen del pago"><div className="mb-5 flex items-end justify-between border-b border-slate-100 pb-4"><div><p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Estado</p><span className="mt-1 inline-flex rounded-full bg-emerald-50 px-3 py-1 text-[10px] font-black text-emerald-700">PAGADO</span></div><p className="text-3xl font-black text-[#8A671D]">{money(payment.amount, payment.currency)}</p></div><dl className="grid gap-5 sm:grid-cols-2"><Row label="Fecha" value={date(payment.gatewayTransactionDate ?? payment.paymentDate)} /><Row label="Pasarela" value={payment.gateway} /><Row label="Marca" value={payment.cardBrand} /><Row label="Tipo" value={cardType(payment.cardType)} /><Row label="Tarjeta" value={payment.maskedCard} /></dl></Panel> : <Panel icon={<CreditCard size={18} />} title="Resumen del pago"><p className="text-sm font-bold text-slate-700">Inscripción sin costo</p></Panel>}</div>
      {!student && payment && <Panel icon={<CreditCard size={18} />} title="Detalle de la transacción"><dl className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4"><Row label="Transaction ID" value={payment.transactionId} /><Row label="Trace Number" value={payment.traceNumber} /><Row label="Código de autorización" value={payment.authorizationCode} /><Row label="Fecha Niubiz" value={date(payment.gatewayTransactionDate)} /><Row label="Canal" value="web" /></dl></Panel>}
      {!student && <Panel icon={<FileText size={18} />} title="Comprobante solicitado">{billing ? <div className="grid gap-5 lg:grid-cols-2"><div className="space-y-3 text-sm"><Badge text={billing.taxId.length === 11 ? "FACTURA" : "BOLETA DE VENTA"} /><Row label={billing.taxId.length === 11 ? "Razón social" : "Nombre"} value={billing.businessName} /><Row label={billing.taxId.length === 11 ? "RUC" : "Documento"} value={billing.taxId} /><Row label="Dirección fiscal" value={billing.billingAddress} />{invoice && <div className="border-t border-slate-100 pt-3"><Row label="Comprobante" value={`${invoice.serie}-${invoice.number}`} /><Row label="Fecha de emisión" value={date(invoice.issueDate)} />{invoice.pdfUrl && <a className="mt-3 inline-block rounded-xl bg-[#C5A059] px-4 py-2 text-xs font-bold text-white" href={invoice.pdfUrl} target="_blank" rel="noreferrer">Ver comprobante</a>}</div>}</div>{!invoice && <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50/70 p-4 text-amber-900"><Info size={18} className="mt-0.5 shrink-0 text-amber-600" /><div><p className="text-sm font-black">Comprobante pendiente de emisión</p><p className="mt-1 text-xs leading-5 text-amber-800">Te notificaremos por correo cuando el comprobante esté disponible.</p></div></div>}</div> : <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50/70 p-4 text-amber-900"><Info size={18} className="mt-0.5 shrink-0 text-amber-600" /><div><p className="text-sm font-black">Comprobante pendiente de emisión</p><p className="mt-1 text-xs leading-5 text-amber-800">Te notificaremos por correo cuando el comprobante esté disponible.</p></div></div>}</Panel>}
      <Panel icon={<Mail size={18} />} title="Acceso al portal del asociado"><div className="rounded-xl border border-blue-100 bg-blue-50/60 p-4 text-sm text-blue-800"><p className="font-semibold">Tus credenciales de acceso serán enviadas al correo registrado.</p><p className="mt-1 text-blue-700/80">Revisa también la carpeta de spam o correo no deseado.</p></div></Panel>
      {onFinish && <div className="border-t border-slate-100 pt-5"><button type="button" onClick={onFinish} className="h-12 w-full rounded-xl bg-[#C79A3B] px-6 text-sm font-extrabold text-white shadow-sm transition hover:bg-[#B07F43]">Finalizar</button></div>}
      </div>
    </div></section>
  </main>;
}

function Panel({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) { return <section className="rounded-2xl border border-slate-200 bg-white p-5"><div className="mb-5 flex items-center gap-2 border-b border-slate-100 pb-3 text-[#C5A059]"><span>{icon}</span><h2 className="text-sm font-black uppercase tracking-wide text-slate-800">{title}</h2></div>{children}</section>; }
function Row({ label, value }: { label: string; value?: unknown }) { if (value === undefined || value === null || value === "") return null; return <div><dt className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{label}</dt><dd className="mt-1 text-sm font-semibold text-slate-800">{String(value)}</dd></div>; }
function Badge({ text, amber = false }: { text: string; amber?: boolean }) { return <span className={`inline-flex rounded-full px-3 py-1 text-[10px] font-black tracking-wide ${amber ? "bg-amber-50 text-amber-700" : "bg-[#FFF8E8] text-[#8A671D]"}`}>{text}</span>; }
