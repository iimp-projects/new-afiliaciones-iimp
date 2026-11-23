import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { QuotaSyncRunRecord } from "../Models/QuotaModels";
import type { IQuotaSyncRepository } from "./Interfaces/IQuotaSyncRepository";
import type { QuotaTransaction } from "./Interfaces/IQuotaRepository";
import { jsonValue, toQuotaSyncRunRecord, type QuotaSyncRunFinalization, type QuotaSyncRunInput } from "./quotaRepositoryMappers";

export class PrismaQuotaSyncRepository implements IQuotaSyncRepository {
  constructor(private readonly db: PrismaClient = prisma) {}

  async createRun(input: QuotaSyncRunInput, tx?: QuotaTransaction): Promise<QuotaSyncRunRecord> {
    const record = await this.client(tx).quotaSyncRun.create({
      data: { scope: input.scope, requestedByUserId: input.requestedByUserId ?? null },
    });
    return toQuotaSyncRunRecord(record);
  }

  async markRunning(id: number, startedAt: Date, tx?: QuotaTransaction): Promise<QuotaSyncRunRecord> {
    const record = await this.client(tx).quotaSyncRun.update({
      where: { id },
      data: { status: "RUNNING", startedAt },
    });
    return toQuotaSyncRunRecord(record);
  }

  async updateProgress(id: number, counters: import("../Models/QuotaModels").QuotaSyncRunCounters, checkpoint: unknown, tx?: QuotaTransaction): Promise<QuotaSyncRunRecord> {
    const record = await this.client(tx).quotaSyncRun.update({
      where: { id },
      data: { ...counters, checkpoint: checkpoint === undefined ? undefined : (checkpoint as import("@prisma/client").Prisma.InputJsonValue) },
    });
    return toQuotaSyncRunRecord(record);
  }

  async finalizeRun(id: number, finalization: QuotaSyncRunFinalization, tx?: QuotaTransaction): Promise<QuotaSyncRunRecord> {
    const record = await this.client(tx).quotaSyncRun.update({
      where: { id },
      data: {
        status: finalization.status,
        finishedAt: finalization.finishedAt,
        ...finalization.counters,
        checkpoint: jsonValue(finalization.checkpoint),
        summary: jsonValue(finalization.summary),
      },
    });
    return toQuotaSyncRunRecord(record);
  }

  async findById(id: number, tx?: QuotaTransaction): Promise<QuotaSyncRunRecord | null> {
    const record = await this.client(tx).quotaSyncRun.findUnique({ where: { id } });
    return record ? toQuotaSyncRunRecord(record) : null;
  }

  async findRecent(limit: number, tx?: QuotaTransaction): Promise<QuotaSyncRunRecord[]> {
    const records = await this.client(tx).quotaSyncRun.findMany({ orderBy: { startedAt: "desc" }, take: limit });
    return records.map(toQuotaSyncRunRecord);
  }

  private client(tx?: QuotaTransaction) {
    return tx ?? this.db;
  }
}
