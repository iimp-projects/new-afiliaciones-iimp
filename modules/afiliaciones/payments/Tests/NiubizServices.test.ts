import { PaymentStatus } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import type { NiubizTestConfig } from "../Config/PaymentConfig";
import { NiubizPaymentProvider } from "../Providers/NiubizPaymentProvider";
import { NiubizAuthorizationService } from "../Services/Niubiz/NiubizAuthorizationService";
import { NiubizResponseMapper } from "../Services/Niubiz/NiubizResponseMapper";
import { NiubizSecurityService } from "../Services/Niubiz/NiubizSecurityService";
import { NiubizSessionService } from "../Services/Niubiz/NiubizSessionService";

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
  authorizationDataMap: {
    urlAddress: "https://sandbox.example",
    serviceLocationCityName: "Lima",
    serviceLocationCountrySubdivisionCode: "LIM",
    serviceLocationCountryCode: "PE",
    serviceLocationPostalCode: "15024",
  },
};

describe("Niubiz request builders", () => {
  it("prepara Security con Basic Auth sin exponer credenciales al checkout", () => {
    const request = new NiubizSecurityService().buildRequest(config);

    expect(request).toEqual({
      url: config.securityUrl,
      method: "GET",
      headers: { Authorization: "Basic dGVzdC11c2VyOnRlc3QtcGFzc3dvcmQ=" },
    });
  });

  it("prepara Session con monto, web, IP y MDD opcional", () => {
    const request = new NiubizSessionService().buildRequest(config, {
      merchantId: config.merchantId!,
      securityToken: "security-token",
      amount: 300,
      clientIp: "203.0.113.1",
      merchantDefineData: { MDD4: "applicant@example.com" },
      dataMap: { email: "applicant@example.com" },
    });

    expect(request).toMatchObject({
      url: "https://sandbox.example/session/123456789",
      headers: { Authorization: "security-token" },
      body: {
        amount: 300,
        channel: "web",
        antifraud: { clientIp: "203.0.113.1", merchantDefineData: { MDD4: "applicant@example.com" } },
        dataMap: { email: "applicant@example.com" },
      },
    });
    expect(new NiubizSessionService().mapResponse({ sessionKey: "session-key" })).toEqual({ sessionKey: "session-key" });
  });

  it("recibe sessionKey sin exponer el security token", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({ sessionKey: "session-key" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await new NiubizSessionService().createSession(config, {
      merchantId: config.merchantId!,
      securityToken: "security-token",
      amount: 300,
    });

    expect(result).toEqual({ session: { sessionKey: "session-key" }, status: 201 });
    expect(fetchMock.mock.calls[0]?.[0]).toBe(config.sessionUrl! + config.merchantId!);
    vi.unstubAllGlobals();
  });

  it("prepara Checkout con Payment.id como purchaseNumber y moneda PEN", () => {
    const provider = new NiubizPaymentProvider(config, "TEST");
    const checkout = provider.buildCheckoutConfig({
      paymentId: 77,
      applicationId: 42,
      billingData: {} as never,
      amount: 300,
      currency: "PEN",
      customer: { email: "applicant@example.com", firstName: "Ana", lastName: "Pérez" },
    }, "session-key");

    expect(checkout).toMatchObject({
      sessionToken: "session-key",
      merchantId: "123456789",
      purchaseNumber: "77",
      amount: 300,
      currency: "PEN",
      checkoutUrl: config.checkoutUrl,
      callbackUrl: config.callbackUrl,
      timeoutUrl: config.timeoutUrl,
      expirationMinutes: 5,
      merchantName: "IIMP",
      formButtonColor: "#C5A059",
      cardholderEmail: "applicant@example.com",
    });
    expect(checkout).not.toHaveProperty("username");
    expect(checkout).not.toHaveProperty("password");
  });

  it("mapea al MDD los datos legacy que existen en la postulación actual", () => {
    const provider = new NiubizPaymentProvider(config, "TEST");
    const request = provider.buildSessionRequest({
      paymentId: 77,
      applicationId: 42,
      billingData: {} as never,
      amount: 300,
      currency: "PEN",
      customer: {
        email: "applicant@example.com",
        phone: "999999999",
        personId: 7,
        documentNumber: "12345678",
      },
    }, "security-token");

    expect(request.body.antifraud.merchantDefineData).toEqual({
      MDD4: "applicant@example.com",
      MDD31: "999999999",
      MDD32: "7",
      MDD34: "12345678",
    });
  });

  it("prepara Authorization usando token, monto y moneda del pago", () => {
    const request = new NiubizAuthorizationService().buildRequest(config, {
      merchantId: config.merchantId!,
      securityToken: "security-token",
      amount: 300,
      currency: "PEN",
      purchaseNumber: "77",
      tokenId: "checkout-token",
      captureType: "manual",
      countable: true,
      dataMap: config.authorizationDataMap,
    });

    expect(request).toMatchObject({
      url: "https://sandbox.example/authorization/123456789",
      body: { captureType: "manual", countable: true, channel: "web", order: { amount: 300, tokenId: "checkout-token", purchaseNumber: "77", currency: "PEN" }, dataMap: config.authorizationDataMap },
    });
  });
});

describe("NiubizResponseMapper", () => {
  it("mapea STATUS Authorized a PAID y conserva metadata saneada", () => {
    const result = new NiubizResponseMapper().mapAuthorization({
      order: { transactionId: "transaction-1" },
      dataMap: {
        STATUS: "Authorized",
        TRANSACTION_DATE: "2026-09-02T12:00:00Z",
        CARD: "4111******1111",
        BRAND: "VISA",
      },
      data: { ACTION_CODE: "000", ACTION_DESCRIPTION: "Aprobada" },
    });

    expect(result).toMatchObject({
      status: PaymentStatus.PAID,
      transactionId: "transaction-1",
      responseCode: "000",
      gatewayPayload: { actionDescription: "Aprobada", brand: "VISA", maskedCard: "4111******1111" },
    });
  });

  it("mapea errorCode o ACTION_CODE a FAILED sin conservar PAN", () => {
    const result = new NiubizResponseMapper().mapAuthorization({
      dataMap: { ACTION_CODE: "116", ACTION_DESCRIPTION: "Fondos insuficientes" },
      CARD: "4111111111111111",
    });

    expect(result).toMatchObject({ status: PaymentStatus.FAILED, responseCode: "116", failureCode: "116" });
    expect(result.gatewayPayload).not.toHaveProperty("maskedCard");
  });

  it("persiste metadata estructurada segura de una autorizaciÃ³n aprobada", () => {
    const result = new NiubizResponseMapper().mapAuthorization({
      order: { transactionId: "transaction-1", authorizationCode: "123456", traceNumber: "trace-1" },
      dataMap: {
        STATUS: "Authorized",
        ACTION_CODE: "010",
        TRANSACTION_DATE: "260903152221",
        CARD: "455170******8059",
        BRAND: "visa",
        CARD_TYPE: "C",
      },
    }, "web");

    expect(result).toMatchObject({
      status: PaymentStatus.PAID,
      cardBrand: "visa",
      maskedCard: "455170******8059",
      paymentChannel: "web",
      actionCode: "010",
      cardType: "C",
      traceNumber: "trace-1",
    });
    expect(result.gatewayTransactionDate).toEqual(new Date(Date.UTC(2026, 8, 3, 15, 22, 21)));
    expect(result.gatewayPayload).toEqual({ transactionDate: "260903152221", brand: "visa", maskedCard: "455170******8059" });
    expect(result).not.toHaveProperty("transactionToken");
    expect(result).not.toHaveProperty("securityToken");
  });

  it.each([undefined, "", "2026-09-03T15:22:21Z", "260900152221", "260902252221"]) (
    "no convierte una fecha Niubiz invÃ¡lida: %s",
    (transactionDate) => {
      const result = new NiubizResponseMapper().mapAuthorization({
        STATUS: "Authorized",
        dataMap: { ACTION_CODE: "000" },
        TRANSACTION_DATE: transactionDate,
      });

      expect(result.gatewayTransactionDate).toBeUndefined();
    },
  );

  it("no persiste una tarjeta que parece PAN y no infiere channel ausente", () => {
    const result = new NiubizResponseMapper().mapAuthorization({
      STATUS: "Authorized",
      dataMap: { ACTION_CODE: "000" },
      CARD: "4551701234568059",
      BRAND: "visa",
    });

    expect(result.maskedCard).toBeUndefined();
    expect(result.paymentChannel).toBeUndefined();
    expect(result.gatewayPayload).toEqual({ brand: "visa" });
  });
});
