import { NextResponse } from "next/server";
import { PaymentServiceError, paymentService } from "@/modules/afiliaciones/payments/Services/PaymentService";
import { paymentAuthorizationService } from "@/modules/afiliaciones/payments/Services/PaymentAuthorizationService";
import { paymentConfig } from "@/modules/afiliaciones/payments/Config/PaymentConfig";
import { getAppBaseUrl } from "@/lib/config/env";

const CARD_TRANSACTION_TOKEN = /^[A-Za-z0-9]{32}$/;

export function noConfirmationRedirect(_request: Request, restoreReference?: string): NextResponse {
  // El origen público se resuelve con la URL canónica, nunca desde `request.url`
  // (que en el servidor standalone puede ser el bind address 0.0.0.0:3000).
  const url = new URL("/consulta/pago/no-confirmado", getAppBaseUrl());
  if (restoreReference) url.searchParams.set("payment_restore", restoreReference);
  return NextResponse.redirect(url, 303);
}

function redirectWithRestoreSession(destination: string, paymentId: number, applicationId: number): NextResponse {
  const restore = paymentAuthorizationService.createRestoreReference(paymentId, applicationId, paymentConfig.authorizationTtlSeconds);
  const url = new URL(destination, getAppBaseUrl());
  url.searchParams.set("payment_restore", restore.reference);
  const response = NextResponse.redirect(url, 303);
  response.cookies.set(paymentAuthorizationService.restoreCookieName, restore.session, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: paymentConfig.authorizationTtlSeconds,
  });
  return response;
}

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
      return noConfirmationRedirect(request);
    }
    const callbackReference = new URL(request.url).searchParams.get("payment_callback") ?? undefined;
    const payment = await paymentService.authorizeFromCallback(callbackReference, token, parsedChannel);
    const destination = payment.status === "FAILED" ? "/consulta/pago/no-confirmado" : "/consulta";
    return redirectWithRestoreSession(destination, payment.id, payment.applicationId);
  } catch (error) {
    if (error instanceof PaymentServiceError) {
      console.info("[NIUBIZ_CALLBACK] Resultado controlado.", { status: error.status });
      return noConfirmationRedirect(request);
    }
    console.error("[NIUBIZ_CALLBACK] Error al autorizar el pago.", { contentType });
    return noConfirmationRedirect(request);
  }
}
