import { Prisma } from "@prisma/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let PaymentAmountResolver: typeof import("../Services/PaymentAmountResolver").PaymentAmountResolver;
let PaymentSettingsResolver: typeof import("../../../security/system-settings/Services/PaymentSettingsResolver").PaymentSettingsResolver;

const current = (value: unknown) => ({ value, rawValue: String(value), valueId: 1 });
const settings = (values: Record<string, unknown> = {}) => ({
  getCurrentValue: vi.fn(async (key: string) => key in values ? current(values[key]) : null),
});

describe("PaymentSettingsResolver", () => {
  beforeEach(async () => {
    vi.stubEnv("PAYMENT_ENVIRONMENT", "TEST");
    vi.stubEnv("NIUBIZ_TEST_MERCHANT_NAME", "IIMP Test");
    vi.stubEnv("NIUBIZ_TEST_FORM_BUTTON_COLOR", "#C5A059");
    vi.stubEnv("NIUBIZ_TEST_SESSION_EXPIRATION_MINUTES", "5");
    vi.resetModules();
    ({ PaymentAmountResolver } = await import("../Services/PaymentAmountResolver"));
    ({ PaymentSettingsResolver } = await import("../../../security/system-settings/Services/PaymentSettingsResolver"));
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

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

  it("resuelve la cuota anual desde System Settings cuando está configurada", async () => {
    const resolver = new PaymentSettingsResolver(settings({ PAYMENT_MONTHLY_FEE: new Prisma.Decimal("120.00") }) as never);
    const result = await resolver.getMonthlyFee();
    expect(result?.value).toBeInstanceOf(Prisma.Decimal);
    expect((result?.value as Prisma.Decimal).toString()).toBe("120");
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
    const resolver = new PaymentAmountResolver({ getRegistrationPrice: vi.fn().mockResolvedValue({ amount: new Prisma.Decimal("425.50"), source: "SYSTEM_SETTING" }), getMonthlyFee: vi.fn().mockResolvedValue({ value: new Prisma.Decimal("150.00") }) } as never);
    await expect(resolver.resolve()).resolves.toEqual({ registrationAmount: 425.5, membershipFeeAmount: 150, totalAmount: 575.5, currency: "PEN" });
  });

  it("lanza SystemSettingsError cuando la cuota anual no puede resolverse", async () => {
    const resolver = new PaymentAmountResolver({ getRegistrationPrice: vi.fn().mockResolvedValue({ amount: new Prisma.Decimal("300.00") }), getMonthlyFee: vi.fn().mockResolvedValue(null) } as never);
    await expect(resolver.resolve()).rejects.toMatchObject({ status: 503 });
  });
});
