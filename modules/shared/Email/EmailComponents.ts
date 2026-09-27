import { escapeHtml, safeUrl } from "./EmailEscaping";

export type EmailVariant = "success" | "info" | "warning" | "error" | "neutral";

const variants: Record<EmailVariant, { icon: string; color: string; background: string; border: string }> = {
  success: { icon: "✓", color: "#1d6f42", background: "#edf8f0", border: "#b9dfc4" },
  info: { icon: "i", color: "#245b89", background: "#edf5fb", border: "#bfd7ec" },
  warning: { icon: "!", color: "#935f10", background: "#fff7e8", border: "#e9cd96" },
  error: { icon: "!", color: "#a32626", background: "#fff0f0", border: "#eabcbc" },
  neutral: { icon: "•", color: "#566174", background: "#f4f6f8", border: "#d9dee5" },
};

export function emailStatus(title: string, summary: string | undefined, variant: EmailVariant): string {
  const style = variants[variant];
  return `<tr><td align="center" style="padding:30px 28px 12px;"><span style="display:inline-block;width:42px;height:42px;line-height:42px;border-radius:21px;background:${style.background};border:1px solid ${style.border};color:${style.color};font-family:Arial,sans-serif;font-size:24px;font-weight:bold;">${style.icon}</span><h1 style="margin:16px 0 0;color:#172033;font-family:Arial,Helvetica,sans-serif;font-size:24px;line-height:30px;">${escapeHtml(title)}</h1>${summary ? `<p style="margin:9px 0 0;color:#667085;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:21px;">${escapeHtml(summary)}</p>` : ""}</td></tr>`;
}

export function emailInfoBox(content: string, variant: EmailVariant = "neutral"): string {
  const style = variants[variant];
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:20px 0;border:1px solid ${style.border};border-radius:8px;background:${style.background};"><tr><td style="padding:16px 18px;color:#344054;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:21px;">${content}</td></tr></table>`;
}

export function emailCta(label: string, url: string): string {
  return `<table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin:26px auto;"><tr><td align="center" bgcolor="#9A681F" style="border-radius:7px;"><a href="${safeUrl(url)}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:13px 24px;border-radius:7px;color:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:bold;letter-spacing:.2px;text-decoration:none;">${escapeHtml(label)} →</a></td></tr></table>`;
}
