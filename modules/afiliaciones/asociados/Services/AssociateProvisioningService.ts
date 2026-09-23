import { ApplicationStatus, Prisma, UserStatus, UserType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { accountActivationService } from "@/modules/auth/account-activation/service";

export class AssociateProvisioningError extends Error { constructor(message: string) { super(message); } }
export interface AssociateProvisioningResult { userId: number; created: boolean; role: "ASOCIADO_ACTIVO" | "ASOCIADO_ESTUDIANTE"; activationRequired: boolean; }

/** Provisions one already-completed application. It is intentionally not a batch job. */
export class AssociateProvisioningService {
  async provisionCompletedApplication(applicationId: number): Promise<AssociateProvisioningResult | null> {
    const result = await prisma.$transaction(async (tx) => {
      const application = await tx.membershipApplication.findUnique({ where: { id: applicationId }, include: { person: { include: { contacts: { orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }] }, user: true } } } });
      if (!application || application.deletedAt || application.status !== ApplicationStatus.COMPLETED) return null;
      if (!application.person || application.person.deletedAt) throw new AssociateProvisioningError("La postulación completada no tiene una persona válida.");
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`associate-provision:${application.person.id}`}))`;
      const documentNumber = application.person.documentNumber?.trim();
      const email = (application.person.contacts.find((contact) => contact.email)?.email || application.email || "").trim().toLowerCase();
      if (!documentNumber) throw new AssociateProvisioningError("Falta el documento de la persona; no se puede crear la cuenta.");
      if (!email) throw new AssociateProvisioningError("Falta el correo de la persona; no se puede crear la cuenta.");
      const roleSlug: AssociateProvisioningResult["role"] = application.affiliateType === "STUDENT" ? "ASOCIADO_ESTUDIANTE" : "ASOCIADO_ACTIVO";
      const role = await tx.role.findUnique({ where: { slug: roleSlug } });
      if (!role || !role.isActive) throw new AssociateProvisioningError(`No existe un rol activo para ${roleSlug}.`);
      const existing = await tx.user.findUnique({ where: { personId: application.person.id } });
      if (existing) {
        const user = await tx.user.update({ where: { id: existing.id }, data: { type: UserType.AFFILIATE, roleId: role.id, deletedAt: null } });
        await audit(tx, applicationId, `Reutilización idempotente de cuenta ${user.id}.`);
        return { userId: user.id, created: false, role: roleSlug, activationRequired: user.status === UserStatus.PENDING };
      }
      const duplicateEmail = await tx.user.findFirst({ where: { email: { equals: email, mode: "insensitive" } }, select: { id: true, personId: true } });
      if (duplicateEmail) throw new AssociateProvisioningError("El correo ya pertenece a otra cuenta; se requiere revisión manual.");
      try {
        const user = await tx.user.create({ data: { email, personId: application.person.id, roleId: role.id, type: UserType.AFFILIATE, status: UserStatus.PENDING } });
        await audit(tx, applicationId, `Cuenta de asociado creada para personId ${application.person.id}.`);
        return { userId: user.id, created: true, role: roleSlug, activationRequired: true };
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new AssociateProvisioningError("La cuenta fue creada en otra operación; vuelva a intentar para reutilizarla.");
        throw error;
      }
    });

    if (result?.activationRequired) {
      await accountActivationService.createAndSendActivation(result.userId);
    }

    return result;
  }

  /** Compatibility alias for internal callers. */
  provision(applicationId: number) { return this.provisionCompletedApplication(applicationId); }
}

async function audit(tx: Prisma.TransactionClient, applicationId: number, description: string) { await tx.auditLog.create({ data: { action: "PROVISION_AFFILIATE_ACCOUNT", entity: "MembershipApplication", entityId: String(applicationId), newValues: { description } } }); }
