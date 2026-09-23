import { NextResponse } from "next/server";
import { z } from "zod";
import { accountActivationService } from "@/modules/auth/account-activation/service";
import { verificationTokenRateLimiter } from "@/modules/auth/rate-limit/VerificationTokenRateLimiter";

const resendSchema = z.object({ email: z.string().email() });
const publicMessage = "Si existe una cuenta pendiente asociada a este correo, enviaremos un nuevo enlace de activación.";

export async function POST(request: Request) {
  const parsed = resendSchema.safeParse(await request.json().catch(() => null));
  if (parsed.success) {
    try {
      const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
      const normalizedEmail = parsed.data.email.trim().toLowerCase();
      const [ipAllowed, emailAllowed] = await Promise.all([
        verificationTokenRateLimiter.consume("activation-resend-ip", ip, 5, 15),
        verificationTokenRateLimiter.consume("activation-resend-email", normalizedEmail, 5, 15),
      ]);
      if (!ipAllowed || !emailAllowed) return NextResponse.json({ message: publicMessage }, { status: 429 });
      await accountActivationService.resendActivation(normalizedEmail);
    } catch (error) {
      console.error("[ACCOUNT_ACTIVATION_RESEND] No se pudo procesar el reenvío.", { error: error instanceof Error ? error.message : "unknown" });
    }
  }
  return NextResponse.json({ message: publicMessage });
}
