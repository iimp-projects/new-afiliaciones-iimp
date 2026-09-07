"use client";

import { CheckCircle2, XCircle } from "lucide-react";
import { NiubizCheckout } from "@/modules/afiliaciones/payments/Components/NiubizCheckout";
import { PaymentLoadingOverlay } from "@/modules/afiliaciones/payments/Components/PaymentLoadingOverlay";
import type { BillingDataInput } from "@/modules/afiliaciones/payments/DTOs/billing.schema";
import type { CreatePaymentResponse } from "@/modules/afiliaciones/payments/Models/PaymentResponse";

export type PaymentUiState = "IDLE" | "PREPARING_CHECKOUT" | "CHECKOUT_OPEN" | "PROCESSING_PAYMENT" | "CHECKOUT_ERROR" | "PAYMENT_FAILED" | "PAYMENT_SUCCESS" | "PAYMENT_UNCERTAIN";
interface Details { transactionId?: string; authorizationCode?: string; }
interface Props { billingData: BillingDataInput; confirmed: boolean; onConfirmedChange: (v: boolean) => void; result: CreatePaymentResponse | null; loading: boolean; error: string | null; onRetry: () => void; paymentUiState: PaymentUiState; onCheckoutStateChange: (s: PaymentUiState) => void; failureMessage?: string | null; failureCode?: string | null; restoredPayment?: Details | null; affiliateType?: string; onFinish?: () => void; }

export default function PaymentProcessStep({ billingData, confirmed, onConfirmedChange, result, loading, error, onRetry, paymentUiState, onCheckoutStateChange, failureMessage, failureCode, restoredPayment, affiliateType, onFinish }: Props) {
  const isInvoice = billingData.tipoDocumento === "RUC";
  const amount = result ? `S/ ${result.amount.toFixed(2)}` : "Monto protegido en el servidor";
  const interactionLocked = ["PREPARING_CHECKOUT", "CHECKOUT_OPEN", "PROCESSING_PAYMENT"].includes(paymentUiState);
  const checkoutBlocked = !confirmed || interactionLocked;
  return <section className="relative overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm" aria-busy={interactionLocked}>
    <div className="border-b bg-[#f4f5f7] px-8 py-5 text-center"><h3 className="text-sm font-bold text-slate-800">Finalizar inscripción y pago</h3></div>
    <div className="mx-auto max-w-xl space-y-5 p-6 sm:p-8">
      {paymentUiState === "PAYMENT_FAILED" && <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800"><div className="flex items-center gap-2 font-black"><XCircle size={18}/>Pago no aprobado</div><p className="mt-1">{failureMessage ?? "Verifica los datos o intenta nuevamente con otra tarjeta."}</p>{failureCode && <p className="mt-2 text-xs font-bold">Código de soporte: {failureCode}</p>}</div>}
      <div className="rounded-2xl border border-[#E8D09E] bg-[#FCFAF6] p-5"><p className="mb-4 text-xs font-black uppercase tracking-wide text-[#9A7739]">Resumen final antes del pago</p><dl className="space-y-3 text-sm"><div><dt className="font-bold text-slate-500">Participante / Razón social</dt><dd className="mt-0.5 font-bold uppercase text-slate-800">{billingData.razonSocial}</dd></div><div><dt className="font-bold text-slate-500">Categoría / Tipo de afiliación</dt><dd className="mt-0.5 font-bold text-slate-800">{affiliateType ?? "No disponible"}</dd></div><div className="flex justify-between border-t border-[#E8D09E]/60 pt-3"><dt>Inscripción</dt><dd className="font-bold">{amount}</dd></div><div className="flex justify-between border-t border-[#E8D09E]/60 pt-3"><dt className="font-black uppercase">Total a pagar</dt><dd className="text-lg font-black text-[#9A7739]">{amount}</dd></div></dl></div>
      <div className="rounded-2xl border border-[#E8D09E] bg-[#FFFCF5] p-5"><div className="flex items-center gap-2 text-sm font-black text-[#9A7739]"><CheckCircle2 size={17}/>Confirmación de {isInvoice ? "Factura" : "Boleta de Venta"}</div><p className="mt-3 text-sm font-semibold leading-relaxed text-slate-700">{isInvoice ? <>Usted está solicitando una <strong>FACTURA COMERCIAL</strong> a nombre de <strong>{billingData.razonSocial}</strong> con RUC <strong>{billingData.numeroDocumento}</strong>.</> : <>Usted está solicitando una <strong>BOLETA DE VENTA</strong> a nombre de <strong>{billingData.razonSocial}</strong>.</>}</p><p className="mt-3 text-xs italic text-rose-700">Antes de continuar, asegúrate de que tus datos estén correctos. Una vez emitido el comprobante, no podremos realizar cambios ni devoluciones.</p><label className="mt-4 flex items-start gap-3 border-t border-[#E8D09E]/60 pt-4"><input type="checkbox" disabled={interactionLocked} checked={confirmed} onChange={(event) => onConfirmedChange(event.target.checked)} className="mt-0.5 h-5 w-5 accent-[#C5A059] disabled:cursor-not-allowed"/><span className="text-xs font-bold text-slate-700">Confirmo que los datos de facturación son correctos y asumo la responsabilidad sobre la emisión de este documento.</span></label></div>
      {paymentUiState === "PAYMENT_UNCERTAIN" && <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800"><p className="font-black">Estamos verificando tu pago</p><p>No pudimos confirmar inmediatamente el resultado. No realices otro pago todavía.</p></div>}
      {paymentUiState === "PAYMENT_SUCCESS" && result && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-900"><p className="font-black">Pago realizado correctamente</p><p className="mt-2">Monto: {amount}</p><p>Operación: {restoredPayment?.transactionId ?? "No disponible"}</p><p>Código de autorización: {restoredPayment?.authorizationCode ?? "No disponible"}</p><button type="button" onClick={onFinish} className="mt-4 rounded-xl bg-[#C5A059] px-4 py-2 font-bold text-white">Finalizar</button></div>}
      {loading && paymentUiState !== "PREPARING_CHECKOUT" && <div className="rounded-2xl border border-[#E8D09E] bg-[#FCFAF6] p-5 text-sm font-bold text-slate-700">Preparando pago...</div>}
      {paymentUiState === "CHECKOUT_ERROR" && <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm font-bold text-red-700"><p>No pudimos abrir la pasarela</p><p>Intenta nuevamente en unos segundos.</p></div>}
      {error && <p className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm font-bold text-red-700">{error}</p>}
      {result?.checkout && <NiubizCheckout key={result.checkout.sessionToken + ":" + result.checkout.purchaseNumber} config={result.checkout} disabled={checkoutBlocked} onStateChange={onCheckoutStateChange}/>} 
      {paymentUiState === "PAYMENT_FAILED" && <button type="button" onClick={onRetry} className="w-full rounded-xl bg-[#C5A059] px-4 py-3 text-sm font-extrabold text-white">Intentar nuevamente</button>}
    </div>
    {paymentUiState === "PREPARING_CHECKOUT" && <PaymentLoadingOverlay title="Preparando pago" description="Estamos conectando con la pasarela segura de Niubiz." secondaryText="Esto puede tardar unos segundos." />}
    {paymentUiState === "PROCESSING_PAYMENT" && <PaymentLoadingOverlay title="Procesando tu pago" description="Estamos confirmando la operación con Niubiz." secondaryText="No cierres esta ventana ni actualices la página." />}
  </section>;
}
