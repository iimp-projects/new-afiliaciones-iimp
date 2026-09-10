import { PaymentStatus } from "@prisma/client";
import { MailService } from "../../../shared/Services/MailService";
import type { IPaymentRepository, PaymentConfirmationDetails } from "../Repositories/Interfaces/IPaymentRepository";
import { PaymentSettingsResolver } from "../../../security/system-settings/Services/PaymentSettingsResolver";

const IIMP_LOGO_URL = "https://s3-iimp-gestor-de-archivos-v3.s3.sa-east-1.amazonaws.com/boletines/images/IMG20260817_120138.png";

export class PaymentConfirmationEmailService {
  private static readonly defaultSubject = "Afiliación IIMP confirmada – Pago realizado correctamente";

  constructor(
    private readonly repository: Pick<IPaymentRepository, "findPaymentConfirmationDetails" | "markConfirmationEmailSent">,
    private readonly mailService = new MailService(),
    private readonly settings = new PaymentSettingsResolver(),
  ) {}

  async sendIfNeeded(paymentId: number): Promise<void> {
    const payment = await this.repository.findPaymentConfirmationDetails(paymentId);
    if (!payment || payment.status !== PaymentStatus.PAID || payment.confirmationEmailSentAt) return;
    try {
      const emailSettings = await this.settings.getPaymentConfirmationEmailSettings();
      if (!emailSettings.enabled) return;
      await this.mailService.sendMail({ to: payment.application.email, subject: emailSettings.subject ?? PaymentConfirmationEmailService.defaultSubject, html: this.buildTemplate(payment) });
      await this.repository.markConfirmationEmailSent(payment.id);
    } catch {
      console.error("[PAYMENT_CONFIRMATION_EMAIL] No se pudo enviar la confirmación.", { paymentId });
    }
  }

  private buildTemplate(payment: PaymentConfirmationDetails): string {
    const application = payment.application;
    const person = application.person;
    const name = person ? [person.firstName, person.paternalLastName, person.maternalLastName].filter(Boolean).join(" ") : "Postulante";
    const invoice = payment.billing?.invoice;
    const associateRows = rows([
      ["Nombre completo", name], ["Documento", application.documentType + " " + application.documentNumber], ["Correo electrónico", application.email], ["Teléfono", application.phone],
      ["Tipo de afiliación", affiliateTypeLabel(application.affiliateType)], ["Código de expediente", application.applicationCode],
    ]);
    const paymentRows = rows([
      ["ID de transacción", payment.transactionId], ["Fecha y hora del pago", formatDate(payment.gatewayTransactionDate ?? payment.paymentDate)],
      ["Canal de pago", paymentChannelLabel(payment.paymentChannel, payment.gateway)], ["Marca de tarjeta", payment.cardBrand], ["Tipo de tarjeta", cardTypeLabel(payment.cardType)],
      ["Tarjeta enmascarada", payment.maskedCard], ["Moneda", payment.currency], ["Código de autorización", payment.authorizationCode], ["Trace number", payment.traceNumber],
    ]);
    const billingRows = payment.billing ? highlightedRows([
      ["Tipo de comprobante", payment.billing.receiptType ?? "No disponible"], ["Número de documento", payment.billing.taxId], ["Razón social / nombre", payment.billing.businessName],
      ["Dirección fiscal", payment.billing.billingAddress], ["Correo", payment.billing.billingEmail],
    ]) : "";
    const invoiceLinks = invoice ? [invoice.pdfUrl ? documentLink(invoice.pdfUrl, "DESCARGAR PDF") : "", invoice.xmlUrl ? documentLink(invoice.xmlUrl, "DESCARGAR XML") : "", invoice.sunatCdrUrl ? documentLink(invoice.sunatCdrUrl, "DESCARGAR CDR") : ""].filter(Boolean).join(" ") : "";
    const invoiceSection = invoice ? section("COMPROBANTE", rows([["Tipo", invoice.type], ["Serie", invoice.serie], ["Número", invoice.number], ["Fecha de emisión", formatDate(invoice.issueDate)]]) + (invoiceLinks ? '<p style="margin:18px 0 0;text-align:center;">' + invoiceLinks + "</p>" : "")) : "";
    const amount = escapeHtml(formatMoney(payment.totalAmount, payment.currency));
    const paymentBreakdown = payment.registrationAmount != null && payment.membershipFeeAmount != null
      ? rows([["Inscripción", formatMoney(payment.registrationAmount, payment.currency)], ["Cuota de afiliación", formatMoney(payment.membershipFeeAmount, payment.currency)]])
      : "";
    const totalCard = '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-top:16px;background:#fff7e6;border:1px solid #f0dfb6;border-radius:10px;"><tr><td align="center" style="padding:18px;"><p style="margin:0;color:#8a671d;font-size:11px;font-weight:bold;letter-spacing:1px;">TOTAL PAGADO</p><p style="margin:8px 0;color:#6e4b12;font-size:28px;font-weight:bold;">' + amount + '</p><span style="display:inline-block;padding:5px 10px;border-radius:11px;background:#dcfce7;color:#15803d;font-size:10px;font-weight:bold;letter-spacing:.5px;">PAGADO ✓</span></td></tr></table>';

    return '<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>' +
      '<body style="margin:0;padding:0;background:#f5f5f4;font-family:Arial,Helvetica,sans-serif;color:#1e293b;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f5f5f4;"><tr><td align="center" style="padding:28px 12px;">' +
      '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:620px;background:#ffffff;border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;"><tr><td style="height:4px;background:#c5a059;font-size:0;line-height:0;">&nbsp;</td></tr>' +
      '<tr><td align="center" style="padding:32px 28px 26px;"><img src="' + IIMP_LOGO_URL + '" alt="Instituto de Ingenieros de Minas del Perú" width="155" style="display:block;width:155px;max-width:100%;height:auto;margin:0 auto 22px;">' +
      '<div style="width:46px;height:46px;line-height:46px;border-radius:23px;background:#dcfce7;color:#15803d;font-size:27px;font-weight:bold;">✓</div><p style="margin:16px 0 0;color:#9a7024;font-size:11px;font-weight:bold;letter-spacing:1.2px;">AFILIACIÓN COMPLETADA</p>' +
      '<h1 style="margin:10px 0 0;color:#152238;font-size:25px;line-height:31px;">¡Bienvenido(a) al IIMP!</h1><p style="margin:14px 0 0;color:#334155;font-size:14px;line-height:22px;">Estimado(a) ' + escapeHtml(name) + ',<br><br>Tu pago fue procesado correctamente y tu proceso de afiliación ha finalizado con éxito.</p>' +
      '<span style="display:inline-block;margin-top:14px;padding:6px 12px;border-radius:12px;background:#dcfce7;color:#15803d;font-size:11px;font-weight:bold;letter-spacing:.6px;">COMPLETADA</span></td></tr><tr><td style="padding:26px 24px;">' +
      section("DATOS DEL ASOCIADO", associateRows) +
      '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:16px 0;background:#fffcf6;border-top:1px solid #e6c982;border-bottom:1px solid #e6c982;"><tr><td align="center" style="padding:15px 18px;"><p style="margin:0;color:#8a671d;font-size:11px;font-weight:bold;letter-spacing:1px;">CÓDIGO DE SEGUIMIENTO</p><p style="margin:7px 0 0;color:#1e293b;font-family:monospace;font-size:16px;font-weight:bold;word-break:break-all;">' + escapeHtml(application.trackingCode) + '</p><p style="margin:7px 0 0;color:#64748b;font-size:12px;line-height:18px;">Conserva este código como referencia de tu proceso de afiliación.</p></td></tr></table>' +
      section("DETALLE DEL PAGO", paymentRows + paymentBreakdown + totalCard) + (billingRows ? highlightedSection("DATOS DE FACTURACIÓN", billingRows) : "") + invoiceSection +
      '<div style="margin:26px 0 0;"><p style="margin:0 0 12px;color:#2f3136;font-size:13px;font-weight:bold;letter-spacing:.4px;">¿QUÉ SIGUE AHORA?</p><p style="margin:0 0 8px;color:#334155;font-size:14px;line-height:20px;">✓ Tu pago fue registrado correctamente.</p><p style="margin:0 0 8px;color:#334155;font-size:14px;line-height:20px;">✓ Tu proceso de afiliación ha finalizado.</p><p style="margin:0;color:#334155;font-size:14px;line-height:20px;">✓ Conserva tu código de seguimiento como referencia.</p></div>' +
      '<p style="margin:24px 0 0;padding-top:20px;border-top:1px solid #e5e7eb;color:#64748b;font-size:12px;line-height:18px;">Para cualquier consulta sobre tu afiliación:<br><strong style="color:#334155;">asociados@iimp.org.pe</strong><br><strong style="color:#334155;">+51 982 097 019 / +51 951 294 314</strong></p><p style="margin:16px 0 0;color:#64748b;font-size:12px;line-height:18px;">Por seguridad, nunca compartas información sensible de tus medios de pago.</p>' +
      '</td></tr><tr><td align="center" style="padding:28px 24px;background:#ffffff;border-top:1px solid #e5e7eb;color:#64748b;font-size:11px;line-height:18px;">Instituto de Ingenieros de Minas del Perú<br><span style="color:#8a671d;">Gracias por formar parte del IIMP.</span><br><br>Este es un mensaje automático. Por favor, no responda a este correo.<br>© ' + new Date().getFullYear() + ' Instituto de Ingenieros de Minas del Perú</td></tr></table></td></tr></table></body></html>';
  }
}

function section(title: string, content: string): string {
  return '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:18px 0;border:1px solid #e5e7eb;border-radius:7px;"><tr><td style="padding:18px;"><p style="margin:0 0 12px;padding-bottom:10px;border-bottom:1px solid #e5e7eb;color:#9a7024;font-size:12px;font-weight:bold;letter-spacing:.5px;">' + escapeHtml(title) + "</p>" + content + "</td></tr></table>";
}

function highlightedSection(title: string, content: string): string {
  return '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:20px 0;background:#8a671d;border-radius:7px;"><tr><td style="padding:20px;"><p style="margin:0 0 12px;padding-bottom:10px;border-bottom:1px solid #d6b56d;color:#ffffff;font-size:12px;font-weight:bold;letter-spacing:.5px;">' + escapeHtml(title) + "</p>" + content + "</td></tr></table>";
}

function rows(items: Array<[string, string | null | undefined]>): string {
  return '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">' + items.filter(([, value]) => Boolean(value)).map(([label, value]) => '<tr><td style="width:45%;padding:7px 10px 7px 0;border-bottom:1px solid #edf2f7;color:#64748b;font-size:12px;vertical-align:top;">' + escapeHtml(label) + '</td><td style="padding:7px 0;border-bottom:1px solid #edf2f7;color:#1e293b;font-size:13px;font-weight:bold;word-break:break-word;">' + escapeHtml(value!) + "</td></tr>").join("") + "</table>";
}

function highlightedRows(items: Array<[string, string | null | undefined]>): string {
  return '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">' + items.filter(([, value]) => Boolean(value)).map(([label, value]) => '<tr><td style="width:45%;padding:7px 10px 7px 0;border-bottom:1px solid #b78f40;color:#f9edcf;font-size:12px;vertical-align:top;">' + escapeHtml(label) + '</td><td style="padding:7px 0;border-bottom:1px solid #b78f40;color:#ffffff;font-size:13px;font-weight:bold;word-break:break-word;">' + escapeHtml(value!) + "</td></tr>").join("") + "</table>";
}

function documentLink(url: string, label: string): string { return '<a href="' + escapeHtml(url) + '" target="_blank" rel="noreferrer" style="display:inline-block;margin:3px;padding:9px 12px;border:1px solid #e6c982;border-radius:7px;color:#936b2e;font-size:11px;font-weight:bold;text-decoration:none;">' + escapeHtml(label) + "</a>"; }
function formatDate(value?: Date | null): string | undefined { return value ? new Intl.DateTimeFormat("es-PE", { dateStyle: "long", timeStyle: "short" }).format(value) : undefined; }
function formatMoney(amount: number, currency: string): string { return new Intl.NumberFormat("es-PE", { style: "currency", currency, minimumFractionDigits: 2 }).format(amount); }
function affiliateTypeLabel(value: string): string { return value === "ACTIVE" ? "Asociado Activo" : value === "STUDENT" ? "Asociado Estudiante" : value; }
function cardTypeLabel(value?: string): string | undefined { return value === "C" ? "Crédito" : value === "D" ? "Débito" : value; }
function paymentChannelLabel(channel: string | undefined, gateway: string): string { return [gateway, channel].filter(Boolean).join(" · "); }
function escapeHtml(value: string): string { return value.replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[character]!); }
