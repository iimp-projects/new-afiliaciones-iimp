import { NextRequest, NextResponse } from "next/server";
import { ValidateDocumentService } from "@/modules/afiliaciones/postulacion/Services/ValidateDocumentService";
import { VerificationError } from "@/modules/shared/Models/VerificationError";

export async function POST(request: NextRequest) {
  try {
    const { documentType, documentNumber, affiliateType } = await request.json();
    const service = new ValidateDocumentService();
    const result = await service.execute(documentType, documentNumber, affiliateType);
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof VerificationError) return NextResponse.json({ code: "INVALID_INPUT", message: error.message }, { status: 400 });
    return NextResponse.json({ message: "Error interno" }, { status: 500 });
  }
}
