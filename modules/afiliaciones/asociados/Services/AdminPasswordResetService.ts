import bcrypt from "bcryptjs";
import { CredentialType, UserStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const BCRYPT_COST = 12;

export class AdminPasswordResetError extends Error {
  constructor(message: string, readonly status = 409) {
    super(message);
  }
}

export class AdminPasswordResetService {
  async resetToDocument(personId: number, actorUserId: number): Promise<{ documentType: string; mustChangePassword: true }> {
    const person = await prisma.person.findUnique({
      where: { id: personId },
      select: {
        documentType: true,
        documentNumber: true,
        deletedAt: true,
        user: { select: { id: true, status: true } },
      },
    });
    if (!person || person.deletedAt) throw new AdminPasswordResetError("La persona no existe.", 404);
    if (!person.user) throw new AdminPasswordResetError("La persona no tiene una cuenta de acceso.", 404);
    if (person.user.status !== UserStatus.ACTIVE) throw new AdminPasswordResetError("Solo se puede restablecer la contraseña de una cuenta activa.", 409);

    const documentNumber = person.documentNumber?.trim();
    if (!documentNumber) throw new AdminPasswordResetError("La persona no tiene un número de documento válido.", 400);

    const secret = await bcrypt.hash(documentNumber, BCRYPT_COST);
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`associate-password-reset:${person.user!.id}`}))`;
      const current = await tx.credential.findFirst({
        where: { userId: person.user!.id, type: CredentialType.PASSWORD },
        orderBy: [{ isActive: "desc" }, { createdAt: "asc" }],
        select: { id: true },
      });
      if (current) {
        await tx.credential.update({ where: { id: current.id }, data: { secret, isActive: true } });
        await tx.credential.updateMany({
          where: { userId: person.user!.id, type: CredentialType.PASSWORD, id: { not: current.id } },
          data: { isActive: false },
        });
      } else {
        await tx.credential.create({ data: { userId: person.user!.id, type: CredentialType.PASSWORD, secret, isActive: true } });
      }
      await tx.user.update({ where: { id: person.user!.id }, data: { mustChangePassword: true } });
      await tx.userSession.deleteMany({ where: { userId: person.user!.id } });
      await tx.auditLog.create({
        data: {
          userId: actorUserId,
          action: "ASSOCIATE_PASSWORD_RESET",
          entity: "User",
          entityId: String(person.user!.id),
          newValues: { personId, method: "DOCUMENT_NUMBER", documentType: person.documentType },
        },
      });
    });

    return { documentType: person.documentType, mustChangePassword: true };
  }
}
