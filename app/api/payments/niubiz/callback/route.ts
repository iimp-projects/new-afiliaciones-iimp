import { NextResponse } from "next/server";
import { PaymentServiceError, paymentService } from "@/modules/afiliaciones/payments/Services/PaymentService";

const CARD_TRANSACTION_TOKEN = /^[A-Za-z0-9]{32}$/;

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") ?? "unknown";
  try {
    if (!contentType.startsWith("application/x-www-form-urlencoded") && !contentType.startsWith("multipart/form-data")) {
      return NextResponse.json({ message: "Formato de callback no soportado." }, { status: 415 });
    }
    const formData = await request.formData();
    const transactionToken = formData.get("transactionToken");
    const channel = formData.get("channel");
    const token = typeof transactionToken === "string" ? transactionToken.trim() : "";
    const parsedChannel = typeof channel === "string" ? channel.trim() : undefined;
    console.info("[NIUBIZ_CALLBACK] Callback recibido.", { contentType, fieldNames: [...new Set([...formData.keys()])], transactionTokenPresent: Boolean(token), transactionTokenLength: token.length, channel: parsedChannel });
    if (!CARD_TRANSACTION_TOKEN.test(token) || parsedChannel !== "web") {
      return NextResponse.redirect(new URL("/consulta/pago/no-confirmado", request.url), 303);
    }
    const callbackReference = new URL(request.url).searchParams.get("payment_callback") ?? undefined;
    await paymentService.authorizeFromCallback(callbackReference, token, parsedChannel);
    const destination = "/consulta";
    const redirectUrl = new URL(destination, request.url);
    if (callbackReference) redirectUrl.searchParams.set("payment_callback", callbackReference);
    return NextResponse.redirect(redirectUrl, 303);
  } catch (error) {
    if (error instanceof PaymentServiceError) {
      console.info("[NIUBIZ_CALLBACK] Resultado controlado.", { status: error.status });
      return NextResponse.redirect(new URL("/consulta/pago/no-confirmado", request.url), 303);
    }
    console.error("[NIUBIZ_CALLBACK] Error al autorizar el pago.", { contentType });
    return NextResponse.redirect(new URL("/consulta/pago/no-confirmado", request.url), 303);
  }
}
