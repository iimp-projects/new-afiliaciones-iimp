import { VerificationError } from "@/modules/shared/Models/VerificationError";
import { NextRequest, NextResponse } from "next/server";
import { OtpRecoveryService } from "@/modules/afiliaciones/postulacion/Services/OtpRecoveryService";
import { parseOtpRequest } from "@/modules/afiliaciones/postulacion/Services/OtpRequest";
import { QUERY_COOKIE } from "@/modules/afiliaciones/consulta/Services/QueryAuthorizationService";
import { ApplicationAccessService } from "@/modules/afiliaciones/postulacion/Services/ApplicationAccessService";
import { ApplicationFlowError } from "@/modules/afiliaciones/postulacion/Services/Exceptions/ApplicationFlowError";

export async function POST(request: NextRequest) {
  let parsed: ReturnType<typeof parseOtpRequest>;
  try {
    parsed = parseOtpRequest(await request.json(), "verify");
  } catch (error) {
    return NextResponse.json({ message: error instanceof VerificationError ? error.message : "Datos de verificación inválidos." }, { status: 400 });
  }

  try {
    const { applicationId, ...proof } = await new OtpRecoveryService().verifyOtp(parsed.identifier, parsed.code!, parsed.purpose);
    const response = NextResponse.json({ success: true, message: "Verificado correctamente." });
    if (parsed.purpose === "APPLICATION_QUERY") {
      response.cookies.set(QUERY_COOKIE, await new ApplicationAccessService().grantVerified(applicationId, proof), {
        httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/api", maxAge: 15 * 60,
      });
    }
    return response;
  } catch (error) {
    if (error instanceof ApplicationFlowError) return NextResponse.json({ code: error.code, message: error.message }, { status: error.httpStatus });
    return NextResponse.json({ message: error instanceof VerificationError ? error.message : "No se pudo validar el código." }, { status: 400 });
  }
}
