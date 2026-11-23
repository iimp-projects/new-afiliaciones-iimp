import { emailCta, emailInfoBox } from "@/modules/shared/Email/EmailComponents";
import { escapeHtml } from "@/modules/shared/Email/EmailEscaping";
import { emailLayout } from "@/modules/shared/Email/EmailLayout";
import { LIMA_TIME_ZONE } from "@/modules/shared/Utils/formatPeruDateTime";
import { getAppBaseUrl } from "@/lib/config/env";
import { paymentMethodLabel } from "../Models/PaymentMethod";
import type { PaymentConfirmationDetails } from "../Repositories/Interfaces/IPaymentRepository";
import { getNiubizActionCode, NIUBIZ_APPROVED_ACTION_CODES } from "../Services/Niubiz/NiubizActionCodes";

const CONFIRMATION_CATEGORY = "Pago de Afiliación";
const CONTACT_EMAIL = "asociados@iimp.org.pe";

function personName(payment: PaymentConfirmationDetails): string {
  const person = payment.application.person;
  if (!person) return "Postulante";
  return [person.firstName, person.paternalLastName, person.maternalLastName].filter(Boolean).join(" ") || "Postulante";
}

function section(title: string, content: string): string {
  return '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;margin:18px 0;border:1px solid #e8e2d8;border-radius:8px;border-collapse:separate;"><tr><td style="padding:18px;"><p style="margin:0 0 12px;padding-bottom:10px;border-bottom:1px solid #e8e2d8;color:#9A7838;font-size:12px;line-height:18px;font-weight:bold;letter-spacing:1.2px;text-transform:uppercase;">' + escapeHtml(title) + "</p>" + content + "</td></tr></table>";
}

function rows(items: Array<[string, string | null | undefined]>): string {
  const visible = items.filter(([, value]) => Boolean(value));
  if (visible.length === 0) return "";
  return '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;border-collapse:collapse;">' + visible.map(([label, value]) => '<tr><td style="width:45%;padding:8px 10px 8px 0;border-bottom:1px solid #eef1f4;color:#667085;font-size:12px;line-height:18px;vertical-align:top;">' + escapeHtml(label) + '</td><td style="padding:8px 0;border-bottom:1px solid #eef1f4;color:#18253a;font-size:13px;line-height:18px;font-weight:bold;word-break:break-word;">' + escapeHtml(value!) + "</td></tr>").join("") + "</table>";
}

function documentLink(url: string, label: string): string {
  return '<a href="' + escapeHtml(url) + '" target="_blank" rel="noopener noreferrer" style="display:inline-block;margin:3px;padding:9px 12px;border:1px solid #e6c982;border-radius:7px;color:#936b2e;font-size:11px;line-height:16px;font-weight:bold;text-decoration:none;">' + escapeHtml(label) + "</a>";
}

function formatDate(value?: Date | null): string | undefined {
  return value ? new Intl.DateTimeFormat("es-PE", { dateStyle: "long", timeStyle: "short", timeZone: LIMA_TIME_ZONE }).format(value) : undefined;
}

function formatMoney(amount: number, currency: string): string {
  return new Intl.NumberFormat("es-PE", { style: "currency", currency, minimumFractionDigits: 2 }).format(amount);
}

function affiliateTypeLabel(value: string): string {
  return value === "ACTIVE" ? "Asociado Activo" : value === "STUDENT" ? "Asociado Estudiante" : value;
}

function confirmationStatus(): string {
  return '<div style="text-align:center;margin:0 0 24px;"><div style="width:54px;height:54px;line-height:54px;border-radius:27px;background-color:#e7f6ec;color:#15803d;font-family:Arial,Helvetica,sans-serif;font-size:30px;font-weight:bold;margin:0 auto;">&#10003;</div><div style="margin-top:12px;color:#15803d;font-size:11px;line-height:16px;font-weight:bold;letter-spacing:1.6px;text-transform:uppercase;">Afiliación completada</div></div>';
}

function totalCard(payment: PaymentConfirmationDetails): string {
  const amount = escapeHtml(formatMoney(payment.totalAmount, payment.currency));
  return '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;margin-top:16px;background-color:#faf8f2;border:1px solid #e8e2d8;border-radius:10px;"><tr><td align="center" style="padding:20px;"><p style="margin:0;color:#9A7838;font-size:11px;line-height:16px;font-weight:bold;letter-spacing:1.4px;">TOTAL PAGADO</p><p style="margin:8px 0;color:#18253a;font-size:28px;line-height:34px;font-weight:bold;">' + amount + '</p><span style="display:inline-block;padding:5px 11px;border-radius:12px;background-color:#e7f6ec;color:#15803d;font-size:10px;line-height:14px;font-weight:bold;letter-spacing:.8px;">PAGADO</span></td></tr></table>';
}

function paymentRows(payment: PaymentConfirmationDetails): string {
  const paidAt = formatDate(payment.gatewayTransactionDate ?? payment.paymentDate);
  return rows([
    ["ID de transacción", payment.transactionId ?? String(payment.id)],
    ["Referencia Niubiz", payment.traceNumber],
    ["Código de autorización", payment.authorizationCode],
    ["Fecha y hora del pago", paidAt],
    ["Medio de pago", paymentMethodLabel(payment.paymentMethod, payment.paymentBrand)],
    ["Canal de pago", payment.paymentChannel],
    ["Importe pagado", formatMoney(payment.totalAmount, payment.currency)],
    ["Moneda", payment.currency],
    ["Estado", "PAGADO"],
  ]);
}

function breakdownRows(payment: PaymentConfirmationDetails): string {
  if (payment.registrationAmount == null || payment.membershipFeeAmount == null) return "";
  return rows([
    ["Inscripción", formatMoney(payment.registrationAmount, payment.currency)],
    ["Cuota anual", formatMoney(payment.membershipFeeAmount, payment.currency)],
  ]);
}

function billingSection(payment: PaymentConfirmationDetails): string {
  if (!payment.billing) return "";
  return section("DATOS DE FACTURACIÓN", rows([
    ["Tipo de comprobante", payment.billing.receiptType ?? "No disponible"],
    ["Número de documento", payment.billing.taxId],
    ["Razón social / nombre", payment.billing.businessName],
    ["Dirección fiscal", payment.billing.billingAddress],
    ["Responsable", payment.billing.billingContact],
    ["Correo", payment.billing.billingEmail],
  ]));
}

function invoiceSection(payment: PaymentConfirmationDetails): string {
  const invoice = payment.billing?.invoice;
  if (!invoice) return "";
  const links = [
    invoice.pdfUrl ? documentLink(invoice.pdfUrl, "DESCARGAR PDF") : "",
    invoice.xmlUrl ? documentLink(invoice.xmlUrl, "DESCARGAR XML") : "",
    invoice.sunatCdrUrl ? documentLink(invoice.sunatCdrUrl, "DESCARGAR CDR") : "",
  ].filter(Boolean).join(" ");
  const content = rows([
    ["Tipo", invoice.type],
    ["Serie", invoice.serie],
    ["Número", invoice.number],
    ["Fecha de emisión", formatDate(invoice.issueDate)],
  ]) + (links ? '<p style="margin:18px 0 0;text-align:center;">' + links + "</p>" : "");
  return section("COMPROBANTE", content);
}

export function buildPaymentConfirmationEmail(payment: PaymentConfirmationDetails): string {
  const name = personName(payment);
  const associateRows = rows([
    ["Nombre completo", name],
    ["Documento", payment.application.documentType + " " + payment.application.documentNumber],
    ["Correo electrónico", payment.application.email],
    ["Teléfono", payment.application.phone],
    ["Tipo de afiliación", affiliateTypeLabel(payment.application.affiliateType)],
    ["Código de expediente", payment.application.applicationCode],
  ]);
  const content = `
    ${confirmationStatus()}
    <p style="margin:0 0 14px;">Estimado(a) <strong>${escapeHtml(name)}</strong>:</p>
    <p style="margin:0 0 14px;">Nos complace informarte que hemos recibido correctamente tu pago y que tu proceso de afiliación al Instituto de Ingenieros de Minas del Perú ha finalizado exitosamente.</p>
    <p style="margin:0 0 8px;color:#18253a;font-size:15px;line-height:23px;"><strong>¡Te damos la bienvenida a nuestra comunidad de asociados!</strong></p>
    ${section("DATOS DEL ASOCIADO", associateRows)}
    ${section("DETALLE DEL PAGO", paymentRows(payment) + breakdownRows(payment) + totalCard(payment))}
    ${billingSection(payment)}
    ${invoiceSection(payment)}
    <p style="margin:24px 0 0;padding-top:18px;border-top:1px solid #e8e2d8;color:#667085;font-size:12px;line-height:18px;">Si tienes alguna consulta sobre tu afiliación, escríbenos a <a href="mailto:${CONTACT_EMAIL}" style="color:#9A681F;text-decoration:none;font-weight:bold;">${CONTACT_EMAIL}</a>.</p>
    <p style="margin:10px 0 0;color:#667085;font-size:11px;line-height:17px;">Por seguridad, nunca compartas información sensible de tus medios de pago.</p>
  `;

  return emailLayout({
    category: CONFIRMATION_CATEGORY,
    title: "¡Bienvenido(a) al IIMP!",
    summary: "Tu pago fue procesado correctamente y tu afiliación se ha completado.",
    content,
    maxWidth: 600,
  });
}

export function buildPaymentIncidentEmail(payment: PaymentConfirmationDetails): string {
  const name = personName(payment);
  const declineCode = payment.actionCode ?? payment.failureCode;
  const action = declineCode && !NIUBIZ_APPROVED_ACTION_CODES.has(declineCode) ? getNiubizActionCode(declineCode) : undefined;
  const reason = action?.userMessage ?? payment.failureReason;
  const retryUrl = new URL("/consulta", getAppBaseUrl()).toString();
  const detailRows = rows([
    ["Código de expediente", payment.application.applicationCode],
    ["Importe", formatMoney(payment.totalAmount, payment.currency)],
    ...(reason ? [["Motivo", reason] as [string, string]] : []),
  ]);
  const content = `
    <p style="margin:0 0 16px;">Estimado(a) <strong>${escapeHtml(name)}</strong>:</p>
    <p style="margin:0 0 16px;">No pudimos confirmar el pago de tu afiliación al IIMP.</p>
    ${emailInfoBox("Tu pago no fue aprobado. Puedes volver a intentarlo desde el Portal de Afiliaciones.", "warning")}
    ${section("DETALLE DEL PAGO", detailRows)}
    <p style="margin:16px 0 0;">Puedes volver a intentar el pago desde el portal. Si el problema persiste, escríbenos a <strong>${CONTACT_EMAIL}</strong>.</p>
    ${emailCta("VOLVER A INTENTAR EL PAGO", retryUrl)}
  `;
  return emailLayout({
    category: CONFIRMATION_CATEGORY,
    title: "No pudimos confirmar tu pago",
    summary: "El pago no fue aprobado.",
    content,
  });
}
