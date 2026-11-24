import { NextResponse } from "next/server";

export function accessApiError(error: unknown): NextResponse {
  const status = error instanceof Error && "status" in error ? Number((error as { status: number }).status) : 500;
  if (status === 401) {
    return NextResponse.json({ success: false, message: "Sesión expirada." }, { status: 401 });
  }
  if (status === 403) {
    return NextResponse.json({ success: false, message: "No autorizado." }, { status: 403 });
  }
  return NextResponse.json({ success: false, message: "No se pudo completar la operación." }, { status: 500 });
}
