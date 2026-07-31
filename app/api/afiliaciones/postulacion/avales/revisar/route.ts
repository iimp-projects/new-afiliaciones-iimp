import { NextRequest, NextResponse } from "next/server";
import { ReviewEndorsementService } from "@/modules/afiliaciones/postulacion/Services/ReviewEndorsementService";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, action } = body;

    if (!token || !["APPROVE", "REJECT"].includes(action)) {
      return NextResponse.json({ success: false, message: "Parámetros inválidos." }, { status: 400 });
    }

    const service = new ReviewEndorsementService();
    await service.execute(token, action as "APPROVE" | "REJECT");

    return NextResponse.json(
      { success: true, message: "Su respuesta ha sido registrada exitosamente." },
      { status: 200 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || "Error interno del servidor." },
      { status: 500 }
    );
  }
}