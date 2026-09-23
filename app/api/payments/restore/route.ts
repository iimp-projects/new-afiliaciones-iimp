import { NextResponse } from "next/server";
import { PaymentRepository } from "@/modules/afiliaciones/payments/Repositories/PaymentRepository";
import { paymentAuthorizationService } from "@/modules/afiliaciones/payments/Services/PaymentAuthorizationService";
import { getNiubizActionCode } from "@/modules/afiliaciones/payments/Services/Niubiz/NiubizActionCodes";
import type { ApplicationStatusData } from "@/modules/afiliaciones/consulta/Models/ApplicationStatus";
import { cookies } from "next/headers";

export async function GET(request: Request) {
  const cookieStore = await cookies();
  const reference = paymentAuthorizationService.verifyRestoreReference(
    new URL(request.url).searchParams.get("payment_restore") ?? undefined,
    cookieStore.get(paymentAuthorizationService.restoreCookieName)?.value,
  );
  if (!reference) return NextResponse.json({ message: "La referencia de pago no es válida o expiró." }, { status: 403 });

  const payment = await new PaymentRepository().findPaymentConfirmationDetails(reference.paymentId);
  if (!payment || payment.applicationId !== reference.applicationId) return NextResponse.json({ message: "El pago no corresponde a la solicitud." }, { status: 404 });
  if (!(["FAILED", "PENDING", "PAID"] as const).includes(payment.status as "FAILED" | "PENDING" | "PAID")) return NextResponse.json({ message: "El estado del pago no puede restaurarse." }, { status: 409 });

  const action = payment.status === "FAILED" ? getNiubizActionCode(payment.actionCode ?? payment.failureCode) : undefined;
  const application = payment.application;
  const person = application.person;
  const fullName = person ? [person.firstName, person.paternalLastName, person.maternalLastName].filter(Boolean).join(" ") : "Postulante";
  const paid = payment.status === "PAID";
  const completedPayment: ApplicationStatusData["completedPayment"] = paid ? {
    id: payment.id,
    status: "PAID",
    amount: Number(payment.totalAmount),
    registrationAmount: payment.registrationAmount,
    membershipFeeAmount: payment.membershipFeeAmount,
    currency: payment.currency,
    gateway: payment.gateway,
    transactionId: payment.transactionId,
    authorizationCode: payment.authorizationCode,
    paymentDate: payment.paymentDate ?? null,
    gatewayTransactionDate: payment.gatewayTransactionDate ?? null,
    cardBrand: payment.cardBrand ?? null,
    maskedCard: payment.maskedCard ?? null,
    cardType: payment.cardType ?? null,
    paymentChannel: payment.paymentChannel ?? null,
    traceNumber: payment.traceNumber ?? null,
    billing: payment.billing ? {
      taxId: payment.billing.taxId,
      businessName: payment.billing.businessName,
      billingAddress: payment.billing.billingAddress,
      billingEmail: payment.billing.billingEmail,
      invoice: payment.billing.invoice ? {
        type: payment.billing.invoice.type,
        serie: payment.billing.invoice.serie,
        number: payment.billing.invoice.number,
        issueDate: payment.billing.invoice.issueDate,
        pdfUrl: payment.billing.invoice.pdfUrl,
        xmlUrl: payment.billing.invoice.xmlUrl,
        sunatCdrUrl: payment.billing.invoice.sunatCdrUrl,
      } : null,
    } : null,
  } : null;

  return NextResponse.json({
    application: {
      id: payment.applicationId,
      applicationId: payment.applicationId,
      status: application.status,
      applicationCode: application.applicationCode,
      trackingCode: application.trackingCode,
      documentType: application.documentType,
      documentNumber: application.documentNumber,
      email: application.email,
      phone: application.phone,
      affiliateType: application.affiliateType,
      applicantName: fullName,
      submissionDate: (application.submittedAt ?? application.createdAt).toISOString(),
      draftData: application.draftData,
      areas: { sponsors: { status: "PENDING", approvedCount: 0, requiredCount: 2 }, associates: { status: "PENDING" }, logistics: { status: "PENDING" }, board: { status: "PENDING" }, payment: { status: "PENDING" } },
      completedPayment,
    },
    billingData: payment.billing ? { tipoDocumento: payment.billing.taxId.length === 11 ? "RUC" : "DNI", numeroDocumento: payment.billing.taxId, razonSocial: payment.billing.businessName, direccionFiscal: payment.billing.billingAddress ?? "", responsable: fullName, emailFacturacion: payment.billing.billingEmail ?? application.email } : null,
    payment: { id: payment.id, status: payment.status, amount: Number(payment.totalAmount), registrationAmount: payment.registrationAmount, membershipFeeAmount: payment.membershipFeeAmount, currency: payment.currency, paymentDate: payment.paymentDate, transactionId: payment.transactionId, authorizationCode: payment.authorizationCode, cardBrand: payment.cardBrand, cardType: payment.cardType, maskedCard: payment.maskedCard, traceNumber: payment.traceNumber },
    failure: payment.status === "FAILED" ? { code: payment.actionCode ?? payment.failureCode, message: action?.userMessage ?? payment.failureReason ?? "La operación fue rechazada por Niubiz." } : null,
  }, { headers: { "Cache-Control": "no-store" } });
}
