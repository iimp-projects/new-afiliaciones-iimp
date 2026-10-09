import type { EmailSmtpAccount } from "@prisma/client";

/**
 * Cuota diaria de envío por cuenta SMTP (protección transaccional).
 *
 * La cuenta DEFAULT comparte la misma cuenta Google Workspace con las
 * notificaciones transaccionales (recuperación de contraseña, activación,
 * avales, postulaciones y pagos). Para no agotar la cuota real del proveedor
 * (que no es observable desde esta aplicación), se aplica un presupuesto diario
 * conservador a las CAMPAÑAS y se reserva un margen fijo para los correos
 * transaccionales.
 *
 * Todos los valores son configurables por variables de entorno y NO prometen
 * capacidad por encima de los límites reales del proveedor.
 */

function intEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === "") return fallback;
  const value = Number(raw);
  return Number.isInteger(value) && value >= 0 ? value : fallback;
}

/**
 * Presupuesto diario de envío disponible para CAMPAÑAS de una cuenta.
 *
 * - DEFAULT: `SMTP_DEFAULT_DAILY_LIMIT` (cuota total diaria del buzón) menos
 *   `SMTP_DEFAULT_TRANSACTIONAL_RESERVE` (margen reservado para transaccionales).
 * - PROV: `SMTP_PROV_DAILY_LIMIT`; si es 0 o no está definido, sin límite
 *   (cuenta dedicada de campañas, sin compartición transaccional).
 *
 * Devuelve `null` cuando no hay límite finito.
 */
export function getSmtpDailyCampaignLimit(account: EmailSmtpAccount): number | null {
  if (account === "DEFAULT") {
    const total = intEnv("SMTP_DEFAULT_DAILY_LIMIT", 2000);
    const reserve = intEnv("SMTP_DEFAULT_TRANSACTIONAL_RESERVE", 500);
    return Math.max(0, total - reserve);
  }
  const prov = intEnv("SMTP_PROV_DAILY_LIMIT", 0);
  return prov > 0 ? prov : null;
}
