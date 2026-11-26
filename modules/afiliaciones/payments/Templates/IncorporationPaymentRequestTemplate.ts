import { emailCta } from "@/modules/shared/Email/EmailComponents";
import { escapeHtml, safeUrl } from "@/modules/shared/Email/EmailEscaping";
import { emailLayout } from "@/modules/shared/Email/EmailLayout";

export const INCORPORATION_PAYMENT_REQUEST_SUBJECT =
  "¡Tu solicitud de afiliación ha sido aprobada! Completa tu incorporación al IIMP";

export const INCORPORATION_PAYMENT_REQUEST_LOGO_CID = "iimp-logo-incorporacion";

export interface IncorporationPaymentRequestConcept {
  label: string;
  amount: number;
}

export interface IncorporationPaymentRequestTemplateInput {
  fullName: string;
  membershipTypeLabel: string;
  concepts: IncorporationPaymentRequestConcept[];
  currency?: string | null;
  paidAmount?: number | null;
  /** Periodo (por ejemplo, 2026) del registro de cuota anual aplicable. */
  membershipPeriod?: string | null;
  consultaUrl: string;
  paymentMethods: string[];
  manualPaymentAvailable?: boolean;
}

const COLORS = {
  ivory: "#FAF8F3",
  card: "#F3EFE6",
  gold: "#A68B55",
  goldText: "#9C814C",
  border: "#E1D8C7",
  secondary: "#746B5E",
  text: "#333333",
  approved: "#42805A",
} as const;

function formatMoney(amount: number, currency?: string | null): string {
  const fixed = Math.abs(amount).toFixed(2);
  const [integer, decimals] = fixed.split(".");
  const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const prefix = currency && currency !== "PEN" ? `${currency} ` : "S/ ";
  return `${prefix}${grouped}.${decimals}`;
}

function approvalIcon(): string {
  return `<table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin:0 auto 16px;"><tr><td width="52" height="52" align="center" valign="middle" style="width:52px;height:52px;border-radius:26px;background-color:${COLORS.ivory};border:1px solid ${COLORS.border};color:${COLORS.gold};font-family:Arial,Helvetica,sans-serif;font-size:24px;line-height:52px;font-weight:bold;">&#10003;</td></tr></table>`;
}

function sectionTitle(title: string): string {
  return `<h2 style="margin:28px 0 12px;padding:0;color:${COLORS.goldText};font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:19px;font-weight:bold;letter-spacing:1.1px;text-transform:uppercase;">${escapeHtml(title)}</h2>`;
}

function detailRows(input: IncorporationPaymentRequestTemplateInput, totalPending: number): string {
  const rows = input.concepts
    .map(
      (concept) =>
        `<tr><td style="padding:10px 0;border-bottom:1px solid ${COLORS.border};color:${COLORS.text};font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:20px;">${escapeHtml(concept.label)}</td><td align="right" style="padding:10px 0;border-bottom:1px solid ${COLORS.border};color:${COLORS.text};font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:20px;font-weight:bold;white-space:nowrap;">${escapeHtml(formatMoney(concept.amount, input.currency))}</td></tr>`,
    )
    .join("");

  const paidAmount = input.paidAmount ?? 0;
  const previousPaymentRows =
    paidAmount > 0
      ? `<tr><td style="padding:10px 0;border-bottom:1px solid ${COLORS.border};color:${COLORS.secondary};font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:19px;">Importe ya pagado</td><td align="right" style="padding:10px 0;border-bottom:1px solid ${COLORS.border};color:${COLORS.secondary};font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:19px;white-space:nowrap;">${escapeHtml(formatMoney(paidAmount, input.currency))}</td></tr>
        <tr><td style="padding:10px 0;border-bottom:1px solid ${COLORS.border};color:${COLORS.secondary};font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:19px;">Total correspondiente</td><td align="right" style="padding:10px 0;border-bottom:1px solid ${COLORS.border};color:${COLORS.secondary};font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:19px;white-space:nowrap;">${escapeHtml(formatMoney(paidAmount + totalPending, input.currency))}</td></tr>`
      : "";

  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;border-collapse:collapse;">${rows}${previousPaymentRows}</table>`;
}

function affiliationCard(input: IncorporationPaymentRequestTemplateInput): string {
  const totalPending = input.concepts.reduce((sum, concept) => sum + concept.amount, 0);
  const periodNote =
    input.membershipPeriod && input.concepts.some((concept) => concept.label.toLowerCase().includes("membresía"))
      ? `<p style="margin:8px 0 0;color:${COLORS.secondary};font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:18px;">Periodo de la membresía anual: <strong style="color:${COLORS.text};">${escapeHtml(input.membershipPeriod)}</strong>.</p>`
      : "";

  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;margin:20px 0 0;background-color:${COLORS.card};border:1px solid ${COLORS.border};border-radius:10px;">
    <tr><td style="padding:20px 20px 18px;">
      <p style="margin:0 0 14px;color:${COLORS.goldText};font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:18px;font-weight:bold;letter-spacing:1.1px;text-transform:uppercase;">Información de tu afiliación</p>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;border-collapse:collapse;">
        <tr><td style="padding:7px 0;color:${COLORS.secondary};font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:19px;width:46%;">Tipo de membresía</td><td style="padding:7px 0;color:${COLORS.text};font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:19px;font-weight:bold;">${escapeHtml(input.membershipTypeLabel)}</td></tr>
        <tr><td style="padding:7px 0;color:${COLORS.secondary};font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:19px;">Estado de afiliación</td><td style="padding:7px 0;color:${COLORS.approved};font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:19px;font-weight:bold;">Aprobada</td></tr>
        <tr><td style="padding:7px 0;color:${COLORS.secondary};font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:19px;">Estado de pago</td><td style="padding:7px 0;color:${COLORS.goldText};font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:19px;font-weight:bold;">Pendiente de pago</td></tr>
      </table>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;margin:16px 0 0;"><tr><td height="1" style="height:1px;background-color:${COLORS.border};font-size:0;line-height:0;">&nbsp;</td></tr></table>
      <p style="margin:16px 0 10px;color:${COLORS.goldText};font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:18px;font-weight:bold;letter-spacing:1.1px;text-transform:uppercase;">Detalle de pago</p>
      ${detailRows(input, totalPending)}
      ${periodNote}
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;margin:18px 0 0;background-color:${COLORS.ivory};border:1px solid ${COLORS.border};border-radius:8px;">
        <tr><td align="center" style="padding:16px 12px;">
          <p style="margin:0 0 6px;color:${COLORS.secondary};font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:16px;font-weight:bold;letter-spacing:1.2px;text-transform:uppercase;">Monto total pendiente</p>
          <p style="margin:0;color:${COLORS.goldText};font-family:Arial,Helvetica,sans-serif;font-size:28px;line-height:34px;font-weight:bold;">${escapeHtml(formatMoney(totalPending, input.currency))}</p>
        </td></tr>
      </table>
    </td></tr>
  </table>`;
}

function steps(): string {
  const items = [
    { title: "Ingresa al portal de consulta", description: "Haz clic en el botón que encontrarás en este correo para acceder al sistema de afiliaciones." },
    { title: "Consulta el estado de tu solicitud", description: "Ingresa los datos solicitados para visualizar la aprobación de tu afiliación y el importe pendiente de pago." },
    { title: "Selecciona tu medio de pago", description: "Elige el medio de pago de tu preferencia y sigue las instrucciones para completar tu incorporación." },
  ];

  const rows = items
    .map(
      (item, index) => `<tr>
        <td width="40" valign="top" style="width:40px;padding:0 12px 16px 0;"><div style="width:28px;height:28px;border-radius:14px;background-color:${COLORS.ivory};border:1px solid ${COLORS.border};color:${COLORS.goldText};font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:28px;font-weight:bold;text-align:center;">${index + 1}</div></td>
        <td valign="top" style="padding:0 0 16px;"><p style="margin:0 0 3px;color:${COLORS.text};font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:20px;font-weight:bold;">${escapeHtml(item.title)}</p><p style="margin:0;color:${COLORS.secondary};font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:20px;">${escapeHtml(item.description)}</p></td>
      </tr>`,
    )
    .join("");

  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;border-collapse:collapse;">${rows}</table>`;
}

function paymentMethods(input: IncorporationPaymentRequestTemplateInput): string {
  const methods = input.paymentMethods.filter(Boolean);
  if (methods.length === 0) return "";

  const methodLine = methods
    .map((method) => `<span style="color:${COLORS.text};font-size:14px;line-height:20px;font-weight:bold;">${escapeHtml(method)}</span>`)
    .join(`<span style="color:${COLORS.gold};font-size:14px;line-height:20px;"> &nbsp;|&nbsp; </span>`);
  const manualLine = input.manualPaymentAvailable
    ? `<p style="margin:10px 0 0;color:${COLORS.secondary};font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:18px;">También podrás consultar las alternativas de pago manual disponibles desde nuestro portal.</p>`
    : "";

  return `${sectionTitle("Medios de pago disponibles")}
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;background-color:${COLORS.ivory};border:1px solid ${COLORS.border};border-radius:8px;"><tr><td align="center" style="padding:14px 16px;">
      <p style="margin:0;font-family:Arial,Helvetica,sans-serif;">${methodLine}</p>
      <p style="margin:8px 0 0;color:${COLORS.secondary};font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:18px;">Pagos en línea procesados a través de Niubiz.</p>
      ${manualLine}
    </td></tr></table>`;
}

function benefits(): string {
  const items = [
    "Beneficios exclusivos para asociados.",
    "Acceso a actividades y oportunidades de desarrollo profesional.",
    "Servicios y recursos institucionales.",
    "Conexión con nuestra comunidad de profesionales del sector minero.",
  ];
  const rows = items
    .map(
      (item) => `<tr>
        <td width="22" valign="top" style="width:22px;padding:0 8px 9px 0;color:${COLORS.gold};font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:20px;font-weight:bold;">&#10003;</td>
        <td valign="top" style="padding:0 0 9px;color:${COLORS.text};font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:20px;">${escapeHtml(item)}</td>
      </tr>`,
    )
    .join("");

  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;margin:18px 0 0;background-color:${COLORS.card};border:1px solid ${COLORS.border};border-radius:8px;"><tr><td style="padding:16px 18px;">
    <p style="margin:0 0 12px;color:${COLORS.goldText};font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:18px;font-weight:bold;letter-spacing:1.1px;text-transform:uppercase;">Muy pronto podrás disfrutar de</p>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;border-collapse:collapse;">${rows}</table>
  </td></tr></table>`;
}

function closing(): string {
  return `<p style="margin:22px 0 0;color:${COLORS.text};font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:21px;"><strong>¡Estamos muy contentos de estar cada vez más cerca de darte la bienvenida al IIMP!</strong></p>
    <p style="margin:16px 0 0;color:${COLORS.text};font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:21px;">Atentamente,<br><strong>Área de Asociados</strong></p>`;
}

export function buildIncorporationPaymentRequestEmail(input: IncorporationPaymentRequestTemplateInput): string {
  const name = input.fullName.trim() || "Postulante";

  const content = `
    ${approvalIcon()}
    <p style="margin:0 0 14px;color:${COLORS.text};font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;">Estimado(a) <strong>${escapeHtml(name)}</strong>:</p>
    <p style="margin:0 0 14px;color:${COLORS.text};font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;">Nos complace informarte que, luego de culminar satisfactoriamente el proceso de evaluación, el Comité de Asociados del Instituto de Ingenieros de Minas del Perú ha aprobado tu solicitud de afiliación.</p>
    <p style="margin:0 0 14px;color:${COLORS.text};font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;">Agradecemos tu interés en formar parte de nuestra institución y de una comunidad comprometida con el desarrollo profesional, la generación de conocimiento y el fortalecimiento del sector minero.</p>
    <p style="margin:0 0 14px;color:${COLORS.text};font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;">Para finalizar tu proceso de incorporación y activar tu membresía, únicamente tienes pendiente realizar el pago correspondiente.</p>
    ${affiliationCard(input)}
    ${sectionTitle("¿Cómo completar tu afiliación?")}
    <p style="margin:0 0 14px;color:${COLORS.text};font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;">Ahora puedes realizar tu pago en línea desde nuestro sistema de afiliaciones, siguiendo estos sencillos pasos:</p>
    ${steps()}
    ${emailCta("Completar mi afiliación y pagar", input.consultaUrl)}
    <p style="margin:0 0 8px;color:${COLORS.secondary};font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:17px;text-align:center;word-break:break-all;">Enlace oficial: <a href="${safeUrl(input.consultaUrl)}" target="_blank" rel="noopener noreferrer" style="color:${COLORS.goldText};text-decoration:none;">${escapeHtml(input.consultaUrl)}</a></p>
    ${paymentMethods(input)}
    ${sectionTitle("¿Qué sucede después de realizar el pago?")}
    <p style="margin:0;color:${COLORS.text};font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;">Una vez confirmado tu pago, continuaremos con el proceso de incorporación y recibirás las indicaciones correspondientes para acceder al portal de asociados y disfrutar de los beneficios de tu membresía.</p>
    ${benefits()}
    ${sectionTitle("¿Necesitas ayuda?")}
    <p style="margin:0;color:${COLORS.text};font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;">Si tienes alguna consulta o necesitas asistencia durante el proceso de pago, nuestro equipo de Asociados estará a tu disposición para brindarte el acompañamiento necesario. Puedes utilizar el correo de contacto indicado al pie de este mensaje.</p>
    ${closing()}
  `;

  return emailLayout({
    category: "Afiliación IIMP",
    title: "¡Tu solicitud ha sido aprobada!",
    summary: "Estás a un paso de convertirte en asociado del IIMP.",
    content,
    logoUrl: `cid:${INCORPORATION_PAYMENT_REQUEST_LOGO_CID}`,
    maxWidth: 600,
  });
}
