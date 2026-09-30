import { EmailCampaignStatus, EmailSendStatus, Prisma, type PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { CampaignDetail, CampaignInput, CampaignListItem, CampaignRecipientPreview } from "../Models/Campaign";

export class CampaignRepository {
  constructor(private readonly db: PrismaClient = prisma) {}

  async listCampaigns(): Promise<CampaignListItem[]> {
    const rows = await this.db.emailCampaign.findMany({
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { recipients: true } } },
    });
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      subject: row.subject,
      status: row.status,
      recipientCount: row._count.recipients,
      createdAt: row.createdAt.toISOString(),
    }));
  }

  async getCampaign(id: number): Promise<CampaignDetail | null> {
    const row = await this.db.emailCampaign.findUnique({
      where: { id },
      include: {
        _count: { select: { recipients: true } },
        creator: { select: { person: { select: { firstName: true, paternalLastName: true } } } },
      },
    });
    if (!row) return null;
    return {
      id: row.id,
      name: row.name,
      subject: row.subject,
      senderName: row.senderName,
      senderEmail: row.senderEmail,
      replyTo: row.replyTo,
      htmlContent: row.htmlContent,
      textContent: row.textContent,
      status: row.status,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      createdBy: row.createdBy,
      createdByName: row.creator?.person ? [row.creator.person.firstName, row.creator.person.paternalLastName].filter(Boolean).join(" ") : null,
      recipientCount: row._count.recipients,
    };
  }

  async createCampaign(data: CampaignInput, actorId: number): Promise<{ id: number }> {
    const row = await this.db.emailCampaign.create({
      data: {
        name: data.name.trim(),
        subject: data.subject.trim(),
        senderName: data.senderName?.trim() || null,
        senderEmail: data.senderEmail?.trim() || null,
        replyTo: data.replyTo?.trim() || null,
        htmlContent: data.htmlContent,
        textContent: data.textContent?.trim() || null,
        status: EmailCampaignStatus.DRAFT,
        createdBy: actorId,
      },
      select: { id: true },
    });
    return { id: row.id };
  }

  async updateCampaign(id: number, data: CampaignInput): Promise<void> {
    await this.db.emailCampaign.update({
      where: { id },
      data: {
        name: data.name.trim(),
        subject: data.subject.trim(),
        senderName: data.senderName?.trim() || null,
        senderEmail: data.senderEmail?.trim() || null,
        replyTo: data.replyTo?.trim() || null,
        htmlContent: data.htmlContent,
        textContent: data.textContent?.trim() || null,
      },
    });
  }

  async setStatus(id: number, status: EmailCampaignStatus): Promise<void> {
    await this.db.emailCampaign.update({ where: { id }, data: { status } });
  }

  /** Reclama atómicamente la campaña desde `fromStatus` hacia SENDING. Devuelve true solo si se reclamó. */
  async claimCampaignSending(id: number, fromStatus: EmailCampaignStatus): Promise<boolean> {
    const result = await this.db.emailCampaign.updateMany({
      where: { id, status: fromStatus },
      data: { status: EmailCampaignStatus.SENDING },
    });
    return result.count === 1;
  }

  /** Finaliza una campaña en SENDING hacia un estado terminal. Devuelve true solo si realizó la transición. */
  async finalizeCampaign(id: number, status: EmailCampaignStatus): Promise<boolean> {
    const result = await this.db.emailCampaign.updateMany({
      where: { id, status: EmailCampaignStatus.SENDING },
      data: { status },
    });
    return result.count === 1;
  }

  /** Heartbeat: reafirma SENDING y actualiza `updated_at` (señal de actividad del lote). */
  async touchCampaign(id: number): Promise<void> {
    await this.db.emailCampaign.update({ where: { id }, data: { status: EmailCampaignStatus.SENDING } });
  }

  async getSelectionData(): Promise<{
    lists: Array<{ id: number; name: string; memberCount: number }>;
    recipients: Array<{ id: number; email: string; name: string | null; company: string | null; listIds: number[]; listNames: string[] }>;
  }> {
    const lists = await this.db.emailRecipientList.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { members: true } } },
    });
    const recipients = await this.db.emailRecipient.findMany({
      orderBy: { email: "asc" },
      include: { listMembers: { include: { list: { select: { id: true, name: true } } } } },
    });
    return {
      lists: lists.map((list) => ({ id: list.id, name: list.name, memberCount: list._count.members })),
      recipients: recipients.map((recipient) => ({
        id: recipient.id,
        email: recipient.email,
        name: recipient.name,
        company: recipient.company,
        listIds: recipient.listMembers.map((member) => member.list.id),
        listNames: recipient.listMembers.map((member) => member.list.name),
      })),
    };
  }

  async getRecipientIdsByLists(listIds: number[]): Promise<number[]> {
    if (listIds.length === 0) return [];
    const rows = await this.db.emailRecipientListMember.findMany({
      where: { listId: { in: listIds } },
      select: { recipientId: true },
    });
    return rows.map((row) => row.recipientId);
  }

  async getCampaignRecipientIds(campaignId: number): Promise<number[]> {
    const rows = await this.db.emailCampaignRecipient.findMany({
      where: { campaignId },
      select: { recipientId: true },
    });
    return rows.map((row) => row.recipientId);
  }

  async getCampaignRecipientsForPreview(campaignId: number): Promise<CampaignRecipientPreview[]> {
    const rows = await this.db.emailCampaignRecipient.findMany({
      where: { campaignId },
      include: { recipient: { select: { id: true, email: true, name: true, company: true, position: true } } },
      orderBy: { recipient: { email: "asc" } },
    });
    return rows.map((row) => ({
      id: row.recipient.id,
      email: row.recipient.email,
      name: row.recipient.name,
      company: row.recipient.company,
      position: row.recipient.position,
    }));
  }

  async setCampaignRecipients(campaignId: number, recipientIds: number[], actor: { userId: number; email: string }, campaignName: string): Promise<{ count: number }> {
    const unique = Array.from(new Set(recipientIds));
    await this.db.$transaction(async (tx) => {
      await tx.emailCampaignRecipient.deleteMany({ where: { campaignId } });
      if (unique.length > 0) {
        await tx.emailCampaignRecipient.createMany({
          data: unique.map((recipientId) => ({ campaignId, recipientId, status: EmailSendStatus.PENDING })),
        });
      }
      await tx.auditLog.create({
        data: {
          userId: actor.userId,
          action: "CAMPAIGN_RECIPIENTS_UPDATED",
          entity: "EmailCampaign",
          entityId: String(campaignId),
          newValues: { campaignName, recipientCount: unique.length, actorEmail: actor.email } as Prisma.InputJsonValue,
        },
      });
    });
    return { count: unique.length };
  }

  async writeAudit(actor: { userId: number; email: string }, action: string, campaignId: number, campaignName: string, metadata: Record<string, unknown> = {}): Promise<void> {
    await this.db.auditLog.create({
      data: {
        userId: actor.userId,
        action,
        entity: "EmailCampaign",
        entityId: String(campaignId),
        newValues: { campaignName, actorEmail: actor.email, ...metadata } as Prisma.InputJsonValue,
      },
    });
  }
}
