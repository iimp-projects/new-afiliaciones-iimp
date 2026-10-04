import { VerificationError } from "@/modules/shared/Models/VerificationError";
import { NextRequest, NextResponse } from "next/server";
import { OtpRecoveryService } from "@/modules/afiliaciones/postulacion/Services/OtpRecoveryService";
import { parseOtpRequest } from "@/modules/afiliaciones/postulacion/Services/OtpRequest";
import { verificationTokenRateLimiter } from "@/modules/auth/rate-limit/VerificationTokenRateLimiter";
import { OTP_COOLDOWN_SECONDS } from "@/modules/shared/Models/Verification";

// Constant public message: it never confirms whether the document, the
// application or the selected channel actually exist.
const GENERIC_SENT_MESSAGE = "Si el canal seleccionado está disponible para tu registro, recibirás un código de verificación.";

const OTP_SEND_IP_LIMIT = 10;
const OTP_SEND_IDENTITY_LIMIT = 5;
const OTP_SEND_WINDOW_MINUTES = 15;

function clientIp(request: NextRequest): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || request.headers.get("x-real-ip")
    || "unknown";
}

// Stable, non-PII subject for the rate limiter. The identifier is validated
// server-side (document challenge, application challenge or trackingCode); the
// client can never supply a phone/destination. The raw value is hashed by the
// rate limiter, so document numbers never reach logs or plaintext storage.
function otpIdentitySubject(identifier: ReturnType<typeof parseOtpRequest>["identifier"]): string {
  if (typeof identifier === "string") return `tracking:${identifier}`;
  if (identifier.kind === "document") return `document:${identifier.documentType}:${identifier.documentNumber}`;
  return `application:${identifier.applicationId}`;
}

export async function POST(request: NextRequest) {
  let parsed: ReturnType<typeof parseOtpRequest>;
  try {
    parsed = parseOtpRequest(await request.json(), "send");
  } catch (error) {
    return NextResponse.json({ message: error instanceof VerificationError ? error.message : "Datos de verificación inválidos." }, { status: 400 });
  }

  const [ipAllowed, identityAllowed] = await Promise.all([
    verificationTokenRateLimiter.consume("otp-send:ip", clientIp(request), OTP_SEND_IP_LIMIT, OTP_SEND_WINDOW_MINUTES),
    verificationTokenRateLimiter.consume("otp-send:identity", otpIdentitySubject(parsed.identifier), OTP_SEND_IDENTITY_LIMIT, OTP_SEND_WINDOW_MINUTES),
  ]);
  if (!ipAllowed || !identityAllowed) {
    return NextResponse.json({ message: "Demasiados intentos. Inténtalo nuevamente más tarde." }, { status: 429, headers: { "Cache-Control": "no-store" } });
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
