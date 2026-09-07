import { NextResponse } from "next/server";
import { createPaymentSchema } from "@/modules/afiliaciones/payments/DTOs/create-payment.schema";
import { paymentAuthorizationService } from "@/modules/afiliaciones/payments/Services/PaymentAuthorizationService";
import { PaymentServiceError, paymentService } from "@/modules/afiliaciones/payments/Services/PaymentService";

export async function POST(request: Request) {
  try {
    const parsed = createPaymentSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ message: "Solicitud de pago inválida.", errors: parsed.error.flatten().fieldErrors }, { status: 400 });
    }
    const authorization = request.headers.get("cookie")
      ?.split(";").map((item) => item.trim()).find((item) => item.startsWith(`${paymentAuthorizationService.cookieName}=`))
      ?.slice(paymentAuthorizationService.cookieName.length + 1);
    const result = await paymentService.initiate(parsed.data, authorization, getClientIp(request));
    return NextResponse.json(result, { status: result.status === "FAILED" ? 422 : 200 });
  } catch (error) {
    if (error instanceof PaymentServiceError) return NextResponse.json({ message: error.message }, { status: error.status });
    console.error("[PAYMENTS] Error iniciando pago:", error);
    return NextResponse.json({ message: "Error interno al iniciar el pago." }, { status: 500 });
  }
}

function getClientIp(request: Request): string | undefined {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip") || (process.env.NODE_ENV !== "production" ? "127.0.0.1" : undefined);
}
