import { isValidRuc } from "@/modules/afiliaciones/payments/Rules/BillingDocumentRules";
import { ApisNetPeService } from "@/modules/shared/Services/ApisNetPeService";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
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
