import { Prisma, type DocumentType, type PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { AssociateQuotaRecord } from "../Models/QuotaModels";
import type { PortableQuotaRecord } from "../Models/QuotaPortability";
import type { IQuotaPortabilityRepository, PortableUpsertResult } from "./Interfaces/IQuotaPortabilityRepository";
import type { QuotaTransaction } from "./Interfaces/IQuotaRepository";
import { toDatabaseDate, toQuotaRecord } from "./quotaRepositoryMappers";

const CHUNK_SIZE = 500;

export class PrismaQuotaPortabilityRepository implements IQuotaPortabilityRepository {
  constructor(private readonly db: PrismaClient = prisma) {}

  async listAll(tx?: QuotaTransaction): Promise<AssociateQuotaRecord[]> {
    const records = await this.client(tx).associateQuota.findMany({ orderBy: { sourceKey: "asc" } });
    return records.map(toQuotaRecord);
  }

  async findPersonIdsByInstitutionalCodes(codes: readonly string[], tx?: QuotaTransaction): Promise<Map<string, number>> {
    const result = new Map<string, number>();
    const unique = [...new Set(codes.filter(Boolean))];
    for (let index = 0; index < unique.length; index += CHUNK_SIZE) {
      const chunk = unique.slice(index, index + CHUNK_SIZE);
      const records = await this.client(tx).sieAssociateRecord.findMany({
        where: { provider: "SIE", externalCode: { in: chunk }, personId: { not: null } },
        select: { externalCode: true, personId: true },
      });
      for (const record of records) {
        if (record.personId != null) result.set(record.externalCode, record.personId);
      }
    }
    return result;
  }

  async upsertPortable(record: PortableQuotaRecord, personId: number | null, force: boolean, tx?: QuotaTransaction): Promise<PortableUpsertResult> {
    const db = this.client(tx);
    const existing = await db.associateQuota.findUnique({ where: { sourceKey: record.sourceKey } });
    const incomingLastSeen = new Date(record.lastSeenAt);
    if (existing && !force && existing.lastSeenAt.getTime() > incomingLastSeen.getTime()) return "SKIPPED_NEWER";
    if (existing && existing.sourcePayloadHash === record.sourcePayloadHash && existing.isPresentInLastSuccessfulSync === record.isPresentInLastSuccessfulSync) {
      return "UNCHANGED";
    }

    const data = {
      personId: personId ?? existing?.personId ?? null,
      institutionalCode: record.institutionalCode,
      provider: record.provider,
      documentType: record.documentType as DocumentType,
      documentNumberHash: record.documentNumberHash,
      sourcePayloadHash: record.sourcePayloadHash,
      concept: record.concept,
      quotaNumber: record.quotaNumber,
      year: record.year,
      currency: record.currency,
      amount: new Prisma.Decimal(record.amount),
      accountingStatus: record.accountingStatus,
      membershipType: record.membershipType,
      paidAt: toDatabaseDate(record.paidAt),
      periodStart: toDatabaseDate(record.periodStart),
      periodEnd: toDatabaseDate(record.periodEnd),
      receiptSerie: record.receiptSerie,
      receiptNumber: record.receiptNumber,
      isPresentInLastSuccessfulSync: record.isPresentInLastSuccessfulSync,
      lastSeenAt: incomingLastSeen,
    };

    if (existing) {
      await db.associateQuota.update({ where: { id: existing.id }, data });
      return "UPDATED";
    }

    await db.associateQuota.create({
      data: {
        ...data,
        sourceKey: record.sourceKey,
        firstSeenAt: new Date(record.firstSeenAt),
      },
    });
    return "INSERTED";
  }

  private client(tx?: QuotaTransaction) {
    return tx ?? this.db;
  }
}
