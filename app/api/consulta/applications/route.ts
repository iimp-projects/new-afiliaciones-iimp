import { NextRequest, NextResponse } from "next/server";
import { QUERY_COOKIE } from "@/modules/afiliaciones/consulta/Services/QueryAuthorizationService";
import { ApplicationAccessService } from "@/modules/afiliaciones/postulacion/Services/ApplicationAccessService";
import { ApplicationFlowError } from "@/modules/afiliaciones/postulacion/Services/Exceptions/ApplicationFlowError";
export async function GET(request: NextRequest) {
  try { return NextResponse.json(await new ApplicationAccessService().list(request.cookies.get(QUERY_COOKIE)?.value), { headers: { "Cache-Control": "no-store" } }); }
  catch (error) { return NextResponse.json({ message: error instanceof ApplicationFlowError ? error.message : "No se pudo consultar la solicitud.", code: error instanceof ApplicationFlowError ? error.code : "INTERNAL_ERROR" }, { status: error instanceof ApplicationFlowError ? error.httpStatus : 500 }); }
}
