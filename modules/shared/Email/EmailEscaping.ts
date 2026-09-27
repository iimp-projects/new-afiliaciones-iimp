/** Escapes untrusted text before it is inserted into email HTML. */
export function escapeHtml(value: string | number | null | undefined): string {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;",
  })[character]!);
}

/** Attribute escaping is deliberately separate from text escaping. */
export function escapeHtmlAttribute(value: string): string {
  return escapeHtml(value);
}

/** Only accepts absolute HTTP(S) URLs for href/src attributes. */
export function safeUrl(value: string): string {
  const url = new URL(value);
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("Email URL must use HTTP(S)");
  return escapeHtmlAttribute(url.toString());
}
