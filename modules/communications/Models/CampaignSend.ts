import type { EmailCampaignStatus } from "@prisma/client";

/** Progreso observable de una campaña de envío masivo. */
export interface CampaignSendProgress {
  campaignId: number;
  status: EmailCampaignStatus;
  total: number;
  sent: number;
  sending: number;
  pending: number;
  error: number;
  /** Enviados + errores (destinatarios ya resueltos). */
  processed: number;
  /** 0-100, redondeado. */
  percent: number;
  /** true cuando el estado es terminal (COMPLETED / PARTIAL / CANCELLED). */
  done: boolean;
}

/** Resultado de procesar un lote. */
export interface BatchResult {
  progress: CampaignSendProgress;
  /** Destinatarios procesados en esta invocación. */
  processedThisBatch: number;
  /** true si la campaña quedó en un estado terminal tras este lote. */
  finished: boolean;
}
