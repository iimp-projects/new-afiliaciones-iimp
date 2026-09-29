import { describe, expect, it, vi } from "vitest";
import type { CreatePaymentRequest } from "../Models/PaymentRequest";
import type { CreatePaymentResponse } from "../Models/PaymentResponse";
import { PaymentAuthorizationRecoveryError, createPaymentWithAuthorizationRecovery } from "../Services/PaymentAuthorizationRecovery";
import { PAYMENT_AUTH_INVALID_OR_EXPIRED, PaymentApiError } from "../Services/PaymentApi";
import { QueryApiError } from "../../consulta/Services/QueryApi";

const payload: CreatePaymentRequest = { applicationId: 31, billingData: { tipoDocumento: "DNI", numeroDocumento: "12345678", razonSocial: "Ana Pérez", direccionFiscal: "Av. Prueba 123", responsable: "Ana Pérez", emailFacturacion: "ana@example.com" } };
const response: CreatePaymentResponse = { success: true, paymentId: 99, status: "PENDING", amount: 300, currency: "PEN", message: "Pago iniciado." };
const readyApplication = { applicationId: 31, status: "READY_FOR_PAYMENT" } as never;
const authError = () => new PaymentApiError("La autorización temporal de pago no es válida o expiró.", 403, PAYMENT_AUTH_INVALID_OR_EXPIRED);

describe("createPaymentWithAuthorizationRecovery", () => {
  it("mantiene el pago normal sin renovar autorización", async () => {
    const createPayment = vi.fn().mockResolvedValue(response);
    const refreshAuthorization = vi.fn();
    await expect(createPaymentWithAuthorizationRecovery({ payload, createPayment, refreshAuthorization, onApplicationRefreshed: vi.fn() })).resolves.toEqual(response);
    expect(createPayment).toHaveBeenCalledTimes(1);
    expect(refreshAuthorization).not.toHaveBeenCalled();
  });

  it("renueva una vez y reintenta una vez cuando expira la autorización", async () => {
    const createPayment = vi.fn().mockRejectedValueOnce(authError()).mockResolvedValueOnce(response);
    const refreshAuthorization = vi.fn().mockResolvedValue(readyApplication);
    await expect(createPaymentWithAuthorizationRecovery({ payload, createPayment, refreshAuthorization, onApplicationRefreshed: vi.fn() })).resolves.toEqual(response);
    expect(refreshAuthorization).toHaveBeenCalledTimes(1);
    expect(createPayment).toHaveBeenCalledTimes(2);
  });

  it("no crea un loop si el segundo POST vuelve a fallar", async () => {
    const createPayment = vi.fn().mockRejectedValue(authError());
    const refreshAuthorization = vi.fn().mockResolvedValue(readyApplication);
    await expect(createPaymentWithAuthorizationRecovery({ payload, createPayment, refreshAuthorization, onApplicationRefreshed: vi.fn() })).rejects.toMatchObject({ code: PAYMENT_AUTH_INVALID_OR_EXPIRED });
    expect(refreshAuthorization).toHaveBeenCalledTimes(1);
    expect(createPayment).toHaveBeenCalledTimes(2);
  });

  it("no reintenta el POST si renovar la autorización falla", async () => {
    const createPayment = vi.fn().mockRejectedValue(authError());
    const refreshAuthorization = vi.fn().mockRejectedValue(new Error("Consulta expirada"));
    await expect(createPaymentWithAuthorizationRecovery({ payload, createPayment, refreshAuthorization, onApplicationRefreshed: vi.fn() })).rejects.toThrow("Consulta expirada");
    expect(refreshAuthorization).toHaveBeenCalledTimes(1);
    expect(createPayment).toHaveBeenCalledTimes(1);
  });

  it("detiene sin segundo POST cuando el refresh devuelve APPLICATION_ACCESS_EXPIRED", async () => {
    const createPayment = vi.fn().mockRejectedValue(authError());
    const refreshAuthorization = vi.fn().mockRejectedValue(new QueryApiError("Tu sesión de verificación expiró.", 401, "APPLICATION_ACCESS_EXPIRED"));
    await expect(createPaymentWithAuthorizationRecovery({ payload, createPayment, refreshAuthorization, onApplicationRefreshed: vi.fn() })).rejects.toMatchObject({ code: "APPLICATION_ACCESS_EXPIRED" });
    expect(refreshAuthorization).toHaveBeenCalledTimes(1);
    expect(createPayment).toHaveBeenCalledTimes(1);
  });

  it("no reintenta si la solicitud ya no está lista para pagar", async () => {
    const createPayment = vi.fn().mockRejectedValue(authError());
    const refreshAuthorization = vi.fn().mockResolvedValue({ applicationId: 31, status: "COMPLETED" } as never);
    await expect(createPaymentWithAuthorizationRecovery({ payload, createPayment, refreshAuthorization, onApplicationRefreshed: vi.fn() })).rejects.toBeInstanceOf(PaymentAuthorizationRecoveryError);
    expect(createPayment).toHaveBeenCalledTimes(1);
  });

  it("no renueva frente a otro 403", async () => {
    const createPayment = vi.fn().mockRejectedValue(new PaymentApiError("No autorizado.", 403, "OTHER"));
    const refreshAuthorization = vi.fn();
    await expect(createPaymentWithAuthorizationRecovery({ payload, createPayment, refreshAuthorization, onApplicationRefreshed: vi.fn() })).rejects.toMatchObject({ code: "OTHER" });
    expect(createPayment).toHaveBeenCalledTimes(1);
    expect(refreshAuthorization).not.toHaveBeenCalled();
  });

  it("refresca antes del POST cuando el reintento manual ya conoce la autorización inválida", async () => {
    const createPayment = vi.fn().mockResolvedValue(response);
    const refreshAuthorization = vi.fn().mockResolvedValue(readyApplication);
    await expect(createPaymentWithAuthorizationRecovery({ payload, createPayment, refreshAuthorization, onApplicationRefreshed: vi.fn(), refreshBeforePost: true })).resolves.toEqual(response);
    expect(refreshAuthorization).toHaveBeenCalledTimes(1);
    expect(createPayment).toHaveBeenCalledTimes(1);
    expect(refreshAuthorization.mock.invocationCallOrder[0]).toBeLessThan(createPayment.mock.invocationCallOrder[0]);
  });

});
