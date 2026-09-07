import { PaymentStatus } from "@prisma/client";
import { MailService } from "../../../shared/Services/MailService";
import type { IPaymentRepository, PaymentConfirmationDetails } from "../Repositories/Interfaces/IPaymentRepository";
import { PaymentSettingsResolver } from "../../../security/system-settings/Services/PaymentSettingsResolver";

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
      await this.mailService.sendMail({
        to: payment.application.email,
        subject: emailSettings.subject ?? PaymentConfirmationEmailService.defaultSubject,
        html: this.buildTemplate(payment),
      });
      await this.repository.markConfirmationEmailSent(payment.id);
    } catch {
      console.error("[PAYMENT_CONFIRMATION_EMAIL] No se pudo enviar la confirmación.", { paymentId });
    }
  }

  private buildTemplate(payment: PaymentConfirmationDetails): string {
    const person = payment.application.person;
    const fullName = person ? [person.firstName, person.paternalLastName, person.maternalLastName].filter(Boolean).join(" ") : "Postulante";
    const amount = new Intl.NumberFormat("es-PE", { style: "currency", currency: payment.currency, minimumFractionDigits: 2 }).format(payment.totalAmount).replace("PEN", "S/");
    const rows = (items: Array<[string, string | null | undefined]>) => items.filter(([, value]) => Boolean(value)).map(([label, value]) => `<tr><td class="label">${label}</td><td>${value}</td></tr>`).join("");
    const billingRows = payment.billing ? rows([
      ["Número de documento", payment.billing.taxId], ["Razón social / Nombre", payment.billing.businessName],
      ["Dirección fiscal", payment.billing.billingAddress], ["Correo de facturación", payment.billing.billingEmail],
    ]) : "";
    const date = payment.paymentDate ? new Intl.DateTimeFormat("es-PE", { dateStyle: "long", timeStyle: "short" }).format(payment.paymentDate) : "";
    return `<!doctype html><html><head><meta charset="utf-8"><style>body{margin:0;background:#f4f5f7;font-family:Arial,sans-serif;color:#182235}.card{max-width:620px;margin:24px auto;background:#fff;border:1px solid #e5e7eb;border-radius:16px;overflow:hidden}.header{background:#152238;color:#fff;padding:30px;text-align:center}.badge{color:#c5a059;font-weight:bold;letter-spacing:1px}.content{padding:30px;line-height:1.55}.box{border:1px solid #e8d09e;background:#fcfaf6;border-radius:12px;padding:18px;margin:20px 0}table{width:100%;border-collapse:collapse}td{padding:8px 0;border-bottom:1px solid #eee}.label{color:#64748b;width:45%}.total{font-size:25px;font-weight:bold;color:#a57b28}.footer{padding:22px 30px;text-align:center;color:#64748b;font-size:12px}</style></head><body><div class="card"><div class="header"><div class="badge">PAGO CONFIRMADO</div><h1>Instituto de Ingenieros de Minas del Perú</h1></div><div class="content"><p>Estimado(a) <strong>${fullName}</strong>,</p><p>Hemos confirmado correctamente el pago correspondiente a su proceso de afiliación. Su proceso de afiliación ha sido completado satisfactoriamente.</p><div class="box"><strong>DATOS DEL ASOCIADO</strong><table>${rows([["Nombre completo", fullName], ["Documento", `${payment.application.documentType} ${payment.application.documentNumber}`], ["Correo", payment.application.email], ["Teléfono", payment.application.phone], ["Tipo de asociado", payment.application.affiliateType]])}</table></div>${billingRows ? `<div class="box"><strong>DATOS DE FACTURACIÓN</strong><table>${billingRows}</table></div>` : ""}<div class="box"><strong>RESUMEN DE PAGO</strong><table>${rows([["N° de operación", payment.transactionId ?? String(payment.id)], ["N° de pago", String(payment.id)], ["Método", "Niubiz – Tarjeta"], ["Estado", "PAGO APROBADO"], ["Fecha", date]])}</table><p class="total">TOTAL PAGADO<br>${amount}</p></div><p>Su afiliación ha sido registrada correctamente. Conserve este correo como constancia de su pago.</p><p>Si tiene alguna consulta relacionada con su afiliación, puede comunicarse con el Instituto de Ingenieros de Minas del Perú.</p></div><div class="footer">Instituto de Ingenieros de Minas del Perú<br>Mensaje generado automáticamente.</div></div></body></html>`;
  }
}
