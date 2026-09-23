"use client";

import confetti from "canvas-confetti";
import { CheckCircle2, CreditCard, FileText, Home, Info, Mail, ReceiptText, UserRound } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef } from "react";
import type { ApplicationStatusData } from "../Models/ApplicationStatus";

interface Props { data: ApplicationStatusData; onFinish?: () => void; }

const formatDate = (value?: string | Date | null) => value
  ? new Intl.DateTimeFormat("es-PE", { dateStyle: "long", timeStyle: "short" }).format(new Date(value))
  : "No disponible";
const formatMoney = (amount: number, currency: string) => new Intl.NumberFormat("es-PE", { style: "currency", currency, minimumFractionDigits: 2 }).format(amount);
const membershipLabel = (type?: string) => type === "STUDENT" ? "Asociado Estudiante" : type === "ACTIVE" ? "Asociado Activo" : "No disponible";
const cardTypeLabel = (type?: string | null) => type === "C" ? "Crédito" : type === "D" ? "Débito" : type ?? "No disponible";
const paymentChannelLabel = (channel?: string | null, gateway?: string) => [gateway, channel].filter(Boolean).join(" · ") || "No disponible";
const valueOrUnavailable = (value?: string | null) => value || "No disponible";

export function StatusCompleted({ data, onFinish }: Props) {
  const student = data.affiliateType === "STUDENT";
  const payment = data.completedPayment;
  const billing = payment?.billing;
  const invoice = billing?.invoice;
  const personal = data.draftData?.personalInformation ?? {};
  const employment = data.draftData?.employmentInformation ?? {};
  const fullName = data.applicantName || [personal.names, personal.fatherLastName, personal.motherLastName].filter(Boolean).join(" ") || "No disponible";
  const document = data.documentNumber || personal.documentNumber;
  const email = data.email || personal.primaryEmail;
  const phone = data.phone || personal.phone;
  const confettiFired = useRef(false);

  useEffect(() => {
    if (confettiFired.current || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    confettiFired.current = true;
    const animationEnd = Date.now() + 2_000;
    const colors = ["#C5A059", "#E8D09E", "#D6A84A", "#2F3136", "#F7F8FA"];
    const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;
    const interval = window.setInterval(() => {
      const timeLeft = animationEnd - Date.now();
      if (timeLeft <= 0) { window.clearInterval(interval); return; }
      const particleCount = 70 * (timeLeft / 2_000);
      confetti({ startVelocity: 30, spread: 360, ticks: 60, zIndex: 150, particleCount, colors, origin: { x: randomInRange(0.05, 0.3), y: Math.random() * 0.25 } });
      confetti({ startVelocity: 30, spread: 360, ticks: 60, zIndex: 150, particleCount, colors, origin: { x: randomInRange(0.7, 0.95), y: Math.random() * 0.25 } });
    }, 180);
    return () => window.clearInterval(interval);
  }, []);

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#F7F8FA] font-sans text-[#1E293B]">
      <div className="relative min-h-[22rem] overflow-hidden bg-[#2a1700] text-white">
        <div className="absolute inset-0 bg-gradient-to-br from-[#2a1700] via-[#C5A059]/90 to-[#4a2d00]" />
        <div className="absolute inset-0 bg-cover bg-center opacity-20 mix-blend-overlay" style={{ backgroundImage: "url('/images/minero.jpg')" }} />
        <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-[#F7F8FA] to-transparent" />
        <div className="relative z-10 mx-auto w-full max-w-5xl px-6 py-7"><Image src="/images/logo-iimp.png" alt="IIMP Logo" width={180} height={64} className="h-12 w-auto brightness-0 invert drop-shadow-md" /></div>
      </div>

      <section className="relative z-20 mx-auto -mt-56 w-full max-w-5xl px-4 pb-14 sm:px-6">
        <div className="overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-2xl">
          <div className="h-2 bg-gradient-to-r from-[#C5A059] to-[#E8D09E]" />
          <header className="px-6 pb-8 pt-9 text-center sm:px-10">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border-4 border-emerald-100 bg-emerald-50 shadow-sm"><CheckCircle2 className="h-10 w-10 text-emerald-500" /></div>
            <span className="mt-5 inline-block rounded-full border border-[#C5A059]/20 bg-[#C5A059]/10 px-4 py-1.5 text-xs font-bold tracking-widest text-[#9A7024]">{student ? "AFILIACIÓN SIN COSTO" : "PAGO REALIZADO CON ÉXITO"}</span>
            <h1 className="mt-4 text-3xl font-black tracking-tight text-[#1E293B] sm:text-4xl">¡Tu afiliación ha sido completada!</h1>
            <p className="mx-auto mt-3 max-w-2xl text-base font-medium leading-relaxed text-slate-500">{student ? "Tu inscripción no tiene costo y tu proceso de afiliación ha finalizado." : "El pago fue procesado correctamente y tu proceso de afiliación ha finalizado."}</p>
            <span className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-black tracking-wide text-emerald-700"><CheckCircle2 size={14} /> COMPLETADA</span>
          </header>

          <div className="space-y-5 border-t border-slate-100 px-5 py-6 sm:px-8 sm:py-8">
            <Panel icon={<UserRound size={18} />} title="Datos del asociado">
              <dl className="grid gap-x-7 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
                <Field label="Nombre completo" value={fullName} /><Field label="Documento" value={valueOrUnavailable(document)} /><Field label="Correo" value={valueOrUnavailable(email)} />
                <Field label="Teléfono" value={valueOrUnavailable(phone)} /><Field label="Tipo de afiliación" value={membershipLabel(data.affiliateType)} /><Field label="Código de expediente" value={valueOrUnavailable(data.applicationCode)} emphasis />
                <Field label="Fecha de postulación" value={formatDate(data.submissionDate)} />
                {employment.companyName && <Field label="Empresa" value={employment.companyName} />}{employment.positionName && <Field label="Cargo" value={employment.positionName} />}
              </dl>
            </Panel>

            <section className="rounded-2xl border border-[#E6C982] bg-[#FFFCF6] p-5 shadow-sm"><p className="text-[11px] font-black uppercase tracking-widest text-[#8A671D]">Código de seguimiento</p><p className="mt-2 break-all font-mono text-lg font-black tracking-wide text-[#1E293B] sm:text-xl">{valueOrUnavailable(data.trackingCode)}</p></section>

            {payment && <Panel icon={<CreditCard size={18} />} title="Resumen del pago" accent>
              <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
                <dl className="grid gap-x-7 gap-y-5 sm:grid-cols-2">
                  <Field label="ID de transacción" value={valueOrUnavailable(payment.transactionId)} /><Field label="Fecha del pago" value={formatDate(payment.gatewayTransactionDate ?? payment.paymentDate)} />
                  <Field label="Método / canal" value={paymentChannelLabel(payment.paymentChannel, payment.gateway)} /><Field label="Tarjeta / marca" value={payment.cardBrand ? `${payment.cardBrand} · ${cardTypeLabel(payment.cardType)}` : cardTypeLabel(payment.cardType)} />
                  {payment.maskedCard && <Field label="Tarjeta enmascarada" value={payment.maskedCard} />}<Field label="Moneda" value={payment.currency} />
                  {payment.authorizationCode && <Field label="Código de autorización" value={payment.authorizationCode} />}{payment.traceNumber && <Field label="Trace number" value={payment.traceNumber} />}
                </dl>
                <div className="rounded-2xl border border-[#F0DFB6] bg-[#FFF7E6] px-7 py-6 text-center lg:min-w-56">{payment.registrationAmount != null && <p className="text-sm font-bold text-[#6E4B12]">Inscripción: {formatMoney(payment.registrationAmount, payment.currency)}</p>}{payment.membershipFeeAmount != null && <p className="mt-1 text-sm font-bold text-[#6E4B12]">Cuota de afiliación: {formatMoney(payment.membershipFeeAmount, payment.currency)}</p>}<p className="mt-3 text-[11px] font-black uppercase tracking-widest text-[#8A671D]">Total pagado</p><p className="mt-2 text-3xl font-black text-[#6E4B12]">{formatMoney(payment.amount, payment.currency)}</p><span className="mt-3 inline-flex rounded-full bg-emerald-100 px-3 py-1 text-[10px] font-black tracking-wide text-emerald-700">PAGADO</span></div>
              </div>
            </Panel>}

            {student && !payment && <Panel icon={<CreditCard size={18} />} title="Resumen del pago"><p className="text-sm font-bold text-slate-700">Inscripción sin costo</p></Panel>}

            {billing && <Panel icon={<ReceiptText size={18} />} title="Datos de facturación"><dl className="grid gap-x-7 gap-y-5 sm:grid-cols-2 lg:grid-cols-3"><Field label="Documento" value={billing.taxId.length === 11 ? "RUC" : "DNI"} /><Field label="Número de documento" value={billing.taxId} /><Field label="Razón social / nombre" value={billing.businessName} /><Field label="Dirección" value={valueOrUnavailable(billing.billingAddress)} /><Field label="Correo" value={valueOrUnavailable(billing.billingEmail)} /></dl></Panel>}

            {invoice && <Panel icon={<FileText size={18} />} title="Comprobante">
              <dl className="grid gap-x-7 gap-y-5 sm:grid-cols-2 lg:grid-cols-3"><Field label="Tipo" value={invoice.type} /><Field label="Serie" value={invoice.serie} /><Field label="Número" value={invoice.number} /><Field label="Fecha de emisión" value={formatDate(invoice.issueDate)} /></dl>
              {(invoice.pdfUrl || invoice.xmlUrl || invoice.sunatCdrUrl) && <div className="mt-5 flex flex-wrap gap-3 border-t border-slate-100 pt-5">{invoice.pdfUrl && <DocumentLink href={invoice.pdfUrl} label="Ver PDF" />}{invoice.xmlUrl && <DocumentLink href={invoice.xmlUrl} label="Descargar XML" />}{invoice.sunatCdrUrl && <DocumentLink href={invoice.sunatCdrUrl} label="Ver CDR" />}</div>}
            </Panel>}

            {!student && !invoice && <section className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50/70 p-5 text-amber-900"><Info size={18} className="mt-0.5 shrink-0 text-amber-600" /><div><p className="text-sm font-black">Comprobante pendiente de emisión</p><p className="mt-1 text-xs leading-5 text-amber-800">Te notificaremos por correo cuando el comprobante esté disponible.</p></div></section>}

            <Panel icon={<Mail size={18} />} title="Acceso al portal del asociado"><div className="rounded-xl border border-blue-100 bg-blue-50/60 p-4 text-sm text-blue-800"><p className="font-semibold">Tus credenciales de acceso serán enviadas al correo registrado.</p><p className="mt-1 text-blue-700/80">Revisa también la carpeta de spam o correo no deseado.</p></div></Panel>

            <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-6 sm:flex-row sm:justify-end"><Link href="/" className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-6 text-sm font-bold text-slate-700 transition hover:bg-slate-50"><Home size={17} /> Volver al inicio</Link>{onFinish && <button type="button" onClick={onFinish} className="h-12 rounded-xl bg-[#C79A3B] px-8 text-sm font-extrabold text-white shadow-sm transition hover:bg-[#B07F43]">Cerrar / Finalizar</button>}</div>
          </div>
        </div>
      </section>
    </main>
  );
}

function Panel({ icon, title, accent = false, children }: { icon: React.ReactNode; title: string; accent?: boolean; children: React.ReactNode }) {
  return <section className={`rounded-2xl border p-5 ${accent ? "border-[#E6C982] bg-[#FFFCF6]" : "border-slate-200 bg-white"}`}><div className="mb-5 flex items-center gap-2 border-b border-slate-100 pb-3 text-[#C5A059]"><span>{icon}</span><h2 className="text-sm font-black uppercase tracking-wide text-[#2F3136]">{title}</h2></div>{children}</section>;
}

function Field({ label, value, emphasis = false }: { label: string; value: string; emphasis?: boolean }) {
  return <div><dt className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{label}</dt><dd className={`mt-1 break-words text-sm font-semibold ${emphasis ? "font-mono text-[#9A7024]" : "text-slate-800"}`}>{value}</dd></div>;
}

function DocumentLink({ href, label }: { href: string; label: string }) {
  return <a href={href} target="_blank" rel="noreferrer" className="rounded-xl border border-[#E6C982] bg-white px-4 py-2 text-xs font-bold text-[#936B2E] transition hover:bg-[#FFF8E8]">{label}</a>;
}
