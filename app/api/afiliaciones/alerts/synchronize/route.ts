import { NextResponse } from "next/server";
import { contextService } from "@/modules/auth/context/service";
import { AuthenticationError, AuthorizationError } from "@/modules/auth/errors";
import { operationalAlertTrackingService } from "@/modules/afiliaciones/alerts/Services/OperationalAlertTrackingService";

export async function POST() {
  try {
    await contextService.requirePermission("update", "memberships");
    return NextResponse.json(await operationalAlertTrackingService.synchronize());
  } catch (error) {
    const unauthorized = error instanceof AuthenticationError || error instanceof AuthorizationError;
    return NextResponse.json({ message: unauthorized ? "No autorizado." : "No fue posible sincronizar las alertas." }, { status: unauthorized ? 403 : 500 });
  }
}
