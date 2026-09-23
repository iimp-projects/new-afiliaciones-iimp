import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ValidateSponsorService } from "@/modules/afiliaciones/postulacion/Services/ValidateSponsorService";
import { ApplicationAccessService } from "@/modules/afiliaciones/postulacion/Services/ApplicationAccessService";
import { QUERY_COOKIE } from "@/modules/afiliaciones/consulta/Services/QueryAuthorizationService";
import { ApplicationFlowError } from "@/modules/afiliaciones/postulacion/Services/Exceptions/ApplicationFlowError";
import { ApiAuthorizationError, requireApiPermission } from "@/modules/auth/context/api-authorization";
import { verificationTokenRateLimiter } from "@/modules/auth/rate-limit/VerificationTokenRateLimiter";

function categorizeSponsorError(error: unknown): string {
  const name = error instanceof Error ? error.name : "";
  const code = (error as { code?: unknown } | null)?.code;
  const message = error instanceof Error ? error.message : "";
  if (name === "ConfigurationError" || code === "CONFIGURATION_ERROR") return "SPONSOR_VALIDATION_CONFIGURATION_ERROR";
  if (name.startsWith("Prisma") || /PostgresError|ConnectorError/.test(message)) return "SPONSOR_VALIDATION_DATABASE_ERROR";
  if (name === "ApplicationFlowError") return "SPONSOR_VALIDATION_BUSINESS_REJECTION";
  return "SPONSOR_VALIDATION_UNEXPECTED_ERROR";
}

function logSponsorFailure(route: "GET" | "POST", error: unknown): void {
  // Sanitized: category + error name/code only (no message, no DNI/PII, no secrets).
  console.error({
    operation: "SPONSOR_VALIDATION",
    route,
    category: categorizeSponsorError(error),
    errorName: error instanceof Error ? error.name : "UnknownError",
    errorCode: (error as { code?: unknown } | null)?.code,
  });
}

async function authorize(request: NextRequest, applicationId: number): Promise<NextResponse | null> {
  try {
    await requireApiPermission("read", "memberships");
    return null;
  } catch (error) {
    if (!(error instanceof ApiAuthorizationError)) throw error;
    if (error.status === 403) {
      return NextResponse.json({ success: false, message: "No autorizado." }, { status: 403 });
    }
    // Sin sesión (401): continúa el flujo de postulante con cookie de solicitud.
  }

  try {
    new ApplicationAccessService().require(applicationId, request.cookies.get(QUERY_COOKIE)?.value);
    return null;
  } catch (error) {
    const status = error instanceof ApplicationFlowError ? error.httpStatus : 500;
    return NextResponse.json({ success: false, message: "Verifica tu identidad para validar el aval." }, { status });
  }
}

async function handle(request: NextRequest, documentNumber: string | undefined, applicationId: number): Promise<NextResponse> {
  if (!/^\d{8}$/.test(documentNumber ?? "") || !Number.isSafeInteger(applicationId) || applicationId < 1) {
    return NextResponse.json({ success: false, message: "Solicitud o DNI inválido." }, { status: 400 });
  }
  const denied = await authorize(request, applicationId);
  if (denied) return denied;
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
  const allowed = await verificationTokenRateLimiter.consume("sponsor-lookup", `${ip}:${documentNumber}`, 10, 15);
  if (!allowed) return NextResponse.json({ success: false, message: "Demasiados intentos." }, { status: 429 });

  const existingApproval = await prisma.membershipApproval.findFirst({
    where: { applicationId, sponsorPerson: { documentNumber }, status: { not: "INACTIVE" } },
    select: { id: true },
  });
  if (existingApproval) return NextResponse.json({ success: false, message: "Este asociado ya figura como aval en la solicitud." }, { status: 400 });

  const sponsor = await new ValidateSponsorService().execute(documentNumber!);
  if (!sponsor) return NextResponse.json({ success: false, message: "El DNI no pertenece a un asociado hábil." }, { status: 404 });
  // Minimal display data only (name/email/derived code). No phone, address or other PII.
  return NextResponse.json({
    success: true,
    data: {
      eligible: true,
      sponsorFullName: sponsor.fullName,
      sponsorEmail: sponsor.email,
      sponsorCode: sponsor.sponsorCode,
      sponsorPersonId: sponsor.id,
    },
  });
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const documentNumber = searchParams.get("documentNumber")?.trim();
    const applicationIdParam = searchParams.get("applicationId");
    const applicationId = applicationIdParam ? Number(applicationIdParam) : null;

    return await handle(request, documentNumber, applicationId ?? 0);
  } catch (error: unknown) {
    logSponsorFailure("GET", error);
    return NextResponse.json(
      { success: false, message: "Error interno al validar el aval." },
      { status: 500 }
    );
  }
}

// Mantener POST para compatibilidad con otros formularios
export async function POST(request: NextRequest) {
  try {
    const { documentNumber, applicationId } = await request.json();
    return await handle(request, typeof documentNumber === "string" ? documentNumber.trim() : undefined, Number(applicationId));
  } catch (error: unknown) {
    logSponsorFailure("POST", error);
    return NextResponse.json({ success: false, message: "Error interno al validar el aval." }, { status: 500 });
  }
}
