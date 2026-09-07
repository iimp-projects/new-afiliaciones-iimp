export interface SystemSettingValueViewModel {
  id: number;
  value: string;
  startsAt: string;
  endsAt: string | null;
  isActive: boolean;
}

export interface SystemSettingViewModel {
  key: string;
  category: string;
  dataType: "STRING" | "INTEGER" | "DECIMAL" | "BOOLEAN" | "JSON" | "DATETIME" | "MONEY" | "URL";
  description: string | null;
  isActive: boolean;
  currentValue: string | null;
  currentValueId: number | null;
  currentStartsAt: string | null;
  currentEndsAt: string | null;
  hasCurrentValue: boolean;
  futureValues: SystemSettingValueViewModel[];
  historicalValues: SystemSettingValueViewModel[];
  inactiveValues: SystemSettingValueViewModel[];
}

export const SETTING_PRESENTATION: Record<string, { title: string; description: string }> = {
  PAYMENT_REGISTRATION_PRICE: { title: "Precio de inscripción", description: "Monto aplicable a nuevas postulaciones." },
  PAYMENT_MONTHLY_FEE: { title: "Precio de mensualidad", description: "Cuota mensual vigente." },
  PAYMENTS_ENABLED: { title: "Pagos habilitados", description: "Permite iniciar pagos desde la consulta." },
  PAYMENT_START_AT: { title: "Inicio", description: "Inicio de la ventana de pagos." },
  PAYMENT_END_AT: { title: "Fin", description: "Fin exclusivo de la ventana de pagos." },
  CARD_ENABLED: { title: "Tarjetas", description: "Disponibilidad de pagos con tarjeta." },
  YAPE_ENABLED: { title: "Yape", description: "Próximamente: sin integración operativa." },
  NIUBIZ_MERCHANT_NAME: { title: "Nombre mostrado", description: "Nombre visible al momento de pagar." },
  NIUBIZ_CHECKOUT_LOGO_URL: { title: "Logo del pago", description: "Imagen pública mostrada en la ventana de pago." },
  NIUBIZ_FORM_BUTTON_COLOR: { title: "Color principal", description: "Color del botón de pago." },
  NIUBIZ_SESSION_EXPIRATION_MINUTES: { title: "Tiempo para completar el pago", description: "Tiempo disponible antes de que expire la sesión." },
  PAYMENT_CONFIRMATION_EMAIL_ENABLED: { title: "Confirmación por correo", description: "Envía una confirmación cuando el pago sea aprobado." },
  PAYMENT_CONFIRMATION_EMAIL_SUBJECT: { title: "Mensaje de confirmación", description: "Asunto del correo de confirmación." },
};

export const CATEGORY_PRESENTATION: Record<string, { title: string; description: string }> = {
  PAYMENTS: { title: "Precios", description: "Importes y estado general de los pagos." },
  AVAILABILITY: { title: "Disponibilidad", description: "Ventana temporal de pagos." },
  PAYMENT_METHODS: { title: "Métodos de pago", description: "Canales disponibles para el postulante." },
  NIUBIZ_CHECKOUT: { title: "Personalización del Checkout", description: "Datos públicos de la experiencia Niubiz." },
  NOTIFICATIONS: { title: "Notificaciones", description: "Confirmaciones posteriores al pago." },
};

export function groupSettings(settings: SystemSettingViewModel[]) {
  return settings.reduce<Record<string, SystemSettingViewModel[]>>((groups, setting) => {
    (groups[setting.category] ??= []).push(setting);
    return groups;
  }, {});
}

export function getValueState(setting: SystemSettingViewModel) {
  if (!setting.isActive || (setting.key === "PAYMENTS_ENABLED" && setting.currentValue === "false")) return "Deshabilitado";
  if (setting.hasCurrentValue) return "Activo";
  if (setting.futureValues.length > 0) return "Programado";
  return "Sin configurar";
}
