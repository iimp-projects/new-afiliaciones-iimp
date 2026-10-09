import { NextResponse } from "next/server";
import { authAdapter } from "@/modules/auth/context/adapter";
import { sessionService } from "@/modules/auth/session/service";

export const dynamic = "force-dynamic";

function response(status: ReturnType<typeof sessionService.getSessionStatus>, httpStatus = 200) {
  return NextResponse.json({
    valid: status.valid,
    serverNow: status.serverNow.toISOString(),
    expiresAt: status.expiresAt?.toISOString() ?? null,
    lastActivityAt: status.lastActivityAt?.toISOString() ?? null,
    effectiveExpiresAt: status.effectiveExpiresAt?.toISOString() ?? null,
    expiryReason: status.expiryReason,
  }, { status: httpStatus, headers: { "Cache-Control": "no-store" } });
}

/** Lee el estado sin llamar touchSession(): consultar nunca cuenta como actividad. */
export async function GET() {
  const sessionId = await authAdapter.getSessionIdFromJWT();
  if (!sessionId) return response(sessionService.getSessionStatus(null), 401);
  return response(sessionService.getSessionStatus(await sessionService.getSessionById(sessionId)));
}
