import { describe, expect, it } from "vitest";
import { NiubizPaymentProvider, NiubizProviderConfigurationError } from "../Providers/NiubizPaymentProvider";

describe("NiubizPaymentProvider", () => {
  it("falla antes de persistir cuando faltan credenciales privadas de TEST", () => {
    const provider = new NiubizPaymentProvider({ merchantId: "merchant-test" });

    expect(() => provider.assertReady()).toThrow(NiubizProviderConfigurationError);
    expect(() => provider.assertReady()).toThrow("NIUBIZ_USERNAME, NIUBIZ_PASSWORD");
  });

  it("acepta la configuración completa de Niubiz TEST", () => {
    const provider = new NiubizPaymentProvider({
      merchantId: "merchant-test",
      username: "username-test",
      password: "password-test",
      securityUrl: "https://sandbox.example/security",
      sessionUrl: "https://sandbox.example/session",
      authorizationUrl: "https://sandbox.example/authorization",
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
    }, "TEST");

    expect(() => provider.assertReady()).not.toThrow();
  });
  it("aplica el snapshot público de System Settings al Checkout", () => {
    const provider = new NiubizPaymentProvider({
      merchantId: "merchant-test", username: "username-test", password: "password-test",
      securityUrl: "https://sandbox.example/security", sessionUrl: "https://sandbox.example/session", authorizationUrl: "https://sandbox.example/authorization",
      checkoutUrl: "https://sandbox.example/checkout.js", callbackUrl: "http://localhost:3000/api/payments/niubiz/callback", timeoutUrl: "http://localhost:3000/consulta",
      merchantName: "Anterior", formButtonColor: "#000000",
    }, "TEST").withCheckoutSettings({ merchantName: "IIMP Dinámico", logoUrl: "https://cdn.example/logo.png", formButtonColor: "#C79A3B", expirationMinutes: 12 });
    const checkout = provider.buildCheckoutConfig({ paymentId: 77, applicationId: 42, amount: 300, currency: "PEN", billingData: {} as never, customer: { email: "applicant@example.com" } }, "session-token");
    expect(checkout).toMatchObject({ merchantName: "IIMP Dinámico", merchantLogoUrl: "https://cdn.example/logo.png", formButtonColor: "#C79A3B", expirationMinutes: 12 });
  });
});
