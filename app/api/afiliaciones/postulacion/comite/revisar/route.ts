import { NextRequest, NextResponse } from "next/server";
import { ReviewComiteError, ReviewComiteService } from "@/modules/afiliaciones/expedientes/Services/ReviewComiteService";
import { verificationTokenRateLimiter } from "@/modules/auth/rate-limit/VerificationTokenRateLimiter";

const TOKEN_ERRORS = new Set([
  "El enlace ha expirado.",
  "El enlace es inválido o no posee un formato correcto.",
]);

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
    if (!(await verificationTokenRateLimiter.consume("comite-review", ip, 30, 15))) {
      return NextResponse.json({ success: false, message: "Demasiadas solicitudes. Inténtalo nuevamente más tarde." }, { status: 429 });
    }

    const body = await request.json();
    const { token, action, comment } = body;

    if (typeof token !== "string" || !token || !["APPROVE", "REJECT"].includes(action)) {
      return NextResponse.json({ success: false, message: "Parámetros inválidos." }, { status: 400 });
    }

    await new ReviewComiteService().execute(token, action as "APPROVE" | "REJECT", typeof comment === "string" ? comment : undefined, {
      ipAddress: ip,
      userAgent: request.headers.get("user-agent") || "EMAIL_ACTION",
    });

    return NextResponse.json(
      { success: true, message: "Su respuesta ha sido registrada exitosamente." },
      { status: 200 },
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Error interno del servidor.";
    if (error instanceof ReviewComiteError) {
      const status = error.code === "FORBIDDEN" ? 403 : error.code === "INVALID_COMMENT" ? 422 : 409;
      return NextResponse.json({ success: false, message }, { status });
    }
    return NextResponse.json(
      { success: false, message },
      { status: TOKEN_ERRORS.has(message) ? 400 : 500 },
    );
  }
}
