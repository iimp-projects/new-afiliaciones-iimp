import { NextResponse } from "next/server";
import { operationalAlertTrackingService } from "@/modules/afiliaciones/alerts/Services/OperationalAlertTrackingService";
import { contextService } from "@/modules/auth/context/service";
import { AuthenticationError, AuthorizationError } from "@/modules/auth/errors";

export async function GET() {
  try { await contextService.requirePermission("read", "memberships"); return NextResponse.json(await operationalAlertTrackingService.list()); }
  catch (error) {
    console.error("[OPERATIONAL_ALERTS_GET_ERROR]", { name: error instanceof Error ? error.name : "UnknownError", message: error instanceof Error ? error.message : String(error), prismaCode: typeof error === "object" && error !== null && "code" in error ? String(error.code) : null });
    const unauthorized = error instanceof AuthenticationError || error instanceof AuthorizationError;
    return NextResponse.json({ message: unauthorized ? "No autorizado." : "No fue posible consultar las alertas." }, { status: unauthorized ? 403 : 500 });
  }
}
