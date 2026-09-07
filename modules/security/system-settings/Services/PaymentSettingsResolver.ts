import { Prisma } from "@prisma/client";
import { paymentConfig } from "../../../afiliaciones/payments/Config/PaymentConfig";
import { SYSTEM_SETTING_KEYS } from "../Models/SystemSettingKeys";
import { SystemSettingsError, SystemSettingsService } from "./SystemSettingsService";

export class PaymentSettingsResolver {
  constructor(private readonly settings = new SystemSettingsService()) {}

  async getRegistrationPrice(now = new Date()): Promise<{ amount: Prisma.Decimal; source: "SYSTEM_SETTING" | "TEST_FALLBACK" }> {
    const setting = await this.settings.getCurrentValue(SYSTEM_SETTING_KEYS.PAYMENT_REGISTRATION_PRICE, now);
    if (setting) return { amount: setting.value as Prisma.Decimal, source: "SYSTEM_SETTING" };
    // TODO: retirar cuando la administración de precios esté estabilizada.
    if (paymentConfig.environment === "TEST") return { amount: new Prisma.Decimal(paymentConfig.testAmount), source: "TEST_FALLBACK" };
    throw new SystemSettingsError("No existe un precio de inscripción vigente configurado.", 503);
  }
  async getMonthlyFee(now = new Date()) { return this.settings.getCurrentValue(SYSTEM_SETTING_KEYS.PAYMENT_MONTHLY_FEE, now); }
  async arePaymentsEnabled(now = new Date()) { return this.boolean(SYSTEM_SETTING_KEYS.PAYMENTS_ENABLED, now); }
  async getPaymentWindow(now = new Date()) {
    return {
      startsAt: await this.date(SYSTEM_SETTING_KEYS.PAYMENT_START_AT, now),
      endsAt: await this.date(SYSTEM_SETTING_KEYS.PAYMENT_END_AT, now),
    };
  }

  async assertPaymentInitiationAvailable(now = new Date()): Promise<void> {
    const enabled = await this.arePaymentsEnabled(now);
    if (enabled === false) throw new SystemSettingsError("Los pagos se encuentran deshabilitados temporalmente.", 409);
    if (enabled === null && paymentConfig.environment !== "TEST") throw new SystemSettingsError("Falta configurar la disponibilidad de pagos.", 503);
    const window = await this.getPaymentWindow(now);
    if (window.startsAt && now < window.startsAt) throw new SystemSettingsError("Los pagos estarán disponibles a partir de la fecha configurada.", 409);
    if (window.endsAt && now >= window.endsAt) throw new SystemSettingsError("La ventana de pagos ha finalizado.", 409);
  }
  async isCardEnabled(now = new Date()) { return this.boolean(SYSTEM_SETTING_KEYS.CARD_ENABLED, now); }
  async isYapeEnabled(now = new Date()) { return this.boolean(SYSTEM_SETTING_KEYS.YAPE_ENABLED, now); }
  async getNiubizCheckoutSettings(now = new Date()) {
    const [merchantName, logoUrl, formButtonColor, expirationMinutes] = await Promise.all([
      this.settings.getCurrentValue(SYSTEM_SETTING_KEYS.NIUBIZ_MERCHANT_NAME, now),
      this.settings.getCurrentValue(SYSTEM_SETTING_KEYS.NIUBIZ_CHECKOUT_LOGO_URL, now),
      this.settings.getCurrentValue(SYSTEM_SETTING_KEYS.NIUBIZ_FORM_BUTTON_COLOR, now),
      this.settings.getCurrentValue(SYSTEM_SETTING_KEYS.NIUBIZ_SESSION_EXPIRATION_MINUTES, now),
    ]);
    return {
      merchantName: this.requiredCheckoutValue(merchantName?.value as string | undefined, paymentConfig.niubiz.merchantName, "NIUBIZ_MERCHANT_NAME"),
      logoUrl: (logoUrl?.value as string | undefined) ?? (paymentConfig.environment === "TEST" ? paymentConfig.niubiz.merchantLogoUrl : undefined),
      formButtonColor: this.requiredCheckoutValue(formButtonColor?.value as string | undefined, paymentConfig.niubiz.formButtonColor, "NIUBIZ_FORM_BUTTON_COLOR"),
      expirationMinutes: this.requiredCheckoutValue(expirationMinutes?.value as number | undefined, paymentConfig.niubiz.sessionExpirationMinutes, "NIUBIZ_SESSION_EXPIRATION_MINUTES"),
    };
  }

  async getPaymentConfirmationEmailSettings(now = new Date()) {
    const [enabled, subject] = await Promise.all([
      this.boolean(SYSTEM_SETTING_KEYS.PAYMENT_CONFIRMATION_EMAIL_ENABLED, now),
      this.settings.getCurrentValue(SYSTEM_SETTING_KEYS.PAYMENT_CONFIRMATION_EMAIL_SUBJECT, now),
    ]);
    if (enabled === null && paymentConfig.environment !== "TEST") throw new SystemSettingsError("Falta configurar el envío de correos de confirmación.", 503);
    return {
      enabled: enabled ?? true,
      subject: (subject?.value as string | undefined) ?? (paymentConfig.environment === "TEST" ? "Afiliación IIMP confirmada – Pago realizado correctamente" : undefined),
    };
  }

  private async boolean(key: typeof SYSTEM_SETTING_KEYS[keyof typeof SYSTEM_SETTING_KEYS], now: Date) { const setting = await this.settings.getCurrentValue(key, now); return setting ? setting.value as boolean : null; }
  private async date(key: typeof SYSTEM_SETTING_KEYS[keyof typeof SYSTEM_SETTING_KEYS], now: Date) { const setting = await this.settings.getCurrentValue(key, now); return setting ? setting.value as Date : null; }
  private requiredCheckoutValue<T>(settingValue: T | undefined, fallback: T | undefined, key: string): T {
    if (settingValue !== undefined) return settingValue;
    if (paymentConfig.environment === "TEST" && fallback !== undefined) return fallback;
    throw new SystemSettingsError(`Falta configurar ${key} para Checkout Niubiz.`, 503);
  }
}
