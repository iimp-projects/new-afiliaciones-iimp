import { getAppBaseUrl } from "@/lib/config/env";
import { escapeHtml, safeUrl } from "./EmailEscaping";
import type { EmailVariant } from "./EmailComponents";
import { emailStatus } from "./EmailComponents";

export interface EmailLayoutOptions { title: string; summary?: string; variant?: EmailVariant; content: string; }

export function emailLogoUrl(): string | null {
  try { return `${getAppBaseUrl(process.env, { allowDevDefault: false })}/images/logo-iimp.png`; }
  catch { return null; }
}

export function emailLayout({ title, summary, variant = "neutral", content }: EmailLayoutOptions): string {
  const logo = emailLogoUrl();
  const logoCell = logo ? `<img src="${safeUrl(logo)}" alt="Instituto de Ingenieros de Minas del Perú" width="76" style="display:block;width:76px;max-width:76px;height:auto;">` : "";
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head><body style="margin:0;padding:0;background:#F5F5F3;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#F5F5F3;"><tr><td align="center" style="padding:24px 10px;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:640px;background:#ffffff;border:1px solid #E7E2D9;border-radius:12px;overflow:hidden;"><tr><td style="padding:19px 24px;background:#9A681F;background-color:#9A681F;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr><td width="94" valign="middle">${logoCell}</td><td valign="middle" style="border-left:1px solid #D4A653;padding-left:16px;color:#ffffff;font-family:Arial,Helvetica,sans-serif;"><div style="font-size:12px;font-weight:bold;letter-spacing:1px;">PORTAL DE AFILIACIONES</div><div style="font-size:11px;line-height:16px;color:#F8ECD2;">Instituto de Ingenieros de Minas del Perú</div></td></tr></table></td></tr>${emailStatus(title, summary, variant)}<tr><td style="padding:10px 28px 28px;color:#344054;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;">${content}</td></tr>${emailFooter()}</table></td></tr></table></body></html>`;
}

export function emailParagraph(value: string): string { return `<p style="margin:0 0 16px;">${escapeHtml(value)}</p>`; }

/** Pie institucional de Afiliaciones. Textos y datos sin cambios. */
export function emailFooter(): string {
  return `<tr><td align="center" style="padding:24px 28px;background:#FAF8F4;border-top:1px solid #E7E2D9;color:#667085;font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:17px;"><strong style="color:#344054;">Instituto de Ingenieros de Minas del Perú</strong><br>Calle Los Canarios 155-157,<br>Urb. San César II Etapa, La Molina, Lima 12, Perú.<br><a href="mailto:asociados@iimp.org.pe" style="color:#9A681F;text-decoration:none;">asociados@iimp.org.pe</a><br><a href="mailto:liset.otoya@iimp.org.pe" style="color:#9A681F;text-decoration:none;">liset.otoya@iimp.org.pe</a><br>Lunes a viernes de 09:00 a 18:00 hrs.<br><br>Este es un correo automático del Portal de Afiliaciones del IIMP.<br>Por favor, no respondas directamente a este mensaje.<br><br>© 2026 Instituto de Ingenieros de Minas del Perú.<br>Todos los derechos reservados.</td></tr>`;
}
