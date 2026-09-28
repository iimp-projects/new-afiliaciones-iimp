import { NextResponse } from "next/server";
import { AssociatesApiError } from "@/modules/afiliaciones/associates-integration/Clients/AssociatesApiError";
import { AssociateSieProfileError, associateSieProfileService } from "@/modules/afiliaciones/asociados/Services/AssociateSieProfileService";
import { contextService } from "@/modules/auth/context/service";

const safeUpstreamMessage: Record<AssociatesApiError["kind"], string> = {
  TIMEOUT: "SIE tardó demasiado en responder. Intenta nuevamente.",
  TRANSPORT_ERROR: "No fue posible conectar con SIE. Intenta nuevamente.",
  HTTP_400: "SIE no pudo procesar la consulta solicitada.",
  HTTP_401: "SIE rechazó temporalmente la consulta.",
  HTTP_403: "SIE rechazó temporalmente la consulta.",
  HTTP_409: "SIE no pudo completar la consulta en este momento.",
  HTTP_5XX: "SIE no está disponible en este momento.",
  INVALID_RESPONSE: "SIE devolvió una respuesta no válida.",
};

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await contextService.requirePermission("read", "memberships");
    const id = Number((await params).id);
    const data = await associateSieProfileService.getByApplicationId(id);
    return NextResponse.json({ success: true, data }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof AssociateSieProfileError) return NextResponse.json({ success: false, code: error.status === 404 ? "NOT_FOUND_LOCAL" : "INVALID_LOCAL_IDENTITY", message: error.message }, { status: error.status });
    if (error instanceof AssociatesApiError) return NextResponse.json({ success: false, code: error.kind, message: safeUpstreamMessage[error.kind] }, { status: error.kind === "TIMEOUT" || error.kind === "TRANSPORT_ERROR" || error.kind === "HTTP_5XX" ? 503 : 502 });
    return NextResponse.json({ success: false, code: "FORBIDDEN_INTERNAL", message: "No autorizado." }, { status: 403 });
  }
}
