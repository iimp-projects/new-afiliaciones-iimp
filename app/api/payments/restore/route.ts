import { NextResponse } from "next/server";
import { PaymentRepository } from "@/modules/afiliaciones/payments/Repositories/PaymentRepository";
import { paymentAuthorizationService } from "@/modules/afiliaciones/payments/Services/PaymentAuthorizationService";
import { getNiubizActionCode } from "@/modules/afiliaciones/payments/Services/Niubiz/NiubizActionCodes";

export async function GET(request: Request) {
  const reference = paymentAuthorizationService.verifyCallbackReference(new URL(request.url).searchParams.get("payment_callback") ?? undefined);
  if (!reference) return NextResponse.json({ message: "La referencia de pago no es válida o expiró." }, { status: 403 });

  const payment = await new PaymentRepository().findPaymentConfirmationDetails(reference.paymentId);
  if (!payment || payment.applicationId !== reference.applicationId) return NextResponse.json({ message: "El pago no corresponde a la solicitud." }, { status: 404 });
  if (!(["FAILED", "PENDING", "PAID"] as const).includes(payment.status as "FAILED" | "PENDING" | "PAID")) return NextResponse.json({ message: "El estado del pago no puede restaurarse." }, { status: 409 });

  const action = payment.status === "FAILED" ? getNiubizActionCode(payment.actionCode ?? payment.failureCode) : undefined;
  return NextResponse.json({
    application: {
      id: payment.applicationId,
      applicationId: payment.applicationId,
      status: payment.application.status,
      applicationCode: payment.application.applicationCode,
      affiliateType: payment.application.affiliateType,
      applicantName: payment.application.person ? `${payment.application.person.firstName} ${payment.application.person.paternalLastName}` : undefined,
      draftData: payment.application.draftData,
      areas: { sponsors: { status: "PENDING", approvedCount: 0, requiredCount: 2 }, associates: { status: "PENDING" }, logistics: { status: "PENDING" }, board: { status: "PENDING" }, payment: { status: "PENDING" } },
    },
    billingData: payment.billing ? { tipoDocumento: payment.billing.taxId.length === 11 ? "RUC" : "DNI", numeroDocumento: payment.billing.taxId, razonSocial: payment.billing.businessName, direccionFiscal: payment.billing.billingAddress ?? "", responsable: payment.application.person ? `${payment.application.person.firstName} ${payment.application.person.paternalLastName}` : "Postulante", emailFacturacion: payment.billing.billingEmail ?? payment.application.email } : null,
    payment: { id: payment.id, status: payment.status, amount: payment.totalAmount, currency: payment.currency, paymentDate: payment.paymentDate, transactionId: payment.transactionId, authorizationCode: payment.authorizationCode, cardBrand: payment.cardBrand, cardType: payment.cardType, maskedCard: payment.maskedCard, traceNumber: payment.traceNumber },
    failure: payment.status === "FAILED" ? { code: payment.actionCode ?? payment.failureCode, message: action?.userMessage ?? payment.failureReason ?? "La operación fue rechazada por Niubiz." } : null,
  });
}
