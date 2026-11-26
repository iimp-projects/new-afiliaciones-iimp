import type { Prisma } from "@prisma/client";
import { formatAssociateCode } from "@/modules/shared/Utils/associateCode";

export class AssociateCodeService {
  async assignForPerson(personId: number, tx: Prisma.TransactionClient): Promise<string> {
    const person = await tx.person.findUnique({ where: { id: personId }, select: { associateCode: true } });
    if (!person) throw new Error("Persona no encontrada para asignar código correlativo.");
    if (person.associateCode) return person.associateCode;

    const sequence = await tx.associateCodeSequence.upsert({
      where: { id: 1 },
      update: { lastValue: { increment: 1 } },
      create: { id: 1, lastValue: 1 },
      select: { lastValue: true },
    });
    const code = formatAssociateCode(sequence.lastValue);
    await tx.person.update({ where: { id: personId }, data: { associateCode: code } });
    return code;
  }

  async ensureSequenceAtLeast(value: number, tx: Prisma.TransactionClient): Promise<void> {
    if (!Number.isInteger(value) || value < 0) return;
    await tx.associateCodeSequence.upsert({
      where: { id: 1 },
      update: {},
      create: { id: 1, lastValue: value },
    });
    await tx.$executeRaw`UPDATE "associate_code_sequence" SET "last_value" = GREATEST("last_value", ${value}) WHERE "id" = 1`;
  }
}

export const associateCodeService = new AssociateCodeService();
