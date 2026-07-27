import { NextRequest, NextResponse } from "next/server";
import { ValidateDocumentService } from "@/modules/afiliaciones/postulacion/Services/ValidateDocumentService";

export async function POST(request: NextRequest) {
  try {
    const { documentType, documentNumber } = await request.json();
    const service = new ValidateDocumentService();
    const result = await service.execute(documentType, documentNumber);
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ message: "Error interno" }, { status: 500 });
  }
}