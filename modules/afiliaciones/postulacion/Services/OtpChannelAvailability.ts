import { getSmtpConfig, getWhatsAppConfig, type EnvSource } from "@/lib/config/env";
import type { OtpChannelAvailability } from "@/modules/shared/Models/Verification";

/**
 * Resuelve la disponibilidad local de cada canal OTP combinando el feature flag
 * explícito con la configuración real del proveedor.
 *
 * No realiza llamadas externas (Meta/SMTP/SNS): solo valida que la configuración
 * esté completa para no ofrecer canales que sabemos localmente que no operan.
 */
function flag(env: EnvSource, name: string, fallback: boolean): boolean {
  const value = env[name];
  if (value === undefined || value === "") return fallback;
  return value === "true" || value === "1";
}

function isConfigured(probe: () => void): boolean {
  try {
    probe();
    return true;
  } catch {
    return false;
  }
}

export function resolveOtpChannelAvailability(env: EnvSource = process.env): OtpChannelAvailability {
  const whatsappConfigured = isConfigured(() => {
    getWhatsAppConfig(env);
  });
  const emailConfigured = isConfigured(() => {
    getSmtpConfig(env);
  });

  return {
    WHATSAPP: flag(env, "OTP_WHATSAPP_ENABLED", true) && whatsappConfigured,
    EMAIL: flag(env, "OTP_EMAIL_ENABLED", true) && emailConfigured,
    // SMS uses the AWS default credential chain (instance role); there is no
    // application-level configuration to probe, so it is controlled by the flag.
    SMS: flag(env, "OTP_SMS_ENABLED", true),
  };
}
