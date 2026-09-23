import { NextRequest, NextResponse } from "next/server";
import { DeclarationPdfService } from "@/modules/afiliaciones/postulacion/Services/DeclarationPdfService";
import type { ApplicationDraft } from "@/modules/afiliaciones/postulacion/Models/ApplicationDraft";
import { QUERY_COOKIE, queryAuthorization } from "@/modules/afiliaciones/consulta/Services/QueryAuthorizationService";
import { contextService } from "@/modules/auth/context/service";
import { getInternalApiUser } from "@/modules/auth/context/api-authorization";
import { verificationTokenRateLimiter } from "@/modules/auth/rate-limit/VerificationTokenRateLimiter";

export async function POST(request: NextRequest) {
  try {
    const user = await getInternalApiUser();
    const internalAccess = Boolean(user && await contextService.hasPermission("read", "memberships"));
    const allowedApplicationIds = queryAuthorization.allowedIds(request.cookies.get(QUERY_COOKIE)?.value);
    if (!internalAccess && allowedApplicationIds.length === 0) {
      return NextResponse.json({ message: "Verifica tu identidad para generar el documento." }, { status: 401 });
    }
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
    if (!(await verificationTokenRateLimiter.consume("generate-pdf", `${user?.id ?? "applicant"}:${ip}`, 5, 15))) {
      return NextResponse.json({ message: "Demasiadas solicitudes de generación." }, { status: 429 });
    }
    const body = await request.json();
    const draft = body.draft as ApplicationDraft;

    if (!draft) {
      return NextResponse.json({ message: "No se proporcionó información para generar el PDF." }, { status: 400 });
    }

    // Instanciamos el servicio (Arquitectura limpia)
    const pdfService = new DeclarationPdfService();
    
    // Obtiene el Uint8Array desde Puppeteer
    const pdfData = await pdfService.generate(draft, { allowedApplicationIds: internalAccess ? [Number(body.applicationId)].filter(Number.isSafeInteger) : allowedApplicationIds });

    // SOLUCIÓN TS: Usamos "as any" para evitar el choque de tipos entre Node (ArrayBufferLike) y el DOM (BlobPart).
    // A nivel de ejecución (JavaScript), Uint8Array es perfectamente válido aquí.
    return new NextResponse(Uint8Array.from(pdfData), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="Solicitud_Afiliacion_IIMP.pdf"',
      },
    });

  } catch (error: unknown) {
    console.error("[GeneratePDF Route] Error:", error);
    return NextResponse.json(
      { message: "Error interno al generar el documento PDF." }, 
      { status: 500 }
    );
  }
}
