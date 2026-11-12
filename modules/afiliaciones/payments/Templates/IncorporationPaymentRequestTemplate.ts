import { emailCta, emailInfoBox } from "@/modules/shared/Email/EmailComponents";
import { escapeHtml, safeUrl } from "@/modules/shared/Email/EmailEscaping";
import { emailLayout } from "@/modules/shared/Email/EmailLayout";

export const INCORPORATION_PAYMENT_REQUEST_SUBJECT =
  "IIMP | ¡Está a un paso de convertirse en asociado del Instituto de Ingenieros de Minas del Perú!";

export const INCORPORATION_PAYMENT_REQUEST_NIUBIZ_URL =
  "https://pagolink.niubiz.com.pe/pagoseguro/INSTITUTODEINGENIEROSDEMINASDELPERU/470721";

export const INCORPORATION_PAYMENT_REQUEST_LOGO_CID = "iimp-logo-incorporacion";
export const INCORPORATION_PAYMENT_REQUEST_QR_CID = "yape-qr-iimp";

export interface IncorporationPaymentRequestConcept {
  label: string;
  amount: number;
}

export interface IncorporationPaymentRequestTemplateInput {
  fullName: string;
  documentTypeLabel: string;
  documentNumber: string;
  concepts: IncorporationPaymentRequestConcept[];
  /** Periodo (por ejemplo, 2026) del registro de cuota anual aplicable. */
  membershipPeriod?: string | null;
}

function formatSoles(amount: number): string {
  const fixed = Math.abs(amount).toFixed(2);
  const [integer, decimals] = fixed.split(".");
  const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `S/ ${grouped}.${decimals}`;
}

function paymentDetail(concepts: IncorporationPaymentRequestConcept[]): string {
  const total = concepts.reduce((sum, concept) => sum + concept.amount, 0);
  const rows = concepts
    .map(
      (concept) =>
        `<tr><td style="padding:12px 14px;border-bottom:1px solid #e8e2d8;color:#344054;font-size:14px;line-height:20px;">${escapeHtml(concept.label)}</td><td align="right" style="padding:12px 14px;border-bottom:1px solid #e8e2d8;color:#18253a;font-size:14px;line-height:20px;font-weight:bold;white-space:nowrap;">${escapeHtml(formatSoles(concept.amount))}</td></tr>`,
    )
    .join("");

  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;margin:18px 0 0;border:1px solid #e8e2d8;border-radius:8px;border-collapse:separate;overflow:hidden;">
    <tr><td style="padding:12px 14px;background:#faf8f2;border-bottom:1px solid #e8e2d8;color:#9A7838;font-size:11px;line-height:16px;font-weight:bold;letter-spacing:1px;">CONCEPTO</td><td align="right" style="padding:12px 14px;background:#faf8f2;border-bottom:1px solid #e8e2d8;color:#9A7838;font-size:11px;line-height:16px;font-weight:bold;letter-spacing:1px;">IMPORTE</td></tr>
    ${rows}
    <tr><td style="padding:16px 14px;background:#18253a;color:#ffffff;font-size:14px;line-height:20px;font-weight:bold;">TOTAL A PAGAR</td><td align="right" style="padding:16px 14px;background:#18253a;color:#ffffff;font-size:20px;line-height:24px;font-weight:bold;white-space:nowrap;">${escapeHtml(formatSoles(total))}</td></tr>
  </table>`;
}

function sectionTitle(title: string): string {
  return `<h2 style="margin:28px 0 10px;padding:0 0 8px;border-bottom:1px solid #e8e2d8;color:#9A7838;font-size:12px;line-height:18px;font-weight:bold;letter-spacing:1.2px;text-transform:uppercase;">${escapeHtml(title)}</h2>`;
}

function paymentFooter(): string {
  return `<tr><td align="center" style="padding:24px 28px;background:#FAF8F4;border-top:1px solid #E7E2D9;color:#667085;font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:17px;">
    <strong style="color:#344054;">Área de Asociados</strong><br>
    Instituto de Ingenieros de Minas del Perú – IIMP<br>
    Calle Los Canarios 155-157, Urb. San César II Etapa, La Molina, Lima 12, Perú.<br>
    <a href="mailto:asociados@iimp.org.pe" style="color:#9A681F;text-decoration:none;">asociados@iimp.org.pe</a> · +51 982 097 019 / +51 951 294 314<br>
    Lunes a viernes de 09:00 a 18:00 hrs.<br><br>
    Este correo fue enviado por el Portal de Afiliaciones del IIMP. Puede responder directamente a este mensaje adjuntando su comprobante de pago.<br>
    © ${new Date().getFullYear()} Instituto de Ingenieros de Minas del Perú. Todos los derechos reservados.
  </td></tr>`;
}

function benefits(): string {
  const items = [
    "<strong>Descuentos exclusivos</strong> en congresos, convenciones y conferencias organizados por el IIMP.",
    "<strong>Acceso a publicaciones especializadas</strong> y contenidos de interés para el sector minero.",
    "<strong>Participación en programas de capacitación</strong>, actividades académicas y eventos institucionales.",
    "<strong>Acceso a exhibiciones</strong> de eventos organizados por nuestra institución, de acuerdo con las condiciones establecidas.",
    "<strong>Vinculación con una comunidad de profesionales</strong> comprometidos con el desarrollo de la minería peruana.",
  ];
  return `<ul style="margin:0 0 16px;padding-left:20px;color:#344054;font-size:14px;line-height:22px;">${items.map((item) => `<li style="margin:0 0 8px;">${item}</li>`).join("")}</ul>`;
}

export function buildIncorporationPaymentRequestEmail(input: IncorporationPaymentRequestTemplateInput): string {
  const name = input.fullName.trim() || "Postulante";
  const documentLabel = input.documentTypeLabel.trim() || "Documento";
  const documentNumber = input.documentNumber.trim();
  const depositorCode = documentNumber
    ? `${escapeHtml(documentLabel)} ${escapeHtml(documentNumber)}`
    : "su número de documento";
  const conceptNames = input.concepts.map((concept) => concept.label.toLowerCase()).join(" y ");
  const periodNote = input.membershipPeriod && input.concepts.some((concept) => concept.label.toLowerCase().includes("cuota anual"))
    ? `<p style="margin:12px 0 0;color:#667085;font-size:12px;line-height:18px;">Periodo de la cuota anual: <strong style="color:#344054;">${escapeHtml(input.membershipPeriod)}</strong>.</p>`
    : "";

  const content = `
    <p style="margin:0 0 16px;">Estimado(a) <strong>${escapeHtml(name)}</strong>:</p>
    <p style="margin:0 0 16px;">Reciba un cordial saludo del Instituto de Ingenieros de Minas del Perú (IIMP).</p>
    <p style="margin:0 0 16px;color:#18253a;font-size:15px;line-height:23px;"><strong>¡Nos complace informarle que se encuentra a un paso de formar parte de nuestra comunidad de asociados!</strong></p>
    <p style="margin:0 0 16px;">Su solicitud de afiliación ha avanzado satisfactoriamente y, para completar su proceso de incorporación como asociado del IIMP, únicamente queda pendiente realizar el pago correspondiente a ${escapeHtml(conceptNames)}.</p>
    ${sectionTitle("Detalle del pago")}
    ${paymentDetail(input.concepts)}
    ${periodNote}
    <p style="margin:18px 0 0;">Para facilitar este último paso, ponemos a su disposición los siguientes medios de pago:</p>

    ${sectionTitle("1. Banco de Crédito del Perú (BCP)")}
    ${emailInfoBox(`
      <p style="margin:0 0 10px;color:#18253a;font-size:14px;line-height:21px;"><strong>Instituto de Ingenieros de Minas del Perú</strong></p>
      <p style="margin:0 0 6px;">Cuenta corriente (S/): <strong>193-2410342-0-88</strong></p>
      <p style="margin:0 0 6px;">CCI (S/): <strong>002-193-002410342088-11</strong></p>
      <p style="margin:0;">Código de depositante: <strong>${depositorCode}</strong></p>
    `, "neutral")}

    ${sectionTitle("2. Banca por internet – BCP")}
    <ol style="margin:0 0 16px;padding-left:20px;color:#344054;font-size:14px;line-height:22px;">
      <li style="margin:0 0 8px;">Ingrese a la sección <strong>Pago de Servicios</strong>.</li>
      <li style="margin:0 0 8px;">Busque <strong>Instituto de Ingenieros de Minas del Perú</strong>.</li>
      <li style="margin:0 0 8px;">Seleccione el servicio <strong>Instituto – Soles</strong>.</li>
      <li style="margin:0;">Ingrese su número de DNI o RUC como código de depositante para identificar correctamente la operación.</li>
    </ol>

    ${sectionTitle("3. Tarjeta de crédito o débito – Niubiz")}
    <p style="margin:0 0 8px;">Puede efectuar su pago de forma rápida y segura mediante nuestra plataforma de pagos en línea.</p>
    ${emailCta("REALIZAR PAGO CON TARJETA", INCORPORATION_PAYMENT_REQUEST_NIUBIZ_URL)}
    <p style="margin:0 0 16px;color:#667085;font-size:11px;line-height:17px;text-align:center;word-break:break-all;">Enlace oficial: <a href="${safeUrl(INCORPORATION_PAYMENT_REQUEST_NIUBIZ_URL)}" target="_blank" rel="noopener noreferrer" style="color:#9A681F;text-decoration:none;">${escapeHtml(INCORPORATION_PAYMENT_REQUEST_NIUBIZ_URL)}</a></p>

    ${sectionTitle("4. Yape corporativo – IIMP")}
    <p style="margin:0 0 14px;">También puede realizar el pago escaneando nuestro código QR institucional de Yape.</p>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;margin:0 0 16px;">
      <tr><td align="center" style="padding:16px;background:#faf8f2;border:1px solid #e8e2d8;border-radius:10px;">
        <img src="cid:${INCORPORATION_PAYMENT_REQUEST_QR_CID}" alt="Código QR Yape - Instituto de Ingenieros de Minas del Perú" width="220" style="display:block;width:220px;max-width:100%;height:auto;margin:0 auto;border:0;outline:none;">
      </td></tr>
    </table>

    ${sectionTitle("Confirmación de su incorporación")}
    ${emailInfoBox("Una vez realizado el pago, le agradeceremos responder este correo adjuntando el comprobante correspondiente, a fin de validar la operación y completar el proceso de incorporación.<br><br>Después de la verificación del pago y la actualización de nuestros registros, podrá disfrutar de los beneficios que ofrece el IIMP a sus asociados.", "info")}

    ${sectionTitle("Beneficios de formar parte del IIMP")}
    <p style="margin:0 0 12px;">Como asociado, tendrá la oportunidad de acceder a diversos beneficios, entre ellos:</p>
    ${benefits()}

    <p style="margin:0 0 16px;">Estamos muy entusiasmados con la posibilidad de contar con usted como parte de nuestra institución y esperamos darle pronto la bienvenida oficial a nuestra comunidad de asociados.</p>
    <p style="margin:0 0 16px;">Agradecemos su interés y confianza en el Instituto de Ingenieros de Minas del Perú.</p>
    <p style="margin:0 0 20px;">Ante cualquier consulta sobre el proceso de pago o afiliación, quedamos a su disposición para brindarle el apoyo necesario.</p>
    <p style="margin:0;">Atentamente,<br><strong style="color:#18253a;">Área de Asociados</strong><br>Instituto de Ingenieros de Minas del Perú – IIMP</p>
  `;

  return emailLayout({
    category: "Incorporación de Asociados",
    title: "¡Está a un paso de formar parte del IIMP!",
    summary: "Complete su incorporación realizando el pago correspondiente.",
    content,
    logoUrl: `cid:${INCORPORATION_PAYMENT_REQUEST_LOGO_CID}`,
    footerHtml: paymentFooter(),
    maxWidth: 600,
  });
}
