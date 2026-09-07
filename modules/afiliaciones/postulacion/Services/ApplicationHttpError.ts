import { NextResponse } from "next/server";
import { ApplicationFlowError } from "./Exceptions/ApplicationFlowError";
export function applicationHttpError(error: unknown) {
  if (error instanceof ApplicationFlowError) return NextResponse.json({ code: error.code, message: error.message, error: error.message }, { status: error.httpStatus });
  return NextResponse.json({ code: "INTERNAL_ERROR", message: "No se pudo procesar la solicitud." }, { status: 500 });
}
