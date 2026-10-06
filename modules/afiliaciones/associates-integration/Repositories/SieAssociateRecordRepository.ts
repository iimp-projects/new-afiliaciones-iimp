import { prisma } from "@/lib/prisma";
import type { SieAssociateRecordInput, SieAssociateRecordView, ISieAssociateRecordRepository } from "./Interfaces/ISieAssociateRecordRepository";

const RECORD_SELECT = {
  id: true,
  provider: true,
  externalCode: true,
  sourceDocumentType: true,
  documentNumber: true,
  sourceType: true,
  sourceDescription: true,
  personId: true,
  categoryId: true,
  linkStatus: true,
  lastSyncedAt: true,
} as const;

export class SieAssociateRecordRepository implements ISieAssociateRecordRepository {
  async findByProviderAndExternalCode(provider: string, externalCode: string): Promise<SieAssociateRecordView | null> {
    return prisma.sieAssociateRecord.findUnique({
      where: { provider_externalCode: { provider, externalCode } },
      select: RECORD_SELECT,
    });
  }

  async findByPersonId(personId: number): Promise<SieAssociateRecordView[]> {
    return prisma.sieAssociateRecord.findMany({
      where: { personId },
      select: RECORD_SELECT,
      orderBy: { externalCode: "asc" },
    });
  }

  async upsertExternalRecord(input: SieAssociateRecordInput): Promise<SieAssociateRecordView> {
    const { provider, externalCode, ...data } = input;
    return prisma.sieAssociateRecord.upsert({
      where: { provider_externalCode: { provider, externalCode } },
      update: data,
      create: { provider, externalCode, ...data },
      select: RECORD_SELECT,
    });
  }

  async linkToPerson(recordId: number, personId: number): Promise<SieAssociateRecordView> {
    return prisma.sieAssociateRecord.update({
      where: { id: recordId },
      data: { personId, linkStatus: "LINKED" },
      select: RECORD_SELECT,
    });
  }

  async markConflict(recordId: number): Promise<SieAssociateRecordView> {
    return prisma.sieAssociateRecord.update({
      where: { id: recordId },
      data: { linkStatus: "CONFLICT" },
      select: RECORD_SELECT,
    });
  }

  async listUnlinked(): Promise<SieAssociateRecordView[]> {
    return prisma.sieAssociateRecord.findMany({
      where: { linkStatus: "UNLINKED" },
      select: RECORD_SELECT,
      orderBy: { id: "asc" },
    });
  }
}
