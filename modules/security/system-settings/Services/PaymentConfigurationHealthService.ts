import { paymentConfig } from "../../../afiliaciones/payments/Config/PaymentConfig";
import { SYSTEM_SETTING_KEYS, type SystemSettingKey } from "../Models/SystemSettingKeys";
import { SystemSettingsService } from "./SystemSettingsService";

export type PaymentConfigurationHealthStatus = "READY" | "INCOMPLETE" | "DISABLED" | "OUTSIDE_PAYMENT_WINDOW";
export type PaymentConfigurationSource = "SYSTEM_SETTING" | "TEST_FALLBACK" | "MISSING";

export interface PaymentConfigurationCheck {
  key: SystemSettingKey;
  label: string;
  source: PaymentConfigurationSource;
  required: boolean;
  value?: string | number | boolean;
}

export interface PaymentConfigurationHealth {
  status: PaymentConfigurationHealthStatus;
  environment: "TEST" | "PRODUCTION";
  missing: string[];
  fallbacks: PaymentConfigurationCheck[];
  checks: PaymentConfigurationCheck[];
}

interface PaymentHealthRuntimeConfig {
  environment: "TEST" | "PRODUCTION";
  testAmount: number;
  niubiz: { merchantName?: string; merchantLogoUrl?: string; formButtonColor?: string; sessionExpirationMinutes?: number };
}

const labels: Record<SystemSettingKey, string> = {
  PAYMENT_REGISTRATION_PRICE: "Precio de inscripción vigente",
  PAYMENT_MONTHLY_FEE: "Cuota anual",
  PAYMENTS_ENABLED: "Pagos habilitados",
  PAYMENT_START_AT: "Inicio de ventana de pagos",
  PAYMENT_END_AT: "Fin de ventana de pagos",
  CARD_ENABLED: "Pagos con tarjeta",
  YAPE_ENABLED: "Yape",
  NIUBIZ_MERCHANT_NAME: "Merchant Name",
  NIUBIZ_CHECKOUT_LOGO_URL: "Logo de Checkout",
  NIUBIZ_FORM_BUTTON_COLOR: "Color del botón de Checkout",
  NIUBIZ_SESSION_EXPIRATION_MINUTES: "Expiración de sesión de Checkout",
  PAYMENT_CONFIRMATION_EMAIL_ENABLED: "Correo de confirmación habilitado",
  PAYMENT_CONFIRMATION_EMAIL_SUBJECT: "Asunto del correo de confirmación",
};

export class PaymentConfigurationHealthService {
  constructor(
    private readonly settings: Pick<SystemSettingsService, "getCurrentValue"> = new SystemSettingsService(),
    private readonly config: PaymentHealthRuntimeConfig = {
      environment: paymentConfig.environment === "PRODUCTION" ? "PRODUCTION" : "TEST",
      testAmount: paymentConfig.testAmount,
      niubiz: paymentConfig.niubiz,
    },
  ) {}

  async getHealth(now = new Date()): Promise<PaymentConfigurationHealth> {
    const values = await Promise.all(Object.values(SYSTEM_SETTING_KEYS).map(async (key) => [key, await this.settings.getCurrentValue(key, now)] as const));
    const current = new Map(values);
    const checks: PaymentConfigurationCheck[] = [];
    const missing: string[] = [];
    const add = (key: SystemSettingKey, value: string | number | boolean | undefined, fallback: string | number | boolean | undefined, required = true) => {
      if (value !== undefined) checks.push({ key, label: labels[key], source: "SYSTEM_SETTING", required, value });
      else if (this.config.environment === "TEST" && fallback !== undefined) checks.push({ key, label: labels[key], source: "TEST_FALLBACK", required, value: fallback });
      else { checks.push({ key, label: labels[key], source: "MISSING", required }); if (required) missing.push(labels[key]); }
    };
    const value = <T>(key: SystemSettingKey) => current.get(key)?.value as T | undefined;

    add(SYSTEM_SETTING_KEYS.PAYMENT_REGISTRATION_PRICE, value<number>(SYSTEM_SETTING_KEYS.PAYMENT_REGISTRATION_PRICE), this.config.testAmount);
    const enabled = value<boolean>(SYSTEM_SETTING_KEYS.PAYMENTS_ENABLED);
    add(SYSTEM_SETTING_KEYS.PAYMENTS_ENABLED, enabled, true);
    const startsAt = value<Date>(SYSTEM_SETTING_KEYS.PAYMENT_START_AT);
    const endsAt = value<Date>(SYSTEM_SETTING_KEYS.PAYMENT_END_AT);
    add(SYSTEM_SETTING_KEYS.PAYMENT_START_AT, startsAt?.toISOString(), undefined);
    add(SYSTEM_SETTING_KEYS.PAYMENT_END_AT, endsAt?.toISOString(), undefined);
    add(SYSTEM_SETTING_KEYS.NIUBIZ_MERCHANT_NAME, value<string>(SYSTEM_SETTING_KEYS.NIUBIZ_MERCHANT_NAME), this.config.niubiz.merchantName);
    add(SYSTEM_SETTING_KEYS.NIUBIZ_CHECKOUT_LOGO_URL, value<string>(SYSTEM_SETTING_KEYS.NIUBIZ_CHECKOUT_LOGO_URL), this.config.niubiz.merchantLogoUrl, false);
    add(SYSTEM_SETTING_KEYS.NIUBIZ_FORM_BUTTON_COLOR, value<string>(SYSTEM_SETTING_KEYS.NIUBIZ_FORM_BUTTON_COLOR), this.config.niubiz.formButtonColor);
    add(SYSTEM_SETTING_KEYS.NIUBIZ_SESSION_EXPIRATION_MINUTES, value<number>(SYSTEM_SETTING_KEYS.NIUBIZ_SESSION_EXPIRATION_MINUTES), this.config.niubiz.sessionExpirationMinutes);
    const emailEnabled = value<boolean>(SYSTEM_SETTING_KEYS.PAYMENT_CONFIRMATION_EMAIL_ENABLED);
    add(SYSTEM_SETTING_KEYS.PAYMENT_CONFIRMATION_EMAIL_ENABLED, emailEnabled, true);
    if (emailEnabled !== false) add(SYSTEM_SETTING_KEYS.PAYMENT_CONFIRMATION_EMAIL_SUBJECT, value<string>(SYSTEM_SETTING_KEYS.PAYMENT_CONFIRMATION_EMAIL_SUBJECT), "Afiliación IIMP confirmada – Pago realizado correctamente");

    const fallbacks = checks.filter((check) => check.source === "TEST_FALLBACK");
    if (enabled === false) return { status: "DISABLED", environment: this.config.environment, missing, fallbacks, checks };
    if (startsAt && now < startsAt || endsAt && now >= endsAt) return { status: "OUTSIDE_PAYMENT_WINDOW", environment: this.config.environment, missing, fallbacks, checks };
    return { status: missing.length > 0 ? "INCOMPLETE" : "READY", environment: this.config.environment, missing, fallbacks, checks };
  }
}
