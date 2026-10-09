import { emailLayout } from "@/modules/shared/Email/EmailLayout";
import { emailCta, emailInfoBox } from "@/modules/shared/Email/EmailComponents";
import { escapeHtml, safeUrl } from "@/modules/shared/Email/EmailEscaping";

/**
 * Plantilla institucional de bienvenida al nuevo Sistema de Afiliaciones IIMP.
 *
 * Reutiliza el layout compartido (EmailLayout / EmailComponents / EmailEscaping)
 * y NUNCA incluye contraseñas. El acceso se realiza a través de los mecanismos
 * seguros existentes (inicio de sesión y recuperación de contraseña).
 */

export interface AssociateWelcomeInput {
  /** Nombre del asociado (personalización segura, escapada al renderizar). */
  name: string;
  /** URL de acceso al portal (p. ej. https://afiliaciones.iimp.org.pe/login). */
  accessUrl: string;
  /** URL opcional de recuperación de contraseña. */
  recoveryUrl?: string;
}

export interface AssociateWelcomeEmail {
  subject: string;
  html: string;
  text: string;
}

export function associateWelcomeEmail({ name, accessUrl, recoveryUrl }: AssociateWelcomeInput): AssociateWelcomeEmail {
  const subject = "Bienvenido al nuevo Sistema de Afiliaciones IIMP";
  const safeName = escapeHtml(name.trim() || "Asociado");

  let recoveryLink = "";
  if (recoveryUrl) {
    try {
      recoveryLink = ` <a href="${safeUrl(recoveryUrl)}" style="color:#9A681F;">Recuperar acceso</a>`;
    } catch {
      recoveryLink = "";
    }
  }

  const html = emailLayout({
    category: "Acceso al Sistema",
    title: "Bienvenido(a) al nuevo Sistema de Afiliaciones",
    summary: "El Instituto de Ingenieros de Minas del Perú pone a tu disposición su nueva plataforma de afiliaciones.",
    variant: "success",
    content: `<p>Estimado(a) <strong>${safeName}</strong>,</p><p>Nos complace informarte que ya puedes acceder al <strong style="color:#18253a;">nuevo Sistema de Afiliaciones del IIMP</strong>, donde podrás consultar tu información institucional y realizar tus trámites de manera digital.</p>${emailInfoBox(`Tu usuario de acceso es el correo electrónico con el que recibiste este mensaje.`, "info")}${emailCta("ACCEDER AL SISTEMA", accessUrl)}<p style="font-size:12px;color:#667085;text-align:center;">Si aún no cuentas con una contraseña o no la recuerdas, utiliza la opción <strong>“Recuperar acceso”</strong> en la página de inicio para establecerla de forma segura.${recoveryLink}</p>`,
  });

  const text = [
    `Estimado(a) ${name.trim() || "Asociado"},`,
    "",
    "Nos complace informarte que ya puedes acceder al nuevo Sistema de Afiliaciones del IIMP.",
    "",
    "Tu usuario de acceso es el correo electrónico con el que recibiste este mensaje.",
    "",
    `Accede al sistema aquí: ${accessUrl}`,
    "",
    "Si aún no cuentas con una contraseña o no la recuerdas, utiliza la opción \"Recuperar acceso\" en la página de inicio.",
    "",
    "Saludos cordiales,",
    "Sistema de Afiliaciones",
    "Instituto de Ingenieros de Minas del Perú",
  ].join("\n");

  return { subject, html, text };
}
