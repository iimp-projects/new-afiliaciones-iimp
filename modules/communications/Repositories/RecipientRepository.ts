import { Prisma, type PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export interface RecipientImportMember {
  email: string;
  name?: string;
  company?: string;
  position?: string;
  ruc?: string;
  phone?: string;
  metadata: Prisma.InputJsonValue;
}

export interface RecipientImportListPlan {
  name: string;
  sourceSheet: string;
  members: RecipientImportMember[];
}

export interface RecipientImportPlan {
  fileName: string;
  lists: RecipientImportListPlan[];
}

export interface RecipientImportPersistenceResult {
  listsCreated: number;
  listsExisting: number;
  recipientsNew: number;
  recipientsExisting: number;
  membershipsCreated: number;
}

export interface RecipientImportAuditData {
  file: string;
  listNames: string[];
  processedRows: number;
  foundEmails: number;
  invalid: number;
  duplicate: number;
}

export class RecipientRepository {
  constructor(private readonly db: PrismaClient = prisma) {}

  async listRecipients(): Promise<Array<{ id: number; email: string; name: string | null; company: string | null; lists: string[]; createdAt: string }>> {
    const rows = await this.db.emailRecipient.findMany({
      orderBy: { createdAt: "desc" },
      include: { listMembers: { include: { list: { select: { name: true } } } } },
    });
    return rows.map((row) => ({
      id: row.id,
      email: row.email,
      name: row.name,
      company: row.company,
      lists: row.listMembers.map((member) => member.list.name),
      createdAt: row.createdAt.toISOString(),
    }));
  }

  async listLists(): Promise<Array<{ id: number; name: string }>> {
    return this.db.emailRecipientList.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } });
  }

  async getRecipientDetail(id: number) {
    const row = await this.db.emailRecipient.findUnique({
      where: { id },
      include: { listMembers: { include: { list: { select: { name: true } } } } },
    });
    if (!row) return null;
    return {
      id: row.id,
      email: row.email,
      name: row.name,
      company: row.company,
      position: row.position,
      ruc: row.ruc,
      phone: row.phone,
      createdAt: row.createdAt.toISOString(),
      lists: row.listMembers.map((member) => ({ listName: member.list.name, metadata: member.metadata })),
    };
  }

  async findExistingEmails(emails: string[]): Promise<Set<string>> {
    const unique = Array.from(new Set(emails.filter((email) => email.length > 0)));
    if (unique.length === 0) return new Set();
    const rows = await this.db.emailRecipient.findMany({
      where: { email: { in: unique } },
      select: { email: true },
    });
    return new Set(rows.map((row) => row.email));
  }

  async importRecipients(
    plan: RecipientImportPlan,
    actor: { userId: number; email: string },
    audit: RecipientImportAuditData,
  ): Promise<RecipientImportPersistenceResult> {
    const result: RecipientImportPersistenceResult = {
      listsCreated: 0,
      listsExisting: 0,
      recipientsNew: 0,
      recipientsExisting: 0,
      membershipsCreated: 0,
    };

    await this.db.$transaction(async (tx) => {
      for (const listPlan of plan.lists) {
        if (listPlan.members.length === 0) continue;

        let list = await tx.emailRecipientList.findFirst({ where: { name: listPlan.name } });
        if (list) {
          result.listsExisting += 1;
        } else {
          list = await tx.emailRecipientList.create({
            data: { name: listPlan.name, sourceFile: plan.fileName, sourceSheet: listPlan.sourceSheet },
          });
          result.listsCreated += 1;
        }

        const emails = listPlan.members.map((member) => member.email);
        const existing = await tx.emailRecipient.findMany({
          where: { email: { in: emails } },
          select: { id: true, email: true },
        });
        const existingById = new Map(existing.map((row) => [row.email, row.id]));

        for (const member of listPlan.members) {
          let recipientId = existingById.get(member.email);
          if (recipientId) {
            result.recipientsExisting += 1;
          } else {
            const created = await tx.emailRecipient.create({
              data: {
                email: member.email,
                name: member.name,
                company: member.company,
                position: member.position,
                ruc: member.ruc,
                phone: member.phone,
              },
              select: { id: true },
            });
            recipientId = created.id;
            existingById.set(member.email, recipientId);
            result.recipientsNew += 1;
          }

          const membership = await tx.emailRecipientListMember.findUnique({
            where: { listId_recipientId: { listId: list.id, recipientId } },
          });
          if (!membership) {
            await tx.emailRecipientListMember.create({
              data: { listId: list.id, recipientId, metadata: member.metadata },
            });
            result.membershipsCreated += 1;
          }
        }
      }

      await tx.auditLog.create({
        data: {
          userId: actor.userId,
          action: "RECIPIENTS_IMPORTED",
          entity: "EmailRecipientList",
          newValues: {
            ...audit,
            actorEmail: actor.email,
            listsCreated: result.listsCreated,
            listsExisting: result.listsExisting,
            recipientsNew: result.recipientsNew,
            recipientsExisting: result.recipientsExisting,
            membershipsCreated: result.membershipsCreated,
          } as Prisma.InputJsonValue,
          httpMethod: "POST",
          endpoint: "/api/correos-masivos/recipients/import",
        },
      });
    });

    return result;
  }
}
