import { NextRequest, NextResponse } from "next/server";
import { ConfigurationError, getDocumentAiConfig, isDocumentAiValidationEnabled } from "@/lib/config/env";
import { getInternalApiUser } from "@/modules/auth/context/api-authorization";
import { contextService } from "@/modules/auth/context/service";
import {
  APPLICATION_ACCESS_EXPIRED_CODE,
  QUERY_COOKIE,
  queryAuthorization,
} from "@/modules/afiliaciones/consulta/Services/QueryAuthorizationService";
import { renewApplicationAccessCookie } from "@/modules/afiliaciones/consulta/Services/ApplicationAccessCookie";
import {
  AcademicDocumentFileError,
  DocumentPrevalidationService,
  DocumentPrevalidationServiceError,
} from "@/modules/afiliaciones/document-validation/Services/DocumentPrevalidationService";
import { documentPrevalidationRateLimiter } from "@/modules/afiliaciones/document-validation/Services/InMemoryRateLimiter";

export const runtime = "nodejs";

const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;

function jsonError(message: string, status: number, code?: string, retryAfterMs?: number) {
  const response = NextResponse.json({ success: false, ...(code ? { code } : {}), message }, { status });
  if (retryAfterMs) response.headers.set("Retry-After", String(Math.ceil(retryAfterMs / 1000)));
  return response;
}

function fileErrorStatus(error: AcademicDocumentFileError): number {
  if (error.code === "TOO_LARGE") return 413;
  if (error.code === "UNSUPPORTED_TYPE" || error.code === "EMPTY") return 415;
  return 422;
}

/**
 * Configuración pública mínima para que el formulario sepa si debe mostrar la
 * prevalidación. No expone modelo, credenciales ni resultados.
 */
export async function GET() {
  return NextResponse.json(
    { success: true, data: { enabled: isDocumentAiValidationEnabled() } },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: NextRequest) {
  if (!isDocumentAiValidationEnabled()) {
    return jsonError("La prevalidación documental no está disponible.", 404, "DOCUMENT_AI_DISABLED");
  }

  let config;
  try {
    config = getDocumentAiConfig();
  } catch (error) {
    const message = error instanceof ConfigurationError
      ? "La prevalidación no tiene una configuración válida."
      : "La prevalidación no está disponible.";
    console.error("[DocumentPrevalidation] Configuración no disponible.");
    return jsonError(message, 503, "DOCUMENT_AI_CONFIGURATION");
  }

  try {
    const declaredLength = Number(request.headers.get("content-length") ?? "");
    if (Number.isFinite(declaredLength) && declaredLength > config.maxFileBytes + 1024 * 1024) {
      return jsonError("El archivo supera el tamaño máximo permitido.", 413, "FILE_TOO_LARGE");
    }

    const token = request.cookies.get(QUERY_COOKIE)?.value;
    const resolution = queryAuthorization.resolveAccess(token);
    let internalAccess = false;
    if (resolution.status !== "VALID") {
      const internalUser = await getInternalApiUser();
      internalAccess = Boolean(
        internalUser
        && ((await contextService.hasPermission("update", "applications"))
          || (await contextService.hasPermission("update", "memberships"))),
      );
    }

    if (resolution.status === "EXPIRED" && !internalAccess) {
      return jsonError("Tu sesión de verificación expiró.", 401, APPLICATION_ACCESS_EXPIRED_CODE);
    }
    if (resolution.status !== "VALID" && !internalAccess) {
      return jsonError("Verifica tu identidad para analizar el documento.", 401, "VERIFICATION_REQUIRED");
    }

    const formData = await request.formData();
    const candidate = formData.get("file");
    if (!(candidate instanceof File)) {
      return jsonError("No hay archivo.", 400, "FILE_REQUIRED");
    }
    if (candidate.size < 1 || candidate.size > config.maxFileBytes) {
      return jsonError("El archivo supera el tamaño máximo permitido.", 413, "FILE_TOO_LARGE");
    }

    const applicantApplicationId = resolution.status === "VALID" ? resolution.applicationIds[0] : undefined;
    const requestedApplicationId = Number(formData.get("applicationId"));
    const applicationId = applicantApplicationId
      ?? (internalAccess && Number.isSafeInteger(requestedApplicationId) && requestedApplicationId > 0
        ? requestedApplicationId
        : null);

    if (!applicationId) {
      return jsonError("Verifica tu identidad para analizar el documento.", 401, "VERIFICATION_REQUIRED");
    }

    const rateLimit = documentPrevalidationRateLimiter.consume(
      `application:${applicationId}`,
      RATE_LIMIT_MAX,
      RATE_LIMIT_WINDOW_MS,
    );
    if (!rateLimit.allowed) {
      return jsonError(
        "Se realizaron demasiados análisis en poco tiempo. Espera unos minutos.",
        429,
        "RATE_LIMITED",
        rateLimit.retryAfterMs,
      );
    }

    const buffer = Buffer.from(await candidate.arrayBuffer());
    const service = new DocumentPrevalidationService(config);
    const result = await service.execute({
      applicationId,
      buffer,
      fileName: candidate.name.slice(0, 250),
      mimeType: candidate.type,
    });

    const response = NextResponse.json({ success: true, data: result });
    return renewApplicationAccessCookie(response, token);
  } catch (error) {
    if (error instanceof DocumentPrevalidationServiceError) {
      return jsonError(error.message, error.status, error.code);
    }
    if (error instanceof AcademicDocumentFileError) {
      return jsonError(error.message, fileErrorStatus(error), error.code);
    }
    if (error instanceof ConfigurationError) {
      return jsonError("La prevalidación no tiene una configuración válida.", 503, "DOCUMENT_AI_CONFIGURATION");
    }
    console.error("[DocumentPrevalidation] Error no controlado.");
    return jsonError("No se pudo completar la revisión automática en este momento.", 500, "DOCUMENT_AI_UNAVAILABLE");
  }
}
