import { NextResponse } from "next/server";
import { authorizePaymentSchema } from "@/modules/afiliaciones/payments/DTOs/authorize-payment.schema";
import { paymentAuthorizationService } from "@/modules/afiliaciones/payments/Services/PaymentAuthorizationService";
import { PaymentServiceError, paymentService } from "@/modules/afiliaciones/payments/Services/PaymentService";

export async function POST(request: Request) {
  try {
    const parsed = authorizePaymentSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ message: "Solicitud de autorización inválida.", errors: parsed.error.flatten().fieldErrors }, { status: 400 });
    }

    const authorization = request.headers.get("cookie")
      ?.split(";").map((item) => item.trim()).find((item) => item.startsWith(`${paymentAuthorizationService.cookieName}=`))
      ?.slice(paymentAuthorizationService.cookieName.length + 1);

    await paymentService.authorize(parsed.data, authorization);
    return NextResponse.json({ message: "Autorización procesada." });
  } catch (error) {
    if (error instanceof PaymentServiceError) return NextResponse.json({ message: error.message }, { status: error.status });
    console.error("[PAYMENTS] Error autorizando pago:", error);
    return NextResponse.json({ message: "Error interno al autorizar el pago." }, { status: 500 });
  }
}
