import { NextRequest, NextResponse } from "next/server";
import { ValidateSponsorService } from "@/modules/afiliaciones/postulacion/Services/ValidateSponsorService";

export async function POST(request: NextRequest) {
  try {
    const { documentNumber } = await request.json();

    if (!documentNumber) {
      return NextResponse.json({ success: false, message: "El DNI es requerido." }, { status: 400 });
    }

    const service = new ValidateSponsorService();
    const sponsor = await service.execute(documentNumber);

    if (!sponsor) {
      return NextResponse.json({ 
        success: false, 
        message: "El DNI no pertenece a un Asociado Activo hábil." 
      }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: sponsor }, { status: 200 });

  } catch (error: any) {
    console.error("[ValidateSponsor Route] Error:", error);
    return NextResponse.json({ success: false, message: "Error interno al validar el aval." }, { status: 500 });
  }
}