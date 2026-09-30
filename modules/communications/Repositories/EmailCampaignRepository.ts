import { EmailSendStatus, type PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { EmailCampaignSummary } from "../Models/EmailCampaign";

export class EmailCampaignRepository {
  constructor(private readonly db: PrismaClient = prisma) {}

  async countCampaigns(): Promise<number> {
    return this.db.emailCampaign.count();
  }

  async countRecipients(): Promise<number> {
    return this.db.emailRecipient.count();
  }

  async countDeliveriesByStatus(status: EmailSendStatus): Promise<number> {
    return this.db.emailDelivery.count({ where: { status } });
  }

  async listRecent(limit: number): Promise<EmailCampaignSummary[]> {
    const rows = await this.db.emailCampaign.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
      select: { id: true, name: true, subject: true, status: true, createdAt: true, updatedAt: true },
    });
    return rows.map((row) => ({
      ...row,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    }));
  }
}
