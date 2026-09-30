import { EmailSendStatus, type Prisma, type PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const DELIVERY_STALE_TIMEOUT_MINUTES = 10;
export const STALE_DELIVERY_ERROR_MESSAGE = "Envío interrumpido (timeout)";

export interface CampaignRecipientView {
  recipientId: number;
  email: string;
  name: string | null;
  company: string | null;
  position: string | null;
  status: EmailSendStatus;
  sendCount: number;
  lastSentAt: string | null;
}

export interface DeliveryView {
  id: number;
  attemptNumber: number;
  status: EmailSendStatus;
  email: string;
  messageId: string | null;
  errorMessage: string | null;
  sentAt: string | null;
  createdAt: string;
}

export interface CampaignSendStats {
  recipients: number;
  sent: number;
  pending: number;
  sending: number;
  error: number;
}

export interface PendingRecipient {
  recipientId: number;
  email: string;
  name: string | null;
  company: string | null;
  position: string | null;
}

export class EmailDeliveryRepository {
  constructor(private readonly db: PrismaClient = prisma) {}

  async getCampaignRecipient(campaignId: number, recipientId: number): Promise<{ recipientId: number; status: EmailSendStatus; sendCount: number } | null> {
    const row = await this.db.emailCampaignRecipient.findUnique({
      where: { campaignId_recipientId: { campaignId, recipientId } },
      select: { recipientId: true, status: true, sendCount: true },
    });
    return row;
  }

  async getRecipient(recipientId: number): Promise<{ id: number; email: string; name: string | null; company: string | null; position: string | null } | null> {
    return this.db.emailRecipient.findUnique({
      where: { id: recipientId },
      select: { id: true, email: true, name: true, company: true, position: true },
    });
  }

  async hasInFlightDelivery(campaignId: number, recipientId: number): Promise<boolean> {
    const count = await this.db.emailDelivery.count({
      where: { campaignId, recipientId, status: { in: [EmailSendStatus.PENDING, EmailSendStatus.SENDING] } },
    });
    return count > 0;
  }

  async recoverStaleDeliveries(campaignId: number, recipientId: number): Promise<number> {
    const cutoff = new Date(Date.now() - DELIVERY_STALE_TIMEOUT_MINUTES * 60_000);
    const result = await this.db.emailDelivery.updateMany({
      where: {
        campaignId,
        recipientId,
        status: { in: [EmailSendStatus.PENDING, EmailSendStatus.SENDING] },
        createdAt: { lt: cutoff },
      },
      data: { status: EmailSendStatus.ERROR, errorMessage: STALE_DELIVERY_ERROR_MESSAGE },
    });
    if (result.count > 0) {
      await this.db.emailCampaignRecipient.updateMany({
        where: { campaignId, recipientId },
        data: { status: EmailSendStatus.ERROR },
      });
    }
    return result.count;
  }

  async createPendingDelivery(campaignId: number, recipientId: number, email: string): Promise<{ id: number; attemptNumber: number }> {
    const aggregate = await this.db.emailDelivery.aggregate({
      where: { campaignId, recipientId },
      _max: { attemptNumber: true },
    });
    const attemptNumber = (aggregate._max.attemptNumber ?? 0) + 1;
    const created = await this.db.emailDelivery.create({
      data: { campaignId, recipientId, email, status: EmailSendStatus.PENDING, attemptNumber },
      select: { id: true, attemptNumber: true },
    });
    return created;
  }

  async markDeliverySent(id: number, messageId: string | undefined): Promise<void> {
    await this.db.emailDelivery.update({
      where: { id },
      data: { status: EmailSendStatus.SENT, messageId: messageId ?? null, sentAt: new Date(), errorMessage: null },
    });
  }

  async markDeliveryError(id: number, errorMessage: string): Promise<void> {
    await this.db.emailDelivery.update({
      where: { id },
      data: { status: EmailSendStatus.ERROR, errorMessage },
    });
  }

  async markRecipientSending(campaignId: number, recipientId: number): Promise<void> {
    await this.db.emailCampaignRecipient.update({
      where: { campaignId_recipientId: { campaignId, recipientId } },
      data: { status: EmailSendStatus.SENDING },
    });
  }

  async markRecipientSent(campaignId: number, recipientId: number): Promise<void> {
    await this.db.emailCampaignRecipient.update({
      where: { campaignId_recipientId: { campaignId, recipientId } },
      data: { status: EmailSendStatus.SENT, sendCount: { increment: 1 }, lastSentAt: new Date() },
    });
  }

  async markRecipientError(campaignId: number, recipientId: number): Promise<void> {
    await this.db.emailCampaignRecipient.update({
      where: { campaignId_recipientId: { campaignId, recipientId } },
      data: { status: EmailSendStatus.ERROR },
    });
  }

  async listDeliveries(campaignId: number, recipientId: number): Promise<DeliveryView[]> {
    const rows = await this.db.emailDelivery.findMany({
      where: { campaignId, recipientId },
      orderBy: { attemptNumber: "desc" },
    });
    return rows.map((row) => ({
      id: row.id,
      attemptNumber: row.attemptNumber,
      status: row.status,
      email: row.email,
      messageId: row.messageId,
      errorMessage: row.errorMessage,
      sentAt: row.sentAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
    }));
  }

  async getCampaignRecipientsForWorkspace(campaignId: number): Promise<CampaignRecipientView[]> {
    const rows = await this.db.emailCampaignRecipient.findMany({
      where: { campaignId },
      include: { recipient: { select: { id: true, email: true, name: true, company: true, position: true } } },
      orderBy: { recipient: { email: "asc" } },
    });
    return rows.map((row) => ({
      recipientId: row.recipientId,
      email: row.recipient.email,
      name: row.recipient.name,
      company: row.recipient.company,
      position: row.recipient.position,
      status: row.status,
      sendCount: row.sendCount,
      lastSentAt: row.lastSentAt?.toISOString() ?? null,
    }));
  }

  async getCampaignStats(campaignId: number): Promise<CampaignSendStats> {
    const [recipients, sent, pending, sending, error] = await Promise.all([
      this.db.emailCampaignRecipient.count({ where: { campaignId } }),
      this.db.emailCampaignRecipient.count({ where: { campaignId, status: EmailSendStatus.SENT } }),
      this.db.emailCampaignRecipient.count({ where: { campaignId, status: EmailSendStatus.PENDING } }),
      this.db.emailCampaignRecipient.count({ where: { campaignId, status: EmailSendStatus.SENDING } }),
      this.db.emailCampaignRecipient.count({ where: { campaignId, status: EmailSendStatus.ERROR } }),
    ]);
    return { recipients, sent, pending, sending, error };
  }

  /** Recupera en bloque todas las entregas PENDING/SENDING obsoletas de una campaña y marca sus destinatarios como ERROR. */
  async recoverStaleDeliveriesForCampaign(campaignId: number): Promise<number> {
    const cutoff = new Date(Date.now() - DELIVERY_STALE_TIMEOUT_MINUTES * 60_000);
    const staleRecipients = await this.db.emailDelivery.findMany({
      where: { campaignId, status: { in: [EmailSendStatus.PENDING, EmailSendStatus.SENDING] }, createdAt: { lt: cutoff } },
      select: { recipientId: true },
      distinct: ["recipientId"],
    });
    const recipientIds = staleRecipients.map((row) => row.recipientId).filter((id): id is number => id != null);
    if (recipientIds.length > 0) {
      await this.db.emailCampaignRecipient.updateMany({
        where: { campaignId, recipientId: { in: recipientIds } },
        data: { status: EmailSendStatus.ERROR },
      });
    }
    const result = await this.db.emailDelivery.updateMany({
      where: { campaignId, status: { in: [EmailSendStatus.PENDING, EmailSendStatus.SENDING] }, createdAt: { lt: cutoff } },
      data: { status: EmailSendStatus.ERROR, errorMessage: STALE_DELIVERY_ERROR_MESSAGE },
    });
    return result.count;
  }

  async listPendingRecipients(campaignId: number, limit: number): Promise<PendingRecipient[]> {
    const rows = await this.db.emailCampaignRecipient.findMany({
      where: { campaignId, status: EmailSendStatus.PENDING },
      include: { recipient: { select: { id: true, email: true, name: true, company: true, position: true } } },
      orderBy: { recipientId: "asc" },
      take: limit,
    });
    return rows.map((row) => ({
      recipientId: row.recipientId,
      email: row.recipient.email,
      name: row.recipient.name,
      company: row.recipient.company,
      position: row.recipient.position,
    }));
  }

  async resetErrorRecipientsToPending(campaignId: number): Promise<number> {
    const result = await this.db.emailCampaignRecipient.updateMany({
      where: { campaignId, status: EmailSendStatus.ERROR },
      data: { status: EmailSendStatus.PENDING },
    });
    return result.count;
  }

  async writeAudit(actor: { userId: number; email: string }, action: string, metadata: Record<string, unknown>): Promise<void> {
    await this.db.auditLog.create({
      data: {
        userId: actor.userId,
        action,
        entity: "EmailCampaign",
        entityId: typeof metadata.campaignId === "number" ? String(metadata.campaignId) : undefined,
        newValues: { actorEmail: actor.email, ...metadata } as Prisma.InputJsonValue,
      },
    });
  }
}
