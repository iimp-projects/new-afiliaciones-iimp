import type { CreatePaymentRequest } from "../Models/PaymentRequest";
import type { CreatePaymentResponse } from "../Models/PaymentResponse";

export const PAYMENT_AUTH_INVALID_OR_EXPIRED = "PAYMENT_AUTH_INVALID_OR_EXPIRED";

export class PaymentApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = "PaymentApiError";
  }
}

export const paymentApi = {
  async createPayment(payload: CreatePaymentRequest): Promise<CreatePaymentResponse> {
    const response = await fetch("/api/payments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(payload),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) throw new PaymentApiError(data?.message || "No se pudo iniciar el pago.", response.status, typeof data?.code === "string" ? data.code : undefined);
    return data as CreatePaymentResponse;
  },
  async getAmount(): Promise<{ registrationAmount: number; membershipFeeAmount: number; totalAmount: number; currency: "PEN" }> {
    const response = await fetch("/api/payments/amount", { credentials: "include", cache: "no-store" });
    const data = await response.json().catch(() => null);
    if (!response.ok) throw new PaymentApiError(data?.message || "No se pudo obtener el monto.", response.status);
    return data as { registrationAmount: number; membershipFeeAmount: number; totalAmount: number; currency: "PEN" };
  },
};
