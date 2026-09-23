import { NextRequest, NextResponse } from "next/server";
import { ValidateDocumentService } from "@/modules/afiliaciones/postulacion/Services/ValidateDocumentService";
import { VerificationError } from "@/modules/shared/Models/VerificationError";
import { verificationTokenRateLimiter } from "@/modules/auth/rate-limit/VerificationTokenRateLimiter";

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
    if (!(await verificationTokenRateLimiter.consume("validate-document", ip, 10, 15))) {
      return NextResponse.json({ message: "Demasiadas consultas. Intente nuevamente mÃ¡s tarde." }, { status: 429 });
    }
    const { documentType, documentNumber, affiliateType } = await request.json();
    const service = new ValidateDocumentService();
    const result = await service.execute(documentType, documentNumber, affiliateType);
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof VerificationError) return NextResponse.json({ code: "INVALID_INPUT", message: error.message }, { status: 400 });
    return NextResponse.json({ message: "Error interno" }, { status: 500 });
  }
}
