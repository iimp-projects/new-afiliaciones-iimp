import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ initiate: vi.fn() }));

vi.mock("@/modules/afiliaciones/payments/Services/PaymentAuthorizationService", () => ({
  paymentAuthorizationService: { cookieName: "iimp_payment_authorization" },
}));
vi.mock("@/modules/afiliaciones/payments/Services/PaymentService", () => ({
  paymentService: { initiate: mocks.initiate },
  PaymentServiceError: class PaymentServiceError extends Error {
    constructor(message: string, public readonly status: number, public readonly code?: string) { super(message); }
  },
}));

import { PaymentServiceError } from "@/modules/afiliaciones/payments/Services/PaymentService";
import { POST } from "./route";

const validBody = { applicationId: 31, billingData: { tipoDocumento: "DNI", numeroDocumento: "12345678", razonSocial: "Ana Pérez", direccionFiscal: "Av. Prueba 123", responsable: "Ana Pérez", emailFacturacion: "ana@example.com" } };

describe("POST /api/payments", () => {
  beforeEach(() => vi.clearAllMocks());

  it("devuelve un código seguro cuando la autorización temporal es inválida", async () => {
    mocks.initiate.mockRejectedValue(new PaymentServiceError("La autorización temporal de pago no es válida o expiró.", 403, "PAYMENT_AUTH_INVALID_OR_EXPIRED"));
    const response = await POST(new Request("http://localhost/api/payments", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(validBody) }));
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ message: "La autorización temporal de pago no es válida o expiró.", code: "PAYMENT_AUTH_INVALID_OR_EXPIRED" });
  });
});
