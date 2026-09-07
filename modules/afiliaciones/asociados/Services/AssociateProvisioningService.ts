import bcrypt from "bcryptjs";
import { ApplicationStatus, CredentialType, Prisma, UserStatus, UserType } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export class AssociateProvisioningError extends Error { constructor(message: string) { super(message); } }
export interface AssociateProvisioningResult { userId: number; created: boolean; role: "ASOCIADO_ACTIVO" | "ASOCIADO_ESTUDIANTE"; }

/** Provisions one already-completed application. It is intentionally not a batch job. */
export class AssociateProvisioningService {
  async provision(applicationId: number): Promise<AssociateProvisioningResult> {
    return prisma.$transaction(async (tx) => {
      const application = await tx.membershipApplication.findUnique({ where: { id: applicationId }, include: { person: { include: { contacts: { orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }] }, user: true } } } });
      if (!application || application.deletedAt || application.status !== ApplicationStatus.COMPLETED) throw new AssociateProvisioningError("La postulación no está completada o no existe.");
      if (!application.person || application.person.deletedAt) throw new AssociateProvisioningError("La postulación completada no tiene una persona válida.");
      const documentNumber = application.person.documentNumber?.trim();
      const email = application.person.contacts.find((contact) => contact.email)?.email?.trim() || application.email?.trim();
      if (!documentNumber) throw new AssociateProvisioningError("Falta el documento de la persona; no se puede crear la cuenta.");
      if (!email) throw new AssociateProvisioningError("Falta el correo de la persona; no se puede crear la cuenta.");
      const roleSlug = application.affiliateType === "STUDENT" ? "ASOCIADO_ESTUDIANTE" : "ASOCIADO_ACTIVO";
      const role = await tx.role.findUnique({ where: { slug: roleSlug } });
      if (!role || !role.isActive) throw new AssociateProvisioningError(`No existe un rol activo para ${roleSlug}.`);
      const existing = application.person.user;
      if (existing) {
        const user = await tx.user.update({ where: { id: existing.id }, data: { type: UserType.AFFILIATE, roleId: role.id, deletedAt: null } });
        await audit(tx, applicationId, `Reutilización idempotente de cuenta ${user.id}.`);
        return { userId: user.id, created: false, role: roleSlug };
      }
      const duplicateEmail = await tx.user.findUnique({ where: { email } });
      if (duplicateEmail) throw new AssociateProvisioningError("El correo ya pertenece a otra cuenta; se requiere revisión manual.");
      const passwordHash = await bcrypt.hash(documentNumber, 12);
      try {
        const user = await tx.user.create({ data: { email, personId: application.person.id, roleId: role.id, type: UserType.AFFILIATE, status: UserStatus.ACTIVE, emailVerified: new Date() } });
        await tx.credential.create({ data: { userId: user.id, type: CredentialType.PASSWORD, secret: passwordHash, isActive: true } });
        await audit(tx, applicationId, `Cuenta de asociado creada para personId ${application.person.id}.`);
        return { userId: user.id, created: true, role: roleSlug };
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new AssociateProvisioningError("La cuenta fue creada en otra operación; vuelva a intentar para reutilizarla.");
        throw error;
      }
    });
  }
}

async function audit(tx: Prisma.TransactionClient, applicationId: number, description: string) { await tx.auditLog.create({ data: { action: "PROVISION_AFFILIATE_ACCOUNT", entity: "MembershipApplication", entityId: String(applicationId), newValues: { description } } }); }
