import { VerificationError } from "@/modules/shared/Models/VerificationError";
import { NextRequest, NextResponse } from "next/server";
import { OtpRecoveryService } from "@/modules/afiliaciones/postulacion/Services/OtpRecoveryService";
import { parseOtpRequest } from "@/modules/afiliaciones/postulacion/Services/OtpRequest";
import { OTP_COOLDOWN_SECONDS } from "@/modules/shared/Models/Verification";

export async function POST(request: NextRequest) {
  try {
    const { identifier, channel, purpose } = parseOtpRequest(await request.json(), "send");
    
    const service = new OtpRecoveryService();
    await service.generateAndSendOtp(identifier, channel, purpose);
    
    return NextResponse.json({ success: true, message: "Código enviado.", cooldownSeconds: OTP_COOLDOWN_SECONDS });
  } catch (error) {
    return NextResponse.json({ message: error instanceof VerificationError ? error.message : "No pudimos enviar el código por este medio." }, { status: 400 });
  }
}
