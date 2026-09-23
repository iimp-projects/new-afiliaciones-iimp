import { VerificationError } from "@/modules/shared/Models/VerificationError";
import { NextRequest, NextResponse } from "next/server";
import { OtpRecoveryService } from "@/modules/afiliaciones/postulacion/Services/OtpRecoveryService";
import { parseOtpRequest } from "@/modules/afiliaciones/postulacion/Services/OtpRequest";
import { OTP_COOLDOWN_SECONDS } from "@/modules/shared/Models/Verification";

// Constant public message: it never confirms whether the document, the
// application or the selected channel actually exist.
const GENERIC_SENT_MESSAGE = "Si el canal seleccionado está disponible para tu registro, recibirás un código de verificación.";

export async function POST(request: NextRequest) {
  let parsed: ReturnType<typeof parseOtpRequest>;
  try {
    parsed = parseOtpRequest(await request.json(), "send");
  } catch (error) {
    return NextResponse.json({ message: error instanceof VerificationError ? error.message : "Datos de verificación inválidos." }, { status: 400 });
  }

  const service = new OtpRecoveryService();

  if (parsed.purpose === "APPLICATION_QUERY") {
    try {
      await service.generateAndSendOtp(parsed.identifier, parsed.channel, parsed.purpose);
    } catch (error) {
      // Swallow provider/decoy failures: the public response must stay equivalent.
      console.error({ operation: "PUBLIC_OTP_SEND_SUPPRESSED", category: error instanceof Error ? error.name : "unknown" });
    }
    return NextResponse.json({ success: true, message: GENERIC_SENT_MESSAGE, cooldownSeconds: OTP_COOLDOWN_SECONDS });
  }

  try {
    await service.generateAndSendOtp(parsed.identifier, parsed.channel, parsed.purpose);
    return NextResponse.json({ success: true, message: "Código enviado.", cooldownSeconds: OTP_COOLDOWN_SECONDS });
  } catch (error) {
    return NextResponse.json({ message: error instanceof VerificationError ? error.message : "No pudimos enviar el código por este medio." }, { status: 400 });
  }
}
