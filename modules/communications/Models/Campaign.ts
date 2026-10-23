import type { EmailCampaignStatus } from "@prisma/client";
import type { SmtpAccount } from "@/lib/config/env";

export interface CampaignListItem {
  id: number;
  name: string;
  subject: string;
  status: EmailCampaignStatus;
  recipientCount: number;
  createdAt: string;
}

export interface CampaignDetail {
  id: number;
  name: string;
  subject: string;
  senderName: string | null;
  senderEmail: string | null;
  replyTo: string | null;
  htmlContent: string;
  textContent: string | null;
  status: EmailCampaignStatus;
  createdAt: string;
  updatedAt: string;
  createdBy: number | null;
  createdByName: string | null;
  recipientCount: number;
  /** Cuenta SMTP seleccionada para la campaña (DEFAULT = institucional). */
  smtpAccount: SmtpAccount;
  /** Pausa por cuota/rate-limit del proveedor (null = sin pausa). */
  pausedUntil: string | null;
  pauseReason: string | null;
}

export interface CampaignInput {
  name: string;
  subject: string;
  senderName?: string | null;
  senderEmail?: string | null;
  replyTo?: string | null;
  htmlContent: string;
  textContent?: string | null;
  /** Cuenta SMTP a usar para el envío (DEFAULT si se omite). */
  smtpAccount?: SmtpAccount;
}

export interface CampaignRecipientSelection {
  lists: Array<{ id: number; name: string; memberCount: number }>;
  recipients: Array<{ id: number; email: string; name: string | null; company: string | null; listIds: number[]; listNames: string[] }>;
  selectedRecipientIds: number[];
  uniqueSelectedCount: number;
}

export interface CampaignRecipientPreview {
  id: number;
  email: string;
  name: string | null;
  company: string | null;
  position: string | null;
  /** Variables del origen "Asociados del sistema" (snapshot), para previsualización. */
  nombreCompleto?: string | null;
  correoAcceso?: string | null;
  tipoAsociado?: string | null;
  enlaceAcceso?: string | null;
  enlaceActivacion?: string | null;
}

/** Etiqueta legible de cada cuenta SMTP (usada en selector y vista previa). */
export const SMTP_ACCOUNT_LABEL: Record<SmtpAccount, string> = {
  DEFAULT: "DEFAULT — Correo institucional",
  PROV: "PROV — Correo alternativo",
};
