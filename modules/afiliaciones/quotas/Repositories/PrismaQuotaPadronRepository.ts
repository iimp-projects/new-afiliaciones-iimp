import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { IQuotaPadronRepository, PadronDocument } from "./Interfaces/IQuotaPadronRepository";

const CHUNK_SIZE = 500;

export class PrismaQuotaPadronRepository implements IQuotaPadronRepository {
  constructor(private readonly db: PrismaClient = prisma) {}

  async findPersonIdsByDocuments(documents: readonly PadronDocument[]): Promise<Map<string, number>> {
    const result = new Map<string, number>();
    for (let index = 0; index < documents.length; index += CHUNK_SIZE) {
      const chunk = documents.slice(index, index + CHUNK_SIZE);
      if (chunk.length === 0) continue;
      const persons = await this.db.person.findMany({
        where: { OR: chunk.map((document) => ({ documentType: document.documentType, documentNumber: document.documentNumber })) },
        select: { id: true, documentType: true, documentNumber: true },
      });
      for (const person of persons) result.set(`${person.documentType}|${person.documentNumber}`, person.id);
    }
    return result;
  }
}
