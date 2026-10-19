import { NextResponse } from "next/server";
import { ConfigurationError, getIntegrationsV1AssociatesToken } from "@/lib/config/env";
import { verificationTokenRateLimiter } from "@/modules/auth/rate-limit/VerificationTokenRateLimiter";
import { AssociatesApiError } from "@/modules/afiliaciones/associates-integration/Clients/AssociatesApiError";
import { AssociatesApiConfigurationError } from "@/modules/afiliaciones/associates-integration/Config/AssociatesApiConfig";
import { isAuthorizedBearer, readBearerToken } from "@/modules/afiliaciones/institutional-verification/Security/AssociateVerificationAuth";
import { associatesVerificationService } from "@/modules/afiliaciones/institutional-verification/Services/AssociatesVerificationService";
import { parseVerifyAssociateRequest, VerifyAssociateRequestValidationError } from "@/modules/afiliaciones/institutional-verification/Validators/verifyAssociateRequest";

const RATE_LIMIT_SCOPE = "associates-verify:token";
const RATE_LIMIT_MAX = 30;
const RATE_LIMIT_WINDOW_MINUTES = 1;

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

function json(body: unknown, status: number, headers?: HeadersInit) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store", ...(headers ?? {}) } });
}

export async function POST(request: Request) {
  let expectedToken: string;
  try {
    expectedToken = getIntegrationsV1AssociatesToken();
  } catch (error) {
    if (error instanceof ConfigurationError) {
      console.error("[AssociatesVerification] technical token not configured", { errorName: error.name });
      return json({ success: false, code: "SERVICE_UNAVAILABLE", message: "La verificación de asociados no está disponible en este momento." }, 503);
    }
    throw error;
  }

  const token = readBearerToken(request);
  if (token === null || !isAuthorizedBearer(token, expectedToken)) {
    return json({ success: false, code: "UNAUTHORIZED", message: "Autenticación requerida." }, 401);
  }

  try {
    const allowed = await verificationTokenRateLimiter.consume(RATE_LIMIT_SCOPE, token, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MINUTES);
    if (!allowed) {
      const retryAfter = (await verificationTokenRateLimiter.retryAfterSeconds(RATE_LIMIT_SCOPE, token)) ?? RATE_LIMIT_WINDOW_MINUTES * 60;
      return json({ success: false, code: "RATE_LIMIT_EXCEEDED", message: "Demasiadas solicitudes. Intenta nuevamente más tarde." }, 429, { "Retry-After": String(retryAfter) });
    }
  } catch (error) {
    console.error("[AssociatesVerification] rate limiter unavailable", { errorName: error instanceof Error ? error.name : typeof error });
    return json({ success: false, code: "SERVICE_UNAVAILABLE", message: "La verificación de asociados no está disponible en este momento." }, 503);
  }

  let input;
  try {
    input = parseVerifyAssociateRequest(await request.json());
  } catch (error) {
    if (error instanceof VerifyAssociateRequestValidationError) {
      return json({ success: false, code: "INVALID_REQUEST", message: error.message }, 400);
    }
    return json({ success: false, code: "INVALID_REQUEST", message: "El cuerpo de la solicitud no es un JSON válido." }, 400);
  }

  try {
    const data = await associatesVerificationService.verify(input);
    return json({ success: true, data }, 200);
  } catch (error) {
    if (error instanceof AssociatesApiConfigurationError) {
      console.error("[AssociatesVerification] SIE runtime configuration unavailable", { errorName: error.name });
      return json({ success: false, code: "SIE_UNAVAILABLE", message: "La verificación de asociados no está disponible en este momento." }, 503);
    }
    if (error instanceof AssociatesApiError) {
      console.warn("[AssociatesVerification] SIE upstream request failed", { kind: error.kind, operation: error.operation, httpStatus: error.httpStatus });
      const status = error.kind === "TIMEOUT" || error.kind === "TRANSPORT_ERROR" || error.kind === "HTTP_5XX" ? 503 : 502;
      return json({ success: false, code: "SIE_UNAVAILABLE", message: safeUpstreamMessage[error.kind] }, status);
    }
    console.error("[AssociatesVerification] unexpected error", { errorName: error instanceof Error ? error.name : typeof error });
    return json({ success: false, code: "INTERNAL_ERROR", message: "No fue posible verificar al asociado en este momento." }, 500);
  }
}
