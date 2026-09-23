import { isValidRuc } from "@/modules/afiliaciones/payments/Rules/BillingDocumentRules";
import { ApisNetPeService } from "@/modules/shared/Services/ApisNetPeService";
import { NextRequest, NextResponse } from "next/server";
import { verificationTokenRateLimiter } from "@/modules/auth/rate-limit/VerificationTokenRateLimiter";

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
    if (!(await verificationTokenRateLimiter.consume("validate-ruc", ip, 10, 15))) {
      return NextResponse.json({ message: "Demasiadas consultas. Intente nuevamente mÃ¡s tarde." }, { status: 429 });
    }
    const { ruc } = await request.json();
    if (typeof ruc !== "string" || !isValidRuc(ruc)) return NextResponse.json({ message: "RUC inválido." }, { status: 400 });
    const result = await new ApisNetPeService().getRuc(ruc);
    if (result.status === "VERIFIED") return NextResponse.json({ success: true, status: result.status, data: result.data });
    if (result.status === "NOT_FOUND") return NextResponse.json({ success: false, status: result.status, message: "No se encontró información para el RUC ingresado." }, { status: 404 });
    return NextResponse.json({ success: false, status: result.status, message: "El servicio de consulta RUC no está disponible temporalmente." }, { status: 502 });
  } catch (error) {
    console.error("[VALIDATE_RUC] Error inesperado:", error);
    return NextResponse.json({ success: false, status: "SERVICE_ERROR", message: "El servicio de consulta RUC no está disponible temporalmente." }, { status: 502 });
  }
}
