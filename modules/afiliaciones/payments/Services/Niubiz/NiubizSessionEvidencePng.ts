import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import puppeteer from "puppeteer";
import type { NiubizSessionDiagnostic } from "../../DTOs/Niubiz/NiubizSessionDiagnostic.dto";
import { isCertPauseEnabled } from "./NiubizSessionDiagnostics";
import { redactDiagnostic } from "./NiubizSessionEvidence";

const EVIDENCE_DIR = path.join(process.cwd(), "docs", "niubiz-certificacion", "local");

export type EvidenceKind = "request" | "response";

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  })[character]!);
}

function buildHtml(title: string, subtitle: string, badge: string, meta: string, body: unknown): string {
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<style>
  body { background:#0d1117; color:#e6edf3; font-family: -apple-system, Segoe UI, Roboto, sans-serif; padding:32px; margin:0; }
  h1 { font-size:20px; margin:0 0 4px; }
  h2 { font-size:14px; color:#58a6ff; margin:0 0 16px; font-weight:600; }
  .meta { font-family: ui-monospace, SFMono-Regular, Consolas, monospace; font-size:13px; color:#8b949e; margin-bottom:16px; }
  pre { background:#161b22; border:1px solid #30363d; border-radius:6px; padding:16px; font-family: ui-monospace, SFMono-Regular, Consolas, monospace; font-size:13px; line-height:1.5; overflow-x:auto; white-space:pre-wrap; }
  .badge { display:inline-block; padding:2px 8px; border-radius:999px; font-size:11px; font-weight:700; letter-spacing:.4px; }
  .badge.test { background:#1f6feb33; color:#58a6ff; border:1px solid #1f6feb; }
</style>
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  <h2>${escapeHtml(subtitle)}</h2>
  <div class="meta"><span class="badge test">${escapeHtml(badge)}</span>&nbsp;${escapeHtml(meta)}</div>
  <pre>${escapeHtml(JSON.stringify(body, null, 2))}</pre>
</body>
</html>`;
}

/**
 * Renderiza la evidencia (request o response) a PNG con Puppeteer y la guarda
 * en `docs/niubiz-certificacion/local/`. Solo opera cuando el modo de pausa de
 * certificación está habilitado. Devuelve la ruta absoluta del PNG.
 */
export async function renderSessionEvidencePng(
  kind: EvidenceKind,
  diagnostic: NiubizSessionDiagnostic,
): Promise<string> {
  if (!isCertPauseEnabled()) {
    throw new Error("NIUBIZ_CERT_PAUSE_AFTER_SESSION no está habilitado; no se generan PNG.");
  }

  const redacted = redactDiagnostic(diagnostic);
  const safe = diagnostic.correlationId.replace(/[^a-zA-Z0-9_-]/g, "");
  const isRequest = kind === "request";
  const title = isRequest
    ? "NIUBIZ-CERT-LOCAL-02 — Request API Session + MDD4, MDD32, MDD75, MDD77 y dataMap"
    : "NIUBIZ-CERT-LOCAL-02 — Response API Session";
  const subtitle = isRequest
    ? "Evidencia — Request redactado (sin Authorization, MDD4/MDD32 ni datos personales)"
    : "Evidencia — Response redactado (sin sessionKey ni datos sensibles)";
  const meta = isRequest
    ? `${redacted.request.method} ${redacted.request.url}`
    : `HTTP ${redacted.response.httpStatus}`;
  const body = isRequest ? redacted.request : redacted.response;

  const html = buildHtml(title, subtitle, "NIUBIZ_TEST_LOCAL", meta, body);
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-gpu"],
  });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1080, height: 900, deviceScaleFactor: 2 });
    await page.setContent(html, { waitUntil: "load" });

    await mkdir(EVIDENCE_DIR, { recursive: true });
    const outPath = path.join(EVIDENCE_DIR, `${safe}-${kind}.png`);
    await page.screenshot({ path: outPath, fullPage: true });
    return outPath;
  } finally {
    await browser.close();
  }
}
