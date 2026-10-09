import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/** Fecha UTC del día actual en formato `YYYY-MM-DD` (clave estable de cuota). */
export function utcDay(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Persistencia del contador diario de envíos por cuenta SMTP.
 *
 * La reserva es ATÓMICA: un único `UPDATE ... WHERE sent_count < limit` bajo
 * bloqueo de fila garantiza que, incluso con campañas concurrentes, nunca se
 * exceda el límite (protección frente a condiciones de carrera).
 */
export class SmtpQuotaRepository {
  constructor(private readonly db: PrismaClient = prisma) {}

  async tryReserve(account: string, limit: number): Promise<{ allowed: boolean; used: number }> {
    const day = utcDay();
    return this.db.$transaction(async (tx) => {
      await tx.$executeRaw`
        INSERT INTO smtp_daily_quotas (account, day, sent_count)
        VALUES (${account}, ${day}, 0)
        ON CONFLICT (account, day) DO NOTHING
      `;
      const updated = await tx.$executeRaw`
        UPDATE smtp_daily_quotas
        SET sent_count = sent_count + 1, updated_at = now()
        WHERE account = ${account} AND day = ${day} AND sent_count < ${limit}
      `;
      const row = await tx.smtpDailyQuota.findUnique({ where: { account_day: { account, day } } });
      return { allowed: updated === 1, used: row?.sentCount ?? 0 };
    });
  }

  async getUsed(account: string): Promise<number> {
    const day = utcDay();
    const row = await this.db.smtpDailyQuota.findUnique({ where: { account_day: { account, day } } });
    return row?.sentCount ?? 0;
  }
}
