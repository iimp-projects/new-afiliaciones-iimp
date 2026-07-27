import { NextRequest, NextResponse } from "next/server";
import { OtpRecoveryService } from "@/modules/afiliaciones/postulacion/Services/OtpRecoveryService";

export async function POST(request: NextRequest) {
  try {
    const { trackingCode } = await request.json();
    const service = new OtpRecoveryService();
    await service.generateAndSendOtp(trackingCode);
    return NextResponse.json({ success: true, message: "Código enviado." });
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 400 });
  }
}