import { NextResponse } from "next/server";
import { isCertPauseEnabled } from "@/modules/afiliaciones/payments/Services/Niubiz/NiubizSessionDiagnostics";
import { renderSessionEvidencePng, type EvidenceKind } from "@/modules/afiliaciones/payments/Services/Niubiz/NiubizSessionEvidencePng";
import type { NiubizSessionDiagnostic } from "@/modules/afiliaciones/payments/DTOs/Niubiz/NiubizSessionDiagnostic.dto";

interface DiagnosticPngRequest {
  kind?: unknown;
  diagnostic?: unknown;
}

function isDiagnostic(value: unknown): value is NiubizSessionDiagnostic {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.correlationId === "string" &&
    typeof record.capturedAt === "string" &&
    typeof record.request === "object" &&
    typeof record.response === "object"
  );
}

export async function POST(request: Request) {
  if (!isCertPauseEnabled()) {
    return NextResponse.json({ message: "No encontrado." }, { status: 404 });
  }

  let body: DiagnosticPngRequest;
  try {
    body = (await request.json()) as DiagnosticPngRequest;
  } catch {
    return NextResponse.json({ message: "Solicitud inválida." }, { status: 400 });
  }

  const kind = body.kind === "request" || body.kind === "response" ? body.kind : null;
  if (!kind || !isDiagnostic(body.diagnostic)) {
    return NextResponse.json({ message: "Solicitud inválida." }, { status: 400 });
  }

  try {
    const path = await renderSessionEvidencePng(kind as EvidenceKind, body.diagnostic);
    return NextResponse.json({ path });
  } catch (error) {
    console.error("[NIUBIZ_CERT] No se pudo generar el PNG de evidencia.", { kind, errorName: error instanceof Error ? error.name : "UnknownError" });
    return NextResponse.json({ message: "No se pudo generar el PNG de evidencia." }, { status: 500 });
  }
}
