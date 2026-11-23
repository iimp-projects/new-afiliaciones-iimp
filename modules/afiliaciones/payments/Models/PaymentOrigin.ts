export type PaymentOrigin = "MANUAL" | "GATEWAY" | "UNRESOLVED";

export interface PaymentOriginSource {
  status?: string | null;
  gateway?: string | null;
  paymentChannel?: string | null;
  gatewayPayload?: unknown;
}

function hasManualPayloadMarker(payload: unknown): boolean {
  return (
    typeof payload === "object" &&
    payload !== null &&
    (payload as { manualPayment?: unknown }).manualPayment === true
  );
}

export function isManualPayment(payment: PaymentOriginSource | null | undefined): boolean {
  if (!payment) return false;
  if (payment.gateway === "BANK_TRANSFER") return true;
  if (payment.paymentChannel?.trim().toUpperCase() === "MANUAL") return true;
  return hasManualPayloadMarker(payment.gatewayPayload);
}

export function resolvePaymentOrigin(payment: PaymentOriginSource | null | undefined): PaymentOrigin {
  if (!payment || payment.status !== "PAID") return "UNRESOLVED";
  return isManualPayment(payment) ? "MANUAL" : "GATEWAY";
}

export function paymentOriginLabel(payment: PaymentOriginSource | null | undefined): string {
  const origin = resolvePaymentOrigin(payment);
  if (origin === "MANUAL") return "Manual";
  if (origin === "GATEWAY") return "Pasarela";
  return "";
}
