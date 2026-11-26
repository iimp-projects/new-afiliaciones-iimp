import { NextResponse } from "next/server";
import { consumeRateLimit } from "@/lib/security/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_LOG_BYTES = 32 * 1024;

/**
 * Endpoint de logs del protocolo PassKit. Se acepta el cuerpo sin persistirlo
 * para no almacenar información del dispositivo ni credenciales. El tamaño y
 * la tasa están acotados para evitar abuso.
 */
export async function POST(request: Request) {
  if (!consumeRateLimit("passkit:log", 240, 60_000).allowed) {
    return new NextResponse(null, { status: 429 });
  }
  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declaredLength) && declaredLength > MAX_LOG_BYTES) {
    return new NextResponse(null, { status: 413 });
  }
  const reader = request.body?.getReader();
  if (reader) {
    let total = 0;
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > MAX_LOG_BYTES) {
          await reader.cancel().catch(() => undefined);
          return new NextResponse(null, { status: 413 });
        }
      }
    } catch {
      return new NextResponse(null, { status: 400 });
    }
  }
  return new NextResponse(null, { status: 200 });
}
