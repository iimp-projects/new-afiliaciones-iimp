import type { CreatePaymentRequest } from "../Models/PaymentRequest";
import type { CreatePaymentResponse } from "../Models/PaymentResponse";

export const paymentApi = {
  async createPayment(payload: CreatePaymentRequest): Promise<CreatePaymentResponse> {
    const response = await fetch("/api/payments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(payload),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) throw new Error(data?.message || "No se pudo iniciar el pago.");
    return data as CreatePaymentResponse;
  },
};

