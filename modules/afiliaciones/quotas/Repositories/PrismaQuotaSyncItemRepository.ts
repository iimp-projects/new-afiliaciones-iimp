import { Prisma, type PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { QuotaSyncItemRecord } from "../Models/QuotaModels";
import type { IQuotaSyncItemRepository } from "./Interfaces/IQuotaSyncItemRepository";
import type { QuotaTransaction } from "./Interfaces/IQuotaRepository";
import type { QuotaSyncItemCompletion, QuotaSyncItemInput } from "./quotaRepositoryMappers";
import { toQuotaSyncItemRecord } from "./quotaRepositoryMappers";

export class PrismaQuotaSyncItemRepository implements IQuotaSyncItemRepository {
  constructor(private readonly db: PrismaClient = prisma) {}

  async createOrGet(input: QuotaSyncItemInput, tx?: QuotaTransaction): Promise<QuotaSyncItemRecord> {
    try {
      const record = await this.client(tx).quotaSyncItem.create({
        data: {
          syncRunId: input.syncRunId,
          personId: input.personId,
          institutionalCode: input.institutionalCode,
          identityHash: input.identityHash,
        },
      });
      return toQuotaSyncItemRecord(record);
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") throw error;
      const existing = await this.client(tx).quotaSyncItem.findUnique({
        where: { syncRunId_identityHash: { syncRunId: input.syncRunId, identityHash: input.identityHash } },
      });
      if (!existing) throw error;
      return toQuotaSyncItemRecord(existing);
    }
  }

  async markRunning(id: number, startedAt: Date, tx?: QuotaTransaction): Promise<QuotaSyncItemRecord> {
    const record = await this.client(tx).quotaSyncItem.update({
      where: { id },
      data: { status: "RUNNING", startedAt, attempts: { increment: 1 } },
    });
    return toQuotaSyncItemRecord(record);
  }

  async finish(id: number, completion: QuotaSyncItemCompletion, tx?: QuotaTransaction): Promise<QuotaSyncItemRecord> {
    const record = await this.client(tx).quotaSyncItem.update({
      where: { id },
      data: {
        status: completion.status,
        quotasRecovered: completion.quotasRecovered,
        recordsCreated: completion.recordsCreated,
        recordsUpdated: completion.recordsUpdated,
        errorCode: completion.errorCode ?? null,
        finishedAt: completion.finishedAt,
      },
    });
    return toQuotaSyncItemRecord(record);
  }

  async listByRun(syncRunId: number, tx?: QuotaTransaction): Promise<QuotaSyncItemRecord[]> {
    const records = await this.client(tx).quotaSyncItem.findMany({
      where: { syncRunId },
      orderBy: { id: "asc" },
    });
    return records.map(toQuotaSyncItemRecord);
  }

  private client(tx?: QuotaTransaction) {
    return tx ?? this.db;
  }
}
