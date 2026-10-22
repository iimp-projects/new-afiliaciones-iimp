import { PaymentMethod, PaymentStatus } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import type { NiubizTestConfig } from "../Config/PaymentConfig";
import { NiubizPaymentProvider, NiubizProviderConfigurationError } from "../Providers/NiubizPaymentProvider";
import { NiubizResponseMapper } from "../Services/Niubiz/NiubizResponseMapper";
import { NiubizSecurityHttpError, NiubizSecurityNetworkError, NiubizSecurityService } from "../Services/Niubiz/NiubizSecurityService";

const config: NiubizTestConfig = {
  merchantId: "123456789",
  username: "test-user",
  password: "test-password",
  securityUrl: "https://sandbox.example/security",
  sessionUrl: "https://sandbox.example/session/",
  authorizationUrl: "https://sandbox.example/authorization/",
  checkoutUrl: "https://sandbox.example/checkout.js",
  callbackUrl: "http://localhost:3000/api/payments/niubiz/callback",
  timeoutUrl: "http://localhost:3000/consulta",
  merchantName: "IIMP",
  formButtonColor: "#C5A059",
  sessionExpirationMinutes: 5,
  authorizationDataMap: {
    urlAddress: "https://sandbox.example",
    serviceLocationCityName: "Lima",
    serviceLocationCountrySubdivisionCode: "LIM",
    serviceLocationCountryCode: "PE",
    serviceLocationPostalCode: "15024",
  },
};

const command = {
  paymentId: 77,
  applicationId: 42,
  billingData: {} as never,
  amount: 300,
  currency: "PEN" as const,
  customer: { email: "applicant@example.com", phone: "999999999", personId: 7, documentNumber: "12345678", address: { street: "Calle Los Canarios 155-157, La Molina", city: "Lima", state: "Lima", countryCode: "PE", postalCode: "15024" } },
};

describe("FASE 01 — Security", () => {
  it("lanza NiubizSecurityHttpError con el estado para 401/403/5xx", async () => {
    for (const status of [401, 403, 500]) {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status }));
      await expect(new NiubizSecurityService().getAccessToken(config)).rejects.toMatchObject({ status });
    }
    vi.unstubAllGlobals();
  });

  it("lanza NiubizSecurityNetworkError ante fallo de conexión o timeout", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("The operation was aborted due to timeout")));
    await expect(new NiubizSecurityService().getAccessToken(config)).rejects.toThrow(NiubizSecurityNetworkError);
    vi.unstubAllGlobals();
  });

  it("no expone credenciales fuera del encabezado Basic server-side", () => {
    const request = new NiubizSecurityService().buildRequest(config);
    expect(JSON.stringify(request)).not.toContain("test-password");
    expect(request.headers.Authorization).toMatch(/^Basic /);
  });
});

describe("FASE 02 — Session", () => {
  it("envía los cuatro MDD obligatorios con sus valores correctos", () => {
    const request = new NiubizPaymentProvider(config, "TEST").buildSessionRequest(command, "security-token");
    expect(request.body.antifraud.merchantDefineData).toEqual({
      MDD4: "applicant@example.com",
      MDD31: "999999999",
      MDD32: "7",
      MDD34: "12345678",
      MDD75: "Registrado",
    });
  });

  it("usa documentNumber como identificador único cuando no hay personId", () => {
    const request = new NiubizPaymentProvider(config, "TEST").buildSessionRequest({
      ...command,
      customer: { email: "applicant@example.com", documentNumber: "12345678", phone: "999999999", address: { street: "Calle Los Canarios 155-157, La Molina", city: "Lima", state: "Lima", countryCode: "PE", postalCode: "15024" } },
    }, "security-token");
    expect(request.body.antifraud.merchantDefineData).toMatchObject({
      MDD32: "12345678",
      MDD75: "Invitado",
      MDD77: 1,
    });
  });

  it("envía el dataMap con los seis campos del titular reales", () => {
    const request = new NiubizPaymentProvider(config, "TEST").buildSessionRequest(command, "security-token");
    expect(request.body.dataMap).toEqual({
      cardholderCity: "Lima",
      cardholderCountry: "PE",
      cardholderAddress: "Calle Los Canarios 155-157, La Molina",
      cardholderPostalCode: "15024",
      cardholderState: "Lima",
      cardholderPhoneNumber: "999999999",
    });
  });

  it("no usa datos institucionales como dirección del titular", () => {
    const request = new NiubizPaymentProvider({ ...config }, "TEST").buildSessionRequest(command, "security-token");
    expect(request.body.dataMap?.cardholderAddress).toBe("Calle Los Canarios 155-157, La Molina");
    expect(request.body.dataMap?.cardholderAddress).not.toBe(config.authorizationDataMap?.urlAddress);
  });

  it("impiden enviar una sesión incompleta sin MDD32", () => {
    const provider = new NiubizPaymentProvider(config, "TEST");
    expect(() => provider.buildSessionRequest({
      ...command,
      customer: { email: "applicant@example.com" },
    }, "security-token")).toThrow(NiubizProviderConfigurationError);
  });

  it("impiden enviar una sesión cuando falta un campo del dataMap", () => {
    const provider = new NiubizPaymentProvider(config, "TEST");
    expect(() => provider.buildSessionRequest({
      ...command,
      customer: { ...command.customer, address: { ...command.customer.address, postalCode: undefined } },
    }, "security-token")).toThrow(/cardholderPostalCode/);
  });

  it("no usa el número de pedido como identificador de cliente", () => {
    const request = new NiubizPaymentProvider(config, "TEST").buildSessionRequest(command, "security-token");
    const mdd = request.body.antifraud.merchantDefineData;
    expect(mdd?.MDD32).not.toBe(String(command.paymentId));
  });
});

describe("FASE 03 — Checkout", () => {
  it("limita la expiración de la sesión al máximo de 20 minutos", () => {
    const provider = new NiubizPaymentProvider({ ...config, sessionExpirationMinutes: 30 }, "TEST");
    expect(provider.buildCheckoutConfig(command, "session-token").expirationMinutes).toBe(20);
  });

  it("mantiene un purchaseNumber numérico de hasta 12 dígitos", () => {
    const checkout = new NiubizPaymentProvider(config, "TEST").buildCheckoutConfig(command, "session-token");
    expect(checkout.purchaseNumber).toBe("77");
    expect(checkout.purchaseNumber).toMatch(/^\d{1,12}$/);
  });
});

describe("FASE 05 — Fecha de operación", () => {
  it("interpreta TRANSACTION_DATE en America/Lima (UTC-5) sin desplazamiento", () => {
    expect(new NiubizResponseMapper().parseTransactionDate("260903152221"))
      .toEqual(new Date(Date.UTC(2026, 8, 3, 20, 22, 21)));
  });

  it("conserva datos comerciales de una respuesta aprobada sin exponer PAN", () => {
    const result = new NiubizResponseMapper().mapAuthorization({
      order: { transactionId: "transaction-1", purchaseNumber: "77", amount: 300, currency: "PEN" },
      dataMap: { STATUS: "Authorized", ACTION_CODE: "000", CARD: "4111******1111", BRAND: "VISA" },
    });
    expect(result).toMatchObject({
      status: PaymentStatus.PAID,
      transactionId: "transaction-1",
      gatewayAmount: 300,
      gatewayCurrency: "PEN",
      gatewayPurchaseNumber: "77",
      cardBrand: "VISA",
      maskedCard: "4111******1111",
      paymentMethod: PaymentMethod.UNKNOWN,
    });
    expect(JSON.stringify(result)).not.toContain("4111111111111111");
  });

  it("conserva el motivo de rechazo ACTION_DESCRIPTION", () => {
    const result = new NiubizResponseMapper().mapAuthorization({
      dataMap: { ACTION_CODE: "116", ACTION_DESCRIPTION: "Fondos insuficientes" },
    });
    expect(result).toMatchObject({ status: PaymentStatus.FAILED, failureCode: "116", failureReason: "Fondos insuficientes" });
  });
});
