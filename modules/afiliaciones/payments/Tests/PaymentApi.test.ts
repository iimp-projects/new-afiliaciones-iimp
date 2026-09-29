import { describe, expect, it, vi } from "vitest";
import { PAYMENT_AUTH_INVALID_OR_EXPIRED, PaymentApiError, paymentApi } from "../Services/PaymentApi";
import type { CreatePaymentRequest } from "../Models/PaymentRequest";

const payload: CreatePaymentRequest = { applicationId: 31, billingData: { tipoDocumento: "DNI", numeroDocumento: "12345678", razonSocial: "Ana Pérez", direccionFiscal: "Av. Prueba 123", responsable: "Ana Pérez", emailFacturacion: "ana@example.com" } };

describe("paymentApi", () => {
  it("preserva status, code y mensaje de un error de autorización temporal", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ code: PAYMENT_AUTH_INVALID_OR_EXPIRED, message: "La autorización temporal de pago no es válida o expiró." }), { status: 403 })));
    await expect(paymentApi.createPayment(payload)).rejects.toMatchObject({ name: "PaymentApiError", status: 403, code: PAYMENT_AUTH_INVALID_OR_EXPIRED });
  });

  it("preserva otros errores sin asignarles código de autorización", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ message: "Conflicto." }), { status: 409 })));
    await expect(paymentApi.createPayment(payload)).rejects.toEqual(expect.objectContaining(new PaymentApiError("Conflicto.", 409)));
  });
});
