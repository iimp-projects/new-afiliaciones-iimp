import { ConfigDataType } from "@prisma/client";

export const SYSTEM_SETTING_KEYS = {
  PAYMENT_REGISTRATION_PRICE: "PAYMENT_REGISTRATION_PRICE",
  PAYMENT_MONTHLY_FEE: "PAYMENT_MONTHLY_FEE",
  PAYMENTS_ENABLED: "PAYMENTS_ENABLED",
  PAYMENT_START_AT: "PAYMENT_START_AT",
  PAYMENT_END_AT: "PAYMENT_END_AT",
  CARD_ENABLED: "CARD_ENABLED",
  YAPE_ENABLED: "YAPE_ENABLED",
  NIUBIZ_MERCHANT_NAME: "NIUBIZ_MERCHANT_NAME",
  NIUBIZ_CHECKOUT_LOGO_URL: "NIUBIZ_CHECKOUT_LOGO_URL",
  NIUBIZ_FORM_BUTTON_COLOR: "NIUBIZ_FORM_BUTTON_COLOR",
  NIUBIZ_SESSION_EXPIRATION_MINUTES: "NIUBIZ_SESSION_EXPIRATION_MINUTES",
  PAYMENT_CONFIRMATION_EMAIL_ENABLED: "PAYMENT_CONFIRMATION_EMAIL_ENABLED",
  PAYMENT_CONFIRMATION_EMAIL_SUBJECT: "PAYMENT_CONFIRMATION_EMAIL_SUBJECT",
} as const;

export type SystemSettingKey = typeof SYSTEM_SETTING_KEYS[keyof typeof SYSTEM_SETTING_KEYS];

export interface SystemSettingDefinition {
  category: "PAYMENTS" | "AVAILABILITY" | "PAYMENT_METHODS" | "NIUBIZ_CHECKOUT" | "NOTIFICATIONS";
  dataType: ConfigDataType;
  description: string;
  min?: string;
}

export const SYSTEM_SETTING_DEFINITIONS: Record<SystemSettingKey, SystemSettingDefinition> = {
  PAYMENT_REGISTRATION_PRICE: { category: "PAYMENTS", dataType: ConfigDataType.MONEY, description: "Precio de inscripción vigente.", min: "0.01" },
  PAYMENT_MONTHLY_FEE: { category: "PAYMENTS", dataType: ConfigDataType.MONEY, description: "Cuota mensual vigente.", min: "0" },
  PAYMENTS_ENABLED: { category: "PAYMENTS", dataType: ConfigDataType.BOOLEAN, description: "Habilita el inicio de pagos." },
  PAYMENT_START_AT: { category: "AVAILABILITY", dataType: ConfigDataType.DATETIME, description: "Inicio de la ventana de pagos." },
  PAYMENT_END_AT: { category: "AVAILABILITY", dataType: ConfigDataType.DATETIME, description: "Fin exclusivo de la ventana de pagos." },
  CARD_ENABLED: { category: "PAYMENT_METHODS", dataType: ConfigDataType.BOOLEAN, description: "Habilita pagos con tarjeta." },
  YAPE_ENABLED: { category: "PAYMENT_METHODS", dataType: ConfigDataType.BOOLEAN, description: "Habilita pagos mediante Yape." },
  NIUBIZ_MERCHANT_NAME: { category: "NIUBIZ_CHECKOUT", dataType: ConfigDataType.STRING, description: "Nombre público mostrado en el Checkout." },
  NIUBIZ_CHECKOUT_LOGO_URL: { category: "NIUBIZ_CHECKOUT", dataType: ConfigDataType.URL, description: "URL pública del logo para Checkout." },
  NIUBIZ_FORM_BUTTON_COLOR: { category: "NIUBIZ_CHECKOUT", dataType: ConfigDataType.STRING, description: "Color hexadecimal del botón de Checkout." },
  NIUBIZ_SESSION_EXPIRATION_MINUTES: { category: "NIUBIZ_CHECKOUT", dataType: ConfigDataType.INTEGER, description: "Duración de la sesión de Checkout en minutos.", min: "1" },
  PAYMENT_CONFIRMATION_EMAIL_ENABLED: { category: "NOTIFICATIONS", dataType: ConfigDataType.BOOLEAN, description: "Habilita el correo de confirmación de pago." },
  PAYMENT_CONFIRMATION_EMAIL_SUBJECT: { category: "NOTIFICATIONS", dataType: ConfigDataType.STRING, description: "Asunto del correo de confirmación de pago." },
};
