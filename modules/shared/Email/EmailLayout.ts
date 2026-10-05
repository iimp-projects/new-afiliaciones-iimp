import { getAppBaseUrl } from "@/lib/config/env";
import { escapeHtml, safeUrl } from "./EmailEscaping";
import type { EmailVariant } from "./EmailComponents";

export interface EmailLayoutOptions {
  title: string;
  summary?: string;
  /** Etiqueta superior en mayúsculas que describe el contexto del correo. */
  category?: string;
  /** Se conserva por compatibilidad; la presentación ya no lo utiliza. */
  variant?: EmailVariant;
  content: string;
}

export function emailLogoUrl(): string | null {
  try { return `${getAppBaseUrl(process.env, { allowDevDefault: false })}/images/logo-iimp.png`; }
  catch { return null; }
}

export function emailLayout({ title, summary, category = "PORTAL DE AFILIACIONES", content }: EmailLayoutOptions): string {
  const logo = emailLogoUrl();
  const logoCell = logo ? `<img src="${safeUrl(logo)}" alt="Instituto de Ingenieros de Minas del Perú" width="180" style="display:block;width:180px;max-width:100%;height:auto;margin:0 auto 20px;border:0;outline:none;">` : "";
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light"></head><body style="margin:0;padding:0;background-color:#f3f4f6;font-family:Arial,Helvetica,sans-serif;color:#1f2937;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;background-color:#f3f4f6;"><tr><td align="center" style="padding:30px 15px;"><table role="presentation" width="640" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:640px;background-color:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e5e7eb;"><tr><td height="6" style="height:6px;background-color:#C5A059;font-size:0;line-height:0;">&nbsp;</td></tr><tr><td align="center" style="background-color:#ffffff;padding:25px 35px 24px;border-bottom:1px solid #eeeeee;">${logoCell}<table role="presentation" width="55" cellspacing="0" cellpadding="0" border="0" align="center" style="margin:0 auto 18px;"><tr><td height="3" style="height:3px;background-color:#C5A059;font-size:0;line-height:0;">&nbsp;</td></tr></table><div style="color:#9A7838;font-size:11px;line-height:16px;font-weight:bold;letter-spacing:2.4px;text-transform:uppercase;margin-bottom:10px;">${escapeHtml(category)}</div><div style="color:#18253a;font-size:24px;line-height:32px;font-weight:700;max-width:550px;margin:0 auto;">${escapeHtml(title)}</div>${summary ? `<div style="color:#7b8491;font-size:13px;line-height:20px;margin-top:9px;">${escapeHtml(summary)}</div>` : ""}</td></tr><tr><td style="padding:28px 45px 10px;color:#4b5563;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;">${content}</td></tr>${emailFooter()}</table></td></tr></table></body></html>`;
}

export function emailParagraph(value: string): string { return `<p style="margin:0 0 16px;">${escapeHtml(value)}</p>`; }

/** Pie institucional de Afiliaciones. Textos y datos sin cambios. */
export function emailFooter(): string {
  return `<tr><td align="center" style="padding:24px 28px;background:#FAF8F4;border-top:1px solid #E7E2D9;color:#667085;font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:17px;"><strong style="color:#344054;">Instituto de Ingenieros de Minas del Perú</strong><br>Calle Los Canarios 155-157,<br>Urb. San César II Etapa, La Molina, Lima 12, Perú.<br><a href="mailto:asociados@iimp.org.pe" style="color:#9A681F;text-decoration:none;">asociados@iimp.org.pe</a><br><a href="mailto:liset.otoya@iimp.org.pe" style="color:#9A681F;text-decoration:none;">liset.otoya@iimp.org.pe</a><br>Lunes a viernes de 09:00 a 18:00 hrs.<br><br>Este es un correo automático del Portal de Afiliaciones del IIMP.<br>Por favor, no respondas directamente a este mensaje.<br><br>© 2026 Instituto de Ingenieros de Minas del Perú.<br>Todos los derechos reservados.</td></tr>`;
}
