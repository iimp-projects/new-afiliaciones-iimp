import { describe, expect, it, vi } from "vitest";
import { PaymentConfigurationHealthService } from "../Services/PaymentConfigurationHealthService";

const now = new Date("2026-09-10T12:00:00.000Z");
const settings = (values: Record<string, unknown>) => ({ getCurrentValue: vi.fn(async (key: string) => key in values ? { value: values[key], rawValue: String(values[key]), valueId: 1 } : null) });
const runtime = (environment: "TEST" | "PRODUCTION") => ({ environment, testAmount: 300, niubiz: { merchantName: "IIMP", merchantLogoUrl: "https://cdn.example/logo.png", formButtonColor: "#C5A059", sessionExpirationMinutes: 5 } });

describe("PaymentConfigurationHealthService", () => {
  it("informa READY con configuraciones vigentes de producción", async () => {
    const service = new PaymentConfigurationHealthService(settings({
      PAYMENT_REGISTRATION_PRICE: 300, PAYMENTS_ENABLED: true,
      PAYMENT_START_AT: new Date("2026-01-01T00:00:00Z"), PAYMENT_END_AT: new Date("2027-01-01T00:00:00Z"),
      NIUBIZ_MERCHANT_NAME: "IIMP", NIUBIZ_FORM_BUTTON_COLOR: "#C5A059", NIUBIZ_SESSION_EXPIRATION_MINUTES: 5,
      PAYMENT_CONFIRMATION_EMAIL_ENABLED: false,
    }) as never, runtime("PRODUCTION"));
    await expect(service.getHealth(now)).resolves.toMatchObject({ status: "READY", missing: [] });
  });

  it("informa configuración incompleta en producción", async () => {
    const health = await new PaymentConfigurationHealthService(settings({}) as never, runtime("PRODUCTION")).getHealth(now);
    expect(health.status).toBe("INCOMPLETE");
    expect(health.missing).toContain("Precio de inscripción vigente");
  });

  it("distingue pagos deshabilitados y ventana fuera de vigencia", async () => {
    const disabled = await new PaymentConfigurationHealthService(settings({ PAYMENTS_ENABLED: false }) as never, runtime("TEST")).getHealth(now);
    expect(disabled.status).toBe("DISABLED");
    const outside = await new PaymentConfigurationHealthService(settings({ PAYMENTS_ENABLED: true, PAYMENT_START_AT: new Date("2026-10-01T00:00:00Z") }) as never, runtime("TEST")).getHealth(now);
    expect(outside.status).toBe("OUTSIDE_PAYMENT_WINDOW");
  });

  it("expone fallbacks TEST sin revelar secretos", async () => {
    const health = await new PaymentConfigurationHealthService(settings({}) as never, runtime("TEST")).getHealth(now);
    expect(health.fallbacks.map((item) => item.key)).toContain("PAYMENT_REGISTRATION_PRICE");
    expect(JSON.stringify(health)).not.toContain("password");
  });
});
