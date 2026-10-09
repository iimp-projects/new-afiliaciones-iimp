import type { EmailSmtpAccount } from "@prisma/client";
import { getSmtpDailyCampaignLimit } from "../Config/smtpQuota";
import { SmtpQuotaRepository } from "../Repositories/SmtpQuotaRepository";

export interface QuotaReservation {
  allowed: boolean;
  used: number;
}

/**
 * Cuota diaria de envío de campañas por cuenta SMTP.
 *
 * Aísla la lógica de límites para que `CampaignMailService` y
 * `CampaignSendService` puedan inyectar una implementación de prueba.
 */
export class SmtpQuotaService {
  constructor(private readonly repository = new SmtpQuotaRepository()) {}

  /** Límite diario finito de la cuenta, o `null` si no aplica. */
  getLimit(account: EmailSmtpAccount): number | null {
    return getSmtpDailyCampaignLimit(account);
  }

  /** Reserva atómicamente una unidad de cuota. Sin límite → siempre permitido. */
  async tryReserve(account: EmailSmtpAccount): Promise<QuotaReservation> {
    const limit = this.getLimit(account);
    if (limit === null) return { allowed: true, used: 0 };
    return this.repository.tryReserve(account, limit);
  }

  async getUsed(account: EmailSmtpAccount): Promise<number> {
    return this.repository.getUsed(account);
  }
}
