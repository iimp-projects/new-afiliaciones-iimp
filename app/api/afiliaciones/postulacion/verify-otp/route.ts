import { NextRequest, NextResponse } from "next/server";
import { OtpRecoveryService } from "@/modules/afiliaciones/postulacion/Services/OtpRecoveryService";

export async function POST(request: NextRequest) {
  try {
    const { trackingCode, code } = await request.json();
    const service = new OtpRecoveryService();
    await service.verifyOtp(trackingCode, code);
    return NextResponse.json({ success: true, message: "Verificado correctamente." });
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 400 });
  }
}