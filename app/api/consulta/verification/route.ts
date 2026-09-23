import { VerificationError } from "@/modules/shared/Models/VerificationError";
import { NextResponse } from "next/server";
import { publicApplicationQuerySchema, QueryVerificationService } from "@/modules/afiliaciones/consulta/Services/QueryVerificationService";
import { verificationTokenRateLimiter } from "@/modules/auth/rate-limit/VerificationTokenRateLimiter";

export async function POST(request: Request) {
  try {
    const parsed = publicApplicationQuerySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new VerificationError("Revisa el tipo y número de documento.");

    const ipAddress = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
      || request.headers.get("x-real-ip")
      || "unknown";
    const identity = `${parsed.data.documentType}:${parsed.data.documentNumber}`;
    const [ipAllowed, identityAllowed] = await Promise.all([
      verificationTokenRateLimiter.consume("public-query:ip", ipAddress, 10, 15),
      verificationTokenRateLimiter.consume("public-query:identity", identity, 5, 15),
    ]);
    if (!ipAllowed || !identityAllowed) {
      return NextResponse.json({ message: "Demasiados intentos. Inténtalo nuevamente más tarde." }, { status: 429, headers: { "Cache-Control": "no-store" } });
    }

    return NextResponse.json(await new QueryVerificationService().lookup(parsed.data), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ message: error instanceof VerificationError ? error.message : "No se pudo preparar la consulta." }, { status: 400 });
  }
}
