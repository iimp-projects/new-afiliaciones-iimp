import { NextResponse } from "next/server";
import { getAppBaseUrl } from "@/lib/config/env";
import { authAdapter } from "@/modules/auth/context/adapter";
import { sessionService } from "@/modules/auth/session/service";

export const dynamic = "force-dynamic";

function hasSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  return origin === new URL(getAppBaseUrl()).origin;
}

function response(status: Awaited<ReturnType<typeof sessionService.registerActivity>>, httpStatus = 200) {
  return NextResponse.json({
    valid: status.valid,
    serverNow: status.serverNow.toISOString(),
    expiresAt: status.expiresAt?.toISOString() ?? null,
    lastActivityAt: status.lastActivityAt?.toISOString() ?? null,
    effectiveExpiresAt: status.effectiveExpiresAt?.toISOString() ?? null,
    expiryReason: status.expiryReason,
  }, { status: httpStatus, headers: { "Cache-Control": "no-store" } });
}

/** POST y validación Origin evitan que un sitio externo genere actividad con cookies ajenas. */
export async function POST(request: Request) {
  if (!hasSameOrigin(request)) return NextResponse.json({ message: "Origen no permitido." }, { status: 403 });
  const sessionId = await authAdapter.getSessionIdFromJWT();
  if (!sessionId) return response(sessionService.getSessionStatus(null), 401);
  const status = await sessionService.registerActivity(sessionId);
  return response(status, status.valid ? 200 : 401);
}
