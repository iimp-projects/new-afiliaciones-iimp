import type { EmailSmtpAccount } from "@prisma/client";
import { getSmtpConfig, type SmtpAccount } from "@/lib/config/env";
import { getSmtpDailyCampaignLimit } from "./smtpQuota";

/**
 * Cuentas SMTP disponibles para una campaña de Correos Masivos.
 *
 * - `DEFAULT` usa el prefijo `SMTP_*` (correo institucional). Comparte capacidad
 *   con las notificaciones transaccionales (recuperación, activación, avales,
 *   pagos), por lo que debe usarse con límites conservadores.
 * - `PROV` usa el prefijo `PROV_MAIL_*` (correo de campañas/proveedores). Es la
 *   cuenta histórica de Correos Masivos y se mantiene como valor por defecto.
 *
 * Este módulo es server-only: expone solo metadatos (nombre/remitente) y nunca
 * credenciales.
 */

export const SMTP_ACCOUNT_VALUES: readonly EmailSmtpAccount[] = ["DEFAULT", "PROV"] as const;

/** Normaliza un valor externo (formulario/cliente) contra la allow-list. */
export function normalizeSmtpAccount(value: unknown): EmailSmtpAccount {
  return value === "DEFAULT" ? "DEFAULT" : "PROV";
}

/** Convierte la cuenta persistida al tipo usado por `MailService`. */
export function toMailServiceAccount(account: EmailSmtpAccount): SmtpAccount {
  return account === "DEFAULT" ? "DEFAULT" : "PROV";
}

/** Resuelve el remitente efectivo (From) de una cuenta desde la configuración. */
export function resolveSmtpAccountEmail(account: EmailSmtpAccount): string | null {
  try {
    return getSmtpConfig(process.env, toMailServiceAccount(account)).from;
  } catch {
    return null;
  }
}

export interface SmtpAccountOption {
  value: EmailSmtpAccount;
  label: string;
  description: string;
  email: string | null;
  sharesTransactionalCapacity: boolean;
  maxRecipients: number;
  dailyCampaignLimit: number | null;
}

const SMTP_ACCOUNT_METADATA: Record<EmailSmtpAccount, { label: string; description: string; sharesTransactionalCapacity: boolean }> = {
  DEFAULT: {
    label: "Asociados IIMP",
    description: "Correo institucional (asociados@iimp.org.pe). Comparte capacidad con notificaciones transaccionales.",
    sharesTransactionalCapacity: true,
  },
  PROV: {
    label: "Correo de campañas",
    description: "Cuenta institucional de campañas y proveedores.",
    sharesTransactionalCapacity: false,
  },
};

/** Opciones de cuenta para la UI y validación server-side. No expone credenciales. */
export function getSmtpAccountOptions(): SmtpAccountOption[] {
  return SMTP_ACCOUNT_VALUES.map((value) => ({
    value,
    label: SMTP_ACCOUNT_METADATA[value].label,
    description: SMTP_ACCOUNT_METADATA[value].description,
    email: resolveSmtpAccountEmail(value),
    sharesTransactionalCapacity: SMTP_ACCOUNT_METADATA[value].sharesTransactionalCapacity,
    maxRecipients: CAMPAIGN_MAX_RECIPIENTS_BY_ACCOUNT[toMailServiceAccount(value)],
    dailyCampaignLimit: getSmtpDailyCampaignLimit(value),
  }));
}

// ---------------------------------------------------------------------------
// Protección de correos transaccionales (FASE 5)
// ---------------------------------------------------------------------------

function intEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === "") return fallback;
  const value = Number(raw);
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

/**
 * Máximo de destinatarios por campaña según cuenta SMTP. Valores conservadores
 * ajustables por entorno. Este límite corresponde a destinatarios REGISTRADOS en
 * una campaña, NO a mensajes enviados diariamente. La protección diaria de la
 * cuenta DEFAULT se gestiona por separado (ver `smtpQuota.ts`).
 */
export const CAMPAIGN_MAX_RECIPIENTS_BY_ACCOUNT: Record<SmtpAccount, number> = {
  DEFAULT: intEnv("CAMPAIGN_DEFAULT_MAX_RECIPIENTS", 5000),
  PROV: intEnv("CAMPAIGN_PROV_MAX_RECIPIENTS", 5000),
};

/** Límite de destinatarios por campaña para la cuenta indicada. */
export function getCampaignMaxRecipients(account: EmailSmtpAccount): number {
  return CAMPAIGN_MAX_RECIPIENTS_BY_ACCOUNT[toMailServiceAccount(account)];
}
