"use client";

import { useState } from "react";
import type { NiubizSessionDiagnostic } from "../DTOs/Niubiz/NiubizSessionDiagnostic.dto";

type EvidenceKind = "request" | "response";

interface Props {
  diagnostic: NiubizSessionDiagnostic;
  onContinue: () => void;
  onCancel: () => void;
}

async function saveEvidencePng(kind: EvidenceKind, diagnostic: NiubizSessionDiagnostic): Promise<string> {
  const response = await fetch("/api/payments/niubiz/diagnostic/png", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind, diagnostic }),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.message || "No se pudo guardar la evidencia.");
  return data.path as string;
}

async function copyText(text: string): Promise<void> {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  document.body.removeChild(textarea);
}

export function NiubizSessionDiagnostic({ diagnostic, onContinue, onCancel }: Props) {
  const [saving, setSaving] = useState<EvidenceKind | null>(null);
  const [copied, setCopied] = useState<EvidenceKind | null>(null);
  const [savedPaths, setSavedPaths] = useState<Partial<Record<EvidenceKind, string>>>({});
  const [error, setError] = useState<string | null>(null);

  const verification = diagnostic.verification;
  const requestJson = JSON.stringify(diagnostic.request, null, 2);
  const responseJson = JSON.stringify(diagnostic.response, null, 2);
  const redactedRequestJson = JSON.stringify(diagnostic.redacted.request, null, 2);
  const redactedResponseJson = JSON.stringify(diagnostic.redacted.response, null, 2);

  const handleSavePng = async (kind: EvidenceKind) => {
    setSaving(kind);
    setError(null);
    try {
      const path = await saveEvidencePng(kind, diagnostic);
      setSavedPaths((paths) => ({ ...paths, [kind]: path }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar la evidencia.");
    } finally {
      setSaving(null);
    }
  };

  const handleCopy = async (kind: EvidenceKind) => {
    setError(null);
    try {
      await copyText(kind === "request" ? redactedRequestJson : redactedResponseJson);
      setCopied(kind);
      setTimeout(() => setCopied((current) => (current === kind ? null : current)), 2000);
    } catch {
      setError("No se pudo copiar al portapapeles.");
    }
  };

  const mddBadge = (ok: boolean, label: string) => (
    <div className="rounded-lg bg-[#161b22] px-2 py-1.5 text-center">
      <p className="text-[10px] font-bold text-[#8b949e]">{label}</p>
      <p className={`text-xs font-black ${ok ? "text-[#3fb950]" : "text-[#ff7b72]"}`}>{ok ? "OK" : "FALTA"}</p>
    </div>
  );

  return (
    <div className="rounded-2xl border border-[#1f6feb]/40 bg-[#0d1117] p-5 text-[#e6edf3] shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-black text-white">Sesión Niubiz TEST creada</p>
          <p className="mt-1 text-xs text-[#8b949e]">
            Modo de pausa de certificación. La sesión real fue creada; el Checkout aún no se abrió.
          </p>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[#1f6feb] bg-[#1f6feb]/20 px-2.5 py-1 text-[11px] font-bold text-[#58a6ff]">
          NIUBIZ_TEST_LOCAL
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
        {mddBadge(verification.mdd4, "MDD4")}
        {mddBadge(verification.mdd32, "MDD32")}
        {mddBadge(verification.mdd75, "MDD75")}
        <div className="rounded-lg bg-[#161b22] px-2 py-1.5 text-center">
          <p className="text-[10px] font-bold text-[#8b949e]">MDD77</p>
          <p className={`text-xs font-black ${verification.mdd77 ? "text-[#3fb950]" : "text-[#ff7b72]"}`}>{verification.mdd77 ? "OK" : "FALTA"}</p>
        </div>
        <div className="rounded-lg bg-[#161b22] px-2 py-1.5 text-center">
          <p className="text-[10px] font-bold text-[#8b949e]">dataMap</p>
          <p className={`text-xs font-black ${verification.missingDataMapFields.length === 0 ? "text-[#3fb950]" : "text-[#ff7b72]"}`}>{verification.dataMapFields.length}/6</p>
        </div>
      </div>
      {verification.mdd77Note && <p className="mt-2 text-[11px] italic text-[#8b949e]">{verification.mdd77Note}</p>}
      {verification.missingDataMapFields.length > 0 && (
        <p className="mt-2 text-[11px] font-bold text-[#ff7b72]">Campos de dataMap ausentes: {verification.missingDataMapFields.join(", ")}</p>
      )}

      <div className="mt-5 space-y-5">
        <section>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-black text-white">Request API Session</p>
              <p className="text-[11px] text-[#8b949e]">JSON completo enviado a Niubiz (MDD4, MDD32, MDD75, MDD77 y dataMap).</p>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => handleCopy("request")} className="rounded-lg bg-[#1f6feb]/20 px-3 py-1.5 text-xs font-bold text-[#58a6ff] transition hover:bg-[#1f6feb]/30">{copied === "request" ? "¡Copiado!" : "Copiar JSON"}</button>
              <button type="button" onClick={() => handleSavePng("request")} disabled={saving !== null} className="rounded-lg bg-[#238636]/20 px-3 py-1.5 text-xs font-bold text-[#3fb950] transition hover:bg-[#238636]/30 disabled:cursor-not-allowed disabled:opacity-50">{saving === "request" ? "Guardando..." : "Guardar PNG"}</button>
            </div>
          </div>
          <pre className="mt-2 max-h-80 overflow-auto rounded-lg border border-[#30363d] bg-[#161b22] p-4 text-[11px] leading-relaxed text-[#e6edf3]">{requestJson}</pre>
        </section>

        <section>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-black text-white">Response API Session</p>
              <p className="text-[11px] text-[#8b949e]">JSON real devuelto por Niubiz.</p>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => handleCopy("response")} className="rounded-lg bg-[#1f6feb]/20 px-3 py-1.5 text-xs font-bold text-[#58a6ff] transition hover:bg-[#1f6feb]/30">{copied === "response" ? "¡Copiado!" : "Copiar JSON"}</button>
              <button type="button" onClick={() => handleSavePng("response")} disabled={saving !== null} className="rounded-lg bg-[#238636]/20 px-3 py-1.5 text-xs font-bold text-[#3fb950] transition hover:bg-[#238636]/30 disabled:cursor-not-allowed disabled:opacity-50">{saving === "response" ? "Guardando..." : "Guardar Response PNG"}</button>
            </div>
          </div>
          <pre className="mt-2 max-h-80 overflow-auto rounded-lg border border-[#30363d] bg-[#161b22] p-4 text-[11px] leading-relaxed text-[#e6edf3]">{responseJson}</pre>
        </section>
      </div>

      {error && <p className="mt-3 rounded-lg bg-[#b62324]/20 px-3 py-2 text-xs font-bold text-[#ff7b72]">{error}</p>}
      {(savedPaths.request || savedPaths.response) && (
        <div className="mt-3 space-y-1 rounded-lg bg-[#161b22] px-3 py-2 text-[11px] text-[#3fb950]">
          {savedPaths.request && <p className="break-all">Request PNG: {savedPaths.request}</p>}
          {savedPaths.response && <p className="break-all">Response PNG: {savedPaths.response}</p>}
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button type="button" onClick={onContinue} className="rounded-xl bg-[#C5A059] px-5 py-2.5 text-sm font-extrabold text-white transition hover:brightness-95">Continuar al checkout</button>
        <button type="button" onClick={onCancel} className="rounded-xl border border-[#30363d] bg-[#161b22] px-5 py-2.5 text-sm font-bold text-[#e6edf3] transition hover:bg-[#1f242b]">Cancelar prueba</button>
      </div>
    </div>
  );
}
