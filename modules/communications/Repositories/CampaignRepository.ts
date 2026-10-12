import { EmailCampaignStatus, EmailSendStatus, Prisma, type PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAppBaseUrl } from "@/lib/config/env";
import type { CampaignDetail, CampaignInput, CampaignListItem, CampaignRecipientPreview } from "../Models/Campaign";
import { buildAssociateMetadata, personFullName, toAssociateRecipientLink } from "../Models/AssociateRecipient";
import type { AssociateIdentity, AssociateRecipientMetadata } from "../Models/AssociateRecipient";

function isAssociateMetadataValue(value: Prisma.JsonValue | null | undefined): AssociateRecipientMetadata | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (record.source !== "associates" || typeof record.userId !== "number") return null;
  return record as unknown as AssociateRecipientMetadata;
}

function previewAccessUrl(): string {
  try {
    return `${getAppBaseUrl(process.env, { allowDevDefault: true })}/login`;
  } catch {
    return "";
  }
}

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
      pausedUntil: row.pausedUntil?.toISOString() ?? null,
      pauseReason: row.pauseReason,
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

  /** Pausa una campaña (mantiene SENDING) con motivo y momento de reanudación. */
  async pauseCampaign(id: number, until: Date, reason: string): Promise<void> {
    await this.db.emailCampaign.update({
      where: { id },
      data: { pausedUntil: until, pauseReason: reason },
    });
  }

  /** Limpia la pausa (reanudación). */
  async clearPause(id: number): Promise<void> {
    await this.db.emailCampaign.update({
      where: { id },
      data: { pausedUntil: null, pauseReason: null },
    });
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
    return rows.map((row) => {
      const meta = isAssociateMetadataValue(row.metadata);
      return {
        id: row.recipient.id,
        email: row.recipient.email,
        name: row.recipient.name,
        company: row.recipient.company,
        position: row.recipient.position,
        nombreCompleto: meta?.nombreCompleto ?? null,
        correoAcceso: meta?.correoAcceso ?? null,
        tipoAsociado: meta ? (meta.tipoAsociado === "ESTUDIANTE" ? "Asociado Estudiante" : "Asociado Activo") : null,
        enlaceAcceso: meta ? previewAccessUrl() : null,
        enlaceActivacion: null,
      };
    });
  }

  async setCampaignRecipients(campaignId: number, recipientIds: number[], actor: { userId: number; email: string }, campaignName: string): Promise<{ count: number }> {
    const unique = Array.from(new Set(recipientIds));
    await this.db.$transaction(async (tx) => {
      await tx.emailCampaignRecipient.deleteMany({ where: { campaignId } });
      if (unique.length > 0) {
        const recipients = await tx.emailRecipient.findMany({
          where: { id: { in: unique } },
          select: { id: true, metadata: true },
        });
        const linkByRecipientId = new Map<number, { userId: number } | null>();
        const userIds = new Set<number>();
        for (const recipient of recipients) {
          const link = toAssociateRecipientLink(recipient.metadata);
          linkByRecipientId.set(recipient.id, link);
          if (link) userIds.add(link.userId);
        }

        const identities = userIds.size > 0 ? await this.loadAssociateIdentities(tx, Array.from(userIds)) : new Map<number, AssociateIdentity>();

        const rows = unique.map((recipientId) => {
          const link = linkByRecipientId.get(recipientId);
          const snapshot = link ? buildAssociateMetadata(identities.get(link.userId)) : null;
          return {
            campaignId,
            recipientId,
            status: EmailSendStatus.PENDING,
            metadata: snapshot ? (snapshot as unknown as Prisma.InputJsonValue) : Prisma.DbNull,
          };
        });

        await tx.emailCampaignRecipient.createMany({ data: rows });
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

  /** Resuelve identidades de asociado para un conjunto de userIds (para reconstruir el snapshot al seleccionar manualmente). */
  private async loadAssociateIdentities(tx: Prisma.TransactionClient, userIds: number[]): Promise<Map<number, AssociateIdentity>> {
    const users = await tx.user.findMany({
      where: { id: { in: userIds } },
      select: {
        id: true,
        email: true,
        status: true,
        role: { select: { slug: true } },
        person: { select: { id: true, firstName: true, paternalLastName: true, maternalLastName: true, documentNumber: true } },
      },
    });
    const map = new Map<number, AssociateIdentity>();
    for (const user of users) {
      map.set(user.id, {
        userId: user.id,
        personId: user.person?.id ?? null,
        email: user.email,
        status: user.status,
        roleSlug: user.role?.slug ?? null,
        nombreCompleto: personFullName(user.person?.firstName, user.person?.paternalLastName, user.person?.maternalLastName),
        documentNumber: user.person?.documentNumber ?? null,
      });
    }
    return map;
  }

  /**
   * Materializa destinatarios de campaña a partir del origen "Asociados del
   * sistema". Crea/vincula EmailRecipient por correo de acceso y reemplaza los
   * destinatarios de la campaña con un snapshot (metadata) por destinatario.
   */
  async setCampaignRecipientsFromAssociates(
    campaignId: number,
    recipients: AssociateRecipientMetadata[],
    actor: { userId: number; email: string },
    campaignName: string,
  ): Promise<{ count: number }> {
    await this.db.$transaction(async (tx) => {
      const emails = recipients.map((item) => item.correoAcceso);
      const existing = await tx.emailRecipient.findMany({ where: { email: { in: emails } }, select: { id: true, email: true } });
      const existingByEmail = new Map(existing.map((row) => [row.email, row.id]));

      const missing = recipients.filter((item) => !existingByEmail.has(item.correoAcceso));
      if (missing.length > 0) {
        await tx.emailRecipient.createMany({
          data: missing.map((item) => ({
            email: item.correoAcceso,
            name: item.nombreCompleto || null,
            metadata: {
              source: "associates",
              userId: item.userId,
              personId: item.personId,
              tipoAsociado: item.tipoAsociado,
              documentNumber: item.documentNumber,
            } as Prisma.InputJsonValue,
          })),
        });
        const created = await tx.emailRecipient.findMany({ where: { email: { in: missing.map((item) => item.correoAcceso) } }, select: { id: true, email: true } });
        for (const row of created) existingByEmail.set(row.email, row.id);
      }

      const rows = recipients.map((item) => ({
        campaignId,
        recipientId: existingByEmail.get(item.correoAcceso) as number,
        status: EmailSendStatus.PENDING,
        metadata: item as unknown as Prisma.InputJsonValue,
      }));

      await tx.emailCampaignRecipient.deleteMany({ where: { campaignId } });
      if (rows.length > 0) {
        await tx.emailCampaignRecipient.createMany({ data: rows });
      }

      await tx.auditLog.create({
        data: {
          userId: actor.userId,
          action: "CAMPAIGN_RECIPIENTS_FROM_ASSOCIATES",
          entity: "EmailCampaign",
          entityId: String(campaignId),
          newValues: { campaignName, recipientCount: rows.length, actorEmail: actor.email } as Prisma.InputJsonValue,
        },
      });
    });
    return { count: recipients.length };
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
