import { NextResponse } from "next/server";
import { AssociatesApiError } from "@/modules/afiliaciones/associates-integration/Clients/AssociatesApiError";
import { AssociatesApiConfigurationError } from "@/modules/afiliaciones/associates-integration/Config/AssociatesApiConfig";
import { AssociateSieProfileError, associateSieProfileService } from "@/modules/afiliaciones/asociados/Services/AssociateSieProfileService";
import { ApiAuthorizationError, requireApiPermission } from "@/modules/auth/context/api-authorization";

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
    await requireApiPermission("read", "memberships");
    const id = Number((await params).id);
    const data = await associateSieProfileService.getByApplicationId(id);
    return NextResponse.json({ success: true, data }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof ApiAuthorizationError) {
      return NextResponse.json(
        { success: false, code: error.status === 401 ? "UNAUTHENTICATED" : "FORBIDDEN_INTERNAL", message: error.status === 401 ? "Sesión expirada." : "Sin permiso para consultar SIE." },
        { status: error.status },
      );
    }
    if (error instanceof AssociateSieProfileError) return NextResponse.json({ success: false, code: error.status === 404 ? "NOT_FOUND_LOCAL" : "INVALID_LOCAL_IDENTITY", message: error.message }, { status: error.status });
    if (error instanceof AssociatesApiConfigurationError) {
      console.error("[AssociateSieProfile] SIE runtime configuration unavailable", { errorName: error.name });
      return NextResponse.json({ success: false, code: "SIE_CONFIGURATION_UNAVAILABLE", message: "La consulta SIE no está disponible en este momento." }, { status: 503 });
    }
    if (error instanceof AssociatesApiError) {
      console.warn("[AssociateSieProfile] SIE upstream request failed", { kind: error.kind, operation: error.operation, httpStatus: error.httpStatus });
      return NextResponse.json({ success: false, code: error.kind, message: safeUpstreamMessage[error.kind] }, { status: error.kind === "TIMEOUT" || error.kind === "TRANSPORT_ERROR" || error.kind === "HTTP_5XX" ? 503 : 502 });
    }
    console.error("[AssociateSieProfile] unexpected error", { errorName: error instanceof Error ? error.name : typeof error });
    return NextResponse.json({ success: false, code: "INTERNAL_ERROR", message: "No fue posible consultar SIE en este momento." }, { status: 500 });
  }
}
