import { escapeHtml, safeUrl } from "./EmailEscaping";

export type EmailVariant = "success" | "info" | "warning" | "error" | "neutral";

const barByVariant: Record<EmailVariant, string> = {
  success: "#1d6f42",
  info: "#245b89",
  warning: "#935f10",
  error: "#a32626",
  neutral: "#C5A059",
};

export function emailInfoBox(content: string, variant: EmailVariant = "neutral"): string {
  const bar = barByVariant[variant];
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;margin:20px 0;background-color:#faf8f2;border:1px solid #eee4cf;border-radius:10px;"><tr><td width="5" style="width:5px;background-color:${bar};border-radius:10px 0 0 10px;">&nbsp;</td><td style="padding:16px 18px;color:#344054;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:21px;">${content}</td></tr></table>`;
}

export function emailCta(label: string, url: string): string {
  return `<table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin:26px auto;"><tr><td align="center" bgcolor="#C5A059" style="background-color:#C5A059;border-radius:8px;"><a href="${safeUrl(url)}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:15px 38px;border-radius:8px;color:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:20px;font-weight:bold;text-decoration:none;">${escapeHtml(label)} &nbsp;→</a></td></tr></table>`;
}
