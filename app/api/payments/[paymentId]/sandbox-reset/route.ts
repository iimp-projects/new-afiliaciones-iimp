import { NextResponse } from "next/server";
import { z } from "zod";
import { contextService } from "@/modules/auth/context/service";
import { paymentSandboxResetService, PaymentSandboxResetError } from "@/modules/afiliaciones/payments/Services/PaymentSandboxResetService";

const paymentIdSchema = z.coerce.number().int().positive();

export async function POST(request: Request, { params }: { params: Promise<{ paymentId: string }> }) {
  try {
    await contextService.requireRole(["SUPER_ADMIN"]);
    const user = await contextService.requireAuth();
    const paymentId = paymentIdSchema.safeParse((await params).paymentId);
    if (!paymentId.success) return NextResponse.json({ message: "Identificador de pago inválido." }, { status: 400 });

    const result = await paymentSandboxResetService.reset(paymentId.data, { id: user.id, roleSlug: user.role.slug }, {
      ipAddress: getClientIp(request),
      userAgent: request.headers.get("user-agent") ?? undefined,
    });
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    if (error instanceof PaymentSandboxResetError) return NextResponse.json({ message: error.message }, { status: error.status });
    return NextResponse.json({ message: "No fue posible reiniciar el pago de prueba." }, { status: 403 });
  }
}

function getClientIp(request: Request): string | undefined {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || request.headers.get("x-real-ip")
    || (process.env.NODE_ENV !== "production" ? "127.0.0.1" : undefined);
}
