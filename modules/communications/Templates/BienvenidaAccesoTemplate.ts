import { emailLayout, emailParagraph } from "@/modules/shared/Email/EmailLayout";
import { emailInfoBox } from "@/modules/shared/Email/EmailComponents";

export interface BienvenidaAccesoContent {
  name: string;
  subject: string;
  htmlContent: string;
  textContent: string;
}

/**
 * Plantilla institucional "Bienvenida y acceso al nuevo Sistema de Afiliaciones IIMP".
 *
 * Variables disponibles (se sustituyen por destinatario al enviar):
 *   {{nombre_completo}}, {{correo_acceso}}, {{tipo_asociado}},
 *   {{enlace_acceso}} (URL oficial de acceso) y {{enlace_activacion}}
 *   (URL de activación; solo presente para cuentas pendientes).
 *
 * El bloque `{{#enlace_activacion}}…{{/enlace_activacion}}` se incluye únicamente
 * cuando la cuenta está pendiente de activación, tanto en HTML como en texto plano.
 *
 * Reutiliza el diseño institucional de `modules/shared/Email`.
 */
export function bienvenidaAccesoContent(): BienvenidaAccesoContent {
  const subject = "Bienvenida y acceso al nuevo Sistema de Afiliaciones IIMP";

  const activationBlock = [
    `{{#enlace_activacion}}`,
    emailParagraph("Tu cuenta aún está pendiente de activación. Crea tu contraseña para ingresar:"),
    `<table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin:26px auto;"><tr><td align="center" bgcolor="#C5A059" style="background-color:#C5A059;border-radius:8px;"><a href="{{enlace_activacion}}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:15px 38px;border-radius:8px;color:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:20px;font-weight:bold;text-decoration:none;">ACTIVAR MI CUENTA &nbsp;→</a></td></tr></table>`,
    `{{/enlace_activacion}}`,
  ].join("");

  const content = [
    emailParagraph("Hola, {{nombre_completo}}:"),
    emailParagraph("Nos complace darte la bienvenida al nuevo Sistema de Afiliaciones del Instituto de Ingenieros de Minas del Perú."),
    emailInfoBox("Tu correo de acceso es:<br><strong>{{correo_acceso}}</strong>", "info"),
    emailParagraph("Ingresa al portal de asociados con el correo indicado usando el enlace oficial:"),
    `<table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin:26px auto;"><tr><td align="center" bgcolor="#C5A059" style="background-color:#C5A059;border-radius:8px;"><a href="{{enlace_acceso}}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:15px 38px;border-radius:8px;color:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:20px;font-weight:bold;text-decoration:none;">INGRESAR AL SISTEMA &nbsp;→</a></td></tr></table>`,
    activationBlock,
    emailParagraph("Si tienes dudas, comunícate con nosotros a través de los canales oficiales del IIMP."),
  ].join("");

  const htmlContent = emailLayout({
    category: "Sistema de Afiliaciones IIMP",
    title: "Bienvenida y acceso",
    summary: "Tu acceso al nuevo portal de asociados",
    content,
  });

  const textContent = [
    "Hola, {{nombre_completo}}:",
    "Te damos la bienvenida al nuevo Sistema de Afiliaciones del IIMP.",
    "Tu correo de acceso es: {{correo_acceso}}",
    "Ingresa al portal en: {{enlace_acceso}}",
    "{{#enlace_activacion}}Tu cuenta está pendiente de activación. Actívala aquí: {{enlace_activacion}}{{/enlace_activacion}}",
  ].join("\n\n");

  return {
    name: "Bienvenida y acceso al nuevo Sistema de Afiliaciones IIMP",
    subject,
    htmlContent,
    textContent,
  };
}
