import { VerificationError } from "@/modules/shared/Models/VerificationError";
import { NextRequest, NextResponse } from "next/server";
import { OtpRecoveryService } from "@/modules/afiliaciones/postulacion/Services/OtpRecoveryService";
import { parseOtpRequest } from "@/modules/afiliaciones/postulacion/Services/OtpRequest";
import { QUERY_COOKIE } from "@/modules/afiliaciones/consulta/Services/QueryAuthorizationService";
import { ApplicationAccessService } from "@/modules/afiliaciones/postulacion/Services/ApplicationAccessService";
import { ApplicationFlowError } from "@/modules/afiliaciones/postulacion/Services/Exceptions/ApplicationFlowError";

export async function POST(request: NextRequest) {
  try {
    const { identifier, code, purpose } = parseOtpRequest(await request.json(), "verify");
    const service = new OtpRecoveryService();
    const proof = await service.verifyOtp(identifier, code!, purpose);
    const response = NextResponse.json({ success: true, message: "Verificado correctamente." });
    if (purpose === "APPLICATION_QUERY" && typeof identifier === "number") {
      response.cookies.set(QUERY_COOKIE, await new ApplicationAccessService().grantVerified(identifier, proof), {
        httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/api", maxAge: 15 * 60,
      });
    }
    return response;
  } catch (error) {
    if (error instanceof ApplicationFlowError) return NextResponse.json({ code: error.code, message: error.message }, { status: error.httpStatus });
    return NextResponse.json({ message: error instanceof VerificationError ? error.message : "No se pudo validar el código." }, { status: 400 });
  }
}
