import { NextRequest, NextResponse } from "next/server";
import { DeclarationPdfService } from "@/modules/afiliaciones/postulacion/Services/DeclarationPdfService";
import type { ApplicationDraft } from "@/modules/afiliaciones/postulacion/Models/ApplicationDraft";
import { APPLICATION_ACCESS_EXPIRED_CODE, QUERY_COOKIE, queryAuthorization } from "@/modules/afiliaciones/consulta/Services/QueryAuthorizationService";
import { renewApplicationAccessCookie } from "@/modules/afiliaciones/consulta/Services/ApplicationAccessCookie";
import { contextService } from "@/modules/auth/context/service";
import { getInternalApiUser } from "@/modules/auth/context/api-authorization";
import { verificationTokenRateLimiter } from "@/modules/auth/rate-limit/VerificationTokenRateLimiter";

const PDF_RATE_LIMIT_SCOPE = "generate-pdf";
const PDF_RATE_LIMIT_MAX = 5;
const PDF_RATE_LIMIT_WINDOW_MINUTES = 15;

export async function POST(request: NextRequest) {
  try {
    const user = await getInternalApiUser();
    const internalAccess = Boolean(user && await contextService.hasPermission("read", "memberships"));
    const token = request.cookies.get(QUERY_COOKIE)?.value;
    const resolution = queryAuthorization.resolveAccess(token);
    if (resolution.status === "EXPIRED") {
      return NextResponse.json({ code: APPLICATION_ACCESS_EXPIRED_CODE, message: "Tu sesión de verificación expiró." }, { status: 401 });
    }
    const cookieApplicationIds = resolution.status === "VALID" ? resolution.applicationIds : [];

    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
    const subject = `${user?.id ?? "applicant"}:${ip}`;
    if (!(await verificationTokenRateLimiter.consume(PDF_RATE_LIMIT_SCOPE, subject, PDF_RATE_LIMIT_MAX, PDF_RATE_LIMIT_WINDOW_MINUTES))) {
      const retryAfter = await verificationTokenRateLimiter.retryAfterSeconds(PDF_RATE_LIMIT_SCOPE, subject);
      return NextResponse.json(
        { code: "PDF_GENERATION_RATE_LIMITED", message: "Demasiadas solicitudes de generación." },
        { status: 429, ...(retryAfter ? { headers: { "Retry-After": String(retryAfter) } } : {}) },
      );
    }

    const body = await request.json();
    const draft = body.draft as ApplicationDraft;

    if (!draft) {
      return NextResponse.json({ message: "No se proporcionó información para generar el PDF." }, { status: 400 });
    }

    // La fuente confiable del alcance es el QUERY_COOKIE (token firmado del
    // postulante). `body.applicationId` solo se usa como parámetro de alcance
    // para usuarios internos autorizados (read:memberships), y únicamente si
    // es un entero válido. Nunca se termina con un alcance vacío por no haber
    // recibido `body.applicationId`.
    const bodyApplicationId = Number(body.applicationId);
    const scopedApplicationIds =
      internalAccess && Number.isSafeInteger(bodyApplicationId) && bodyApplicationId > 0
        ? [bodyApplicationId]
        : cookieApplicationIds;

    if (scopedApplicationIds.length === 0) {
      return NextResponse.json({ message: "Verifica tu identidad para generar el documento." }, { status: 401 });
    }

    // Instanciamos el servicio (Arquitectura limpia)
    const pdfService = new DeclarationPdfService();
    
    // Obtiene el Uint8Array desde Puppeteer
    const pdfData = await pdfService.generate(draft, { allowedApplicationIds: scopedApplicationIds });

    // SOLUCIÓN TS: Usamos "as any" para evitar el choque de tipos entre Node (ArrayBufferLike) y el DOM (BlobPart).
    // A nivel de ejecución (JavaScript), Uint8Array es perfectamente válido aquí.
    const response = new NextResponse(Uint8Array.from(pdfData), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="Solicitud_Afiliacion_IIMP.pdf"',
      },
    });
    return renewApplicationAccessCookie(response, token);

  } catch (error: unknown) {
    console.error("[GeneratePDF Route] Error:", error);
    return NextResponse.json(
      { code: "PDF_GENERATION_FAILED", message: "Error interno al generar el documento PDF." }, 
      { status: 500 }
    );
  }
}
