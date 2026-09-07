import { Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { PaymentAmountResolver } from "../Services/PaymentAmountResolver";
import { PaymentSettingsResolver } from "../../../security/system-settings/Services/PaymentSettingsResolver";

const current = (value: unknown) => ({ value, rawValue: String(value), valueId: 1 });
const settings = (values: Record<string, unknown> = {}) => ({
  getCurrentValue: vi.fn(async (key: string) => key in values ? current(values[key]) : null),
});

describe("PaymentSettingsResolver", () => {
  it("resuelve el precio de inscripción desde System Settings", async () => {
    const resolver = new PaymentSettingsResolver(settings({ PAYMENT_REGISTRATION_PRICE: new Prisma.Decimal("350.00") }) as never);
    expect((await resolver.getRegistrationPrice()).amount.toString()).toBe("350");
  });

  it("mantiene el fallback TEST de precio cuando no existe configuración", async () => {
    const resolver = new PaymentSettingsResolver(settings() as never);
    expect((await resolver.getRegistrationPrice()).source).toBe("TEST_FALLBACK");
    await expect(resolver.assertPaymentInitiationAvailable()).resolves.toBeUndefined();
    await expect(resolver.getNiubizCheckoutSettings()).resolves.toMatchObject({ expirationMinutes: expect.any(Number) });
    await expect(resolver.getPaymentConfirmationEmailSettings()).resolves.toMatchObject({ enabled: true });
  });

  it("bloquea pagos deshabilitados y ventanas fuera de vigencia", async () => {
    await expect(new PaymentSettingsResolver(settings({ PAYMENTS_ENABLED: false }) as never).assertPaymentInitiationAvailable()).rejects.toMatchObject({ status: 409 });
    await expect(new PaymentSettingsResolver(settings({ PAYMENTS_ENABLED: true, PAYMENT_START_AT: new Date("2099-01-01T00:00:00Z") }) as never).assertPaymentInitiationAvailable()).rejects.toMatchObject({ status: 409 });
    await expect(new PaymentSettingsResolver(settings({ PAYMENTS_ENABLED: true, PAYMENT_END_AT: new Date("2000-01-01T00:00:00Z") }) as never).assertPaymentInitiationAvailable()).rejects.toMatchObject({ status: 409 });
  });

  it("permite una ventana vigente y devuelve configuración pública dinámica de Checkout", async () => {
    const resolver = new PaymentSettingsResolver(settings({
      PAYMENTS_ENABLED: true,
      PAYMENT_START_AT: new Date("2000-01-01T00:00:00Z"),
      PAYMENT_END_AT: new Date("2099-01-01T00:00:00Z"),
      NIUBIZ_MERCHANT_NAME: "IIMP Configurado",
      NIUBIZ_CHECKOUT_LOGO_URL: "https://cdn.example/logo.png",
      NIUBIZ_FORM_BUTTON_COLOR: "#C79A3B",
      NIUBIZ_SESSION_EXPIRATION_MINUTES: 12,
    }) as never);
    await expect(resolver.assertPaymentInitiationAvailable()).resolves.toBeUndefined();
    await expect(resolver.getNiubizCheckoutSettings()).resolves.toMatchObject({ merchantName: "IIMP Configurado", logoUrl: "https://cdn.example/logo.png", formButtonColor: "#C79A3B", expirationMinutes: 12 });
  });

  it("resuelve el monto asincrónico sin aceptar datos del navegador", async () => {
    const resolver = new PaymentAmountResolver({ getRegistrationPrice: vi.fn().mockResolvedValue({ amount: new Prisma.Decimal("425.50"), source: "SYSTEM_SETTING" }) } as never);
    await expect(resolver.resolve()).resolves.toEqual({ amount: 425.5, currency: "PEN" });
  });
});
