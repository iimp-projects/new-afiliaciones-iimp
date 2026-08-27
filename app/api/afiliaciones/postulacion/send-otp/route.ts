import { NextRequest, NextResponse } from "next/server";
import { OtpRecoveryService } from "@/modules/afiliaciones/postulacion/Services/OtpRecoveryService";

export async function POST(request: NextRequest) {
  try {
    // ✅ Ahora recibimos el trackingCode Y el channel ("EMAIL" o "SMS")
    const { trackingCode, channel } = await request.json();
    
    const service = new OtpRecoveryService();
    await service.generateAndSendOtp(trackingCode, channel);
    
    return NextResponse.json({ success: true, message: "Código enviado." });
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 400 });
  }
}