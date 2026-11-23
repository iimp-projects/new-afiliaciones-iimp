import { Prisma, type AssociateQuota, type PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { QuotaDomainError } from "../Models/QuotaErrors";
import type { AssociateQuotaRecord, NormalizedQuota, QuotaSyncWriteResult, QuotaUpsertAction } from "../Models/QuotaModels";
import type { ApplySuccessfulSyncInput, IQuotaRepository, QuotaTransaction } from "./Interfaces/IQuotaRepository";
import { toDatabaseDate, toIsoDate, toQuotaRecord } from "./quotaRepositoryMappers";
import { planQuotaUpsert } from "../Services/QuotaUpsertPlanner";

export class PrismaQuotaRepository implements IQuotaRepository {
  constructor(private readonly db: PrismaClient = prisma) {}

  async applySuccessfulSync(input: ApplySuccessfulSyncInput): Promise<QuotaSyncWriteResult> {
    const apply = async (tx: Prisma.TransactionClient): Promise<QuotaSyncWriteResult> => {
      let inserted = 0;
      let updated = 0;
      let unchanged = 0;
      const seenSourceKeys: string[] = [];

      for (const quota of input.quotas) {
        const action = await this.upsertOne(tx, quota, input);
        if (action === "INSERTED") inserted += 1;
        else if (action === "UPDATED") updated += 1;
        else unchanged += 1;
        seenSourceKeys.push(quota.sourceKey);
      }

      let markedNotPresent = 0;
      if (input.personId != null) {
        const where: Prisma.AssociateQuotaWhereInput = { personId: input.personId };
        if (seenSourceKeys.length > 0) where.sourceKey = { notIn: seenSourceKeys };
        const result = await tx.associateQuota.updateMany({
          where,
          data: { isPresentInLastSuccessfulSync: false },
        });
        markedNotPresent = result.count;
      }

      return { inserted, updated, unchanged, markedNotPresent };
    };

    return input.tx ? apply(input.tx) : this.db.$transaction(apply);
  }

  async findBySourceKey(sourceKey: string, tx?: QuotaTransaction): Promise<AssociateQuotaRecord | null> {
    const record = await this.client(tx).associateQuota.findUnique({ where: { sourceKey } });
    return record ? toQuotaRecord(record) : null;
  }

  async listByPersonId(personId: number, tx?: QuotaTransaction): Promise<AssociateQuotaRecord[]> {
    const records = await this.client(tx).associateQuota.findMany({
      where: { personId },
      orderBy: [{ year: "asc" }, { concept: "asc" }, { quotaNumber: "asc" }],
    });
    return records.map(toQuotaRecord);
  }

  private async upsertOne(tx: Prisma.TransactionClient, quota: NormalizedQuota, input: ApplySuccessfulSyncInput): Promise<QuotaUpsertAction> {
    const existing = await tx.associateQuota.findUnique({ where: { sourceKey: quota.sourceKey } });
    if (existing) {
      this.assertSamePerson(existing.personId, input.personId);
      return this.updateExisting(tx, existing, quota, input);
    }

    try {
      await tx.associateQuota.create({ data: this.createData(quota, input) });
      return "INSERTED";
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") throw error;
      const raced = await tx.associateQuota.findUnique({ where: { sourceKey: quota.sourceKey } });
      if (!raced) throw error;
      this.assertSamePerson(raced.personId, input.personId);
      return this.updateExisting(tx, raced, quota, input);
    }
  }

  private async updateExisting(
    tx: Prisma.TransactionClient,
    existing: AssociateQuota,
    quota: NormalizedQuota,
    input: ApplySuccessfulSyncInput,
  ): Promise<QuotaUpsertAction> {
    const action: QuotaUpsertAction = planQuotaUpsert(existing, quota);
    if (action === "UPDATED") {
      await tx.auditLog.create({
        data: {
          userId: input.actorUserId ?? null,
          action: "ASSOCIATE_QUOTA_UPDATED",
          entity: "AssociateQuota",
          entityId: String(existing.id),
          oldValues: {
            amount: existing.amount.toFixed(2),
            accountingStatus: existing.accountingStatus,
            paidAt: toIsoDate(existing.paidAt),
            sourcePayloadHash: existing.sourcePayloadHash,
          },
          newValues: {
            amount: quota.amount,
            accountingStatus: quota.accountingStatus,
            paidAt: quota.paidAt,
            sourcePayloadHash: quota.sourcePayloadHash,
          },
        },
      });
    }
    await tx.associateQuota.update({
      where: { id: existing.id },
      data: {
        personId: input.personId ?? existing.personId,
        institutionalCode: quota.institutionalCode ?? existing.institutionalCode ?? input.institutionalCode,
        provider: quota.provider,
        documentType: quota.documentType,
        documentNumberHash: quota.documentNumberHash,
        sourcePayloadHash: quota.sourcePayloadHash,
        concept: quota.concept,
        quotaNumber: quota.quotaNumber,
        year: quota.year,
        currency: quota.currency,
        amount: new Prisma.Decimal(quota.amount),
        accountingStatus: quota.accountingStatus,
        membershipType: quota.membershipType,
        paidAt: toDatabaseDate(quota.paidAt),
        periodStart: toDatabaseDate(quota.periodStart),
        periodEnd: toDatabaseDate(quota.periodEnd),
        receiptSerie: quota.receiptSerie,
        receiptNumber: quota.receiptNumber,
        isPresentInLastSuccessfulSync: true,
        lastSeenAt: input.syncedAt,
      },
    });
    return action;
  }

  private createData(quota: NormalizedQuota, input: ApplySuccessfulSyncInput): Prisma.AssociateQuotaUncheckedCreateInput {
    return {
      personId: input.personId,
      institutionalCode: quota.institutionalCode ?? input.institutionalCode,
      provider: quota.provider,
      documentType: quota.documentType,
      documentNumberHash: quota.documentNumberHash,
      sourceKey: quota.sourceKey,
      sourcePayloadHash: quota.sourcePayloadHash,
      concept: quota.concept,
      quotaNumber: quota.quotaNumber,
      year: quota.year,
      currency: quota.currency,
      amount: new Prisma.Decimal(quota.amount),
      accountingStatus: quota.accountingStatus,
      membershipType: quota.membershipType,
      paidAt: toDatabaseDate(quota.paidAt),
      periodStart: toDatabaseDate(quota.periodStart),
      periodEnd: toDatabaseDate(quota.periodEnd),
      receiptSerie: quota.receiptSerie,
      receiptNumber: quota.receiptNumber,
      isPresentInLastSuccessfulSync: true,
      lastSeenAt: input.syncedAt,
    };
  }

  private assertSamePerson(existingPersonId: number | null, incomingPersonId: number | null): void {
    if (existingPersonId != null && incomingPersonId != null && existingPersonId !== incomingPersonId) {
      throw new QuotaDomainError(
        "PERSON_MISMATCH",
        "La identidad de la cuota ya está vinculada a otra persona. No se reasignará automáticamente.",
      );
    }
  }

  private client(tx?: QuotaTransaction) {
    return tx ?? this.db;
  }
}
