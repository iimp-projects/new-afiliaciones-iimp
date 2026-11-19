import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { IQuotaUniverseRepository, UniversePerson, UniverseSieRecord } from "./Interfaces/IQuotaUniverseRepository";

export class PrismaQuotaUniverseRepository implements IQuotaUniverseRepository {
  constructor(private readonly db: PrismaClient = prisma) {}

  async listSieRecords(): Promise<UniverseSieRecord[]> {
    return this.db.sieAssociateRecord.findMany({
      select: {
        personId: true,
        externalCode: true,
        sourceDocumentType: true,
        documentNumber: true,
        sourceType: true,
      },
      orderBy: { id: "asc" },
    });
  }

  async listCompletedApplicationPersons(): Promise<UniversePerson[]> {
    const applications = await this.db.membershipApplication.findMany({
      where: { status: "COMPLETED", deletedAt: null, personId: { not: null } },
      select: { personId: true, person: { select: { documentType: true, documentNumber: true } } },
      orderBy: { id: "asc" },
    });
    const seen = new Set<number>();
    const result: UniversePerson[] = [];
    for (const application of applications) {
      if (application.personId == null || !application.person) continue;
      if (seen.has(application.personId)) continue;
      seen.add(application.personId);
      result.push({
        personId: application.personId,
        documentType: application.person.documentType,
        documentNumber: application.person.documentNumber,
      });
    }
    return result;
  }

  async findPersonsByIds(personIds: readonly number[]): Promise<UniversePerson[]> {
    if (personIds.length === 0) return [];
    const persons = await this.db.person.findMany({
      where: { id: { in: [...personIds] } },
      select: { id: true, documentType: true, documentNumber: true },
      orderBy: { id: "asc" },
    });
    return persons.map((person) => ({ personId: person.id, documentType: person.documentType, documentNumber: person.documentNumber }));
  }
}
