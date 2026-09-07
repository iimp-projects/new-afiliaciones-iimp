import Link from "next/link";
import { PaymentRepository } from "@/modules/afiliaciones/payments/Repositories/PaymentRepository";
import { paymentAuthorizationService } from "@/modules/afiliaciones/payments/Services/PaymentAuthorizationService";
import { getNiubizActionCode } from "@/modules/afiliaciones/payments/Services/Niubiz/NiubizActionCodes";

export default async function PaymentNotConfirmedPage({ searchParams }: { searchParams: Promise<{ payment_callback?: string }> }) {
  const { payment_callback: callbackReference } = await searchParams;
  const reference = paymentAuthorizationService.verifyCallbackReference(callbackReference);
  const payment = reference ? await new PaymentRepository().findPaymentConfirmationDetails(reference.paymentId) : null;
  const isFailure = payment?.applicationId === reference?.applicationId && payment.status === "FAILED";
  const action = isFailure ? getNiubizActionCode(payment.actionCode ?? payment.failureCode) : undefined;
  const reason = action?.userMessage ?? payment?.failureReason;

  if (!isFailure || !payment) {
    return <main className="min-h-screen grid place-items-center bg-slate-50 p-6"><section className="max-w-md rounded-3xl bg-white p-8 text-center shadow"><h1 className="text-2xl font-black text-slate-800">No pudimos confirmar el pago</h1><p className="mt-3 text-slate-600">Tu pago no fue confirmado. Puedes volver a consultar tu solicitud para reintentar cuando corresponda.</p><Link href="/consulta" className="mt-6 inline-block rounded-xl bg-[#C5A059] px-6 py-3 font-bold text-white">VOLVER A CONSULTA</Link></section></main>;
  }

  return <main className="min-h-screen grid place-items-center bg-slate-50 p-6"><section className="w-full max-w-md rounded-3xl bg-white p-8 text-center shadow"><p className="font-bold tracking-widest text-rose-600">PAGO NO APROBADO</p><h1 className="mt-3 text-2xl font-black text-slate-800">Pago rechazado</h1><p className="mt-3 text-slate-700">{reason ?? "La operación fue rechazada por Niubiz."}</p><p className="mt-2 text-sm text-slate-500">Puedes intentar nuevamente utilizando otra tarjeta.</p><Link href="/consulta" className="mt-6 inline-block rounded-xl bg-[#C5A059] px-6 py-3 font-bold text-white">INTENTAR NUEVAMENTE</Link>{payment.actionCode && <p className="mt-5 text-xs text-slate-500">Código Niubiz para soporte: {payment.actionCode}</p>}</section></main>;
}
