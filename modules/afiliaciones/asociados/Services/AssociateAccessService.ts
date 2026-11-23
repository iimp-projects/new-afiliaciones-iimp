import { ApplicationStatus, CredentialType, UserStatus, UserType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { accountActivationService } from "@/modules/auth/account-activation/service";
import { AssociateProvisioningService } from "./AssociateProvisioningService";

export type AssociateAccessStatus = "NOT_PROVISIONED" | "PENDING_ACTIVATION" | "ACTIVE" | "CONFLICT" | "ERROR";
export type PortalAccessConflictClassification = "DIFFERENT_IDENTITY" | "INSUFFICIENT_EVIDENCE" | "SAME_IDENTITY_CANDIDATE";

export interface AssociateAccessResult {
  status: AssociateAccessStatus;
  email?: string;
  userId?: number;
  role?: string;
  applicant?: { name: string; documentNumber: string; email: string; applicationCode: string };
  detectedAccount?: { id: number; email: string; status: UserStatus; role?: string; personName?: string };
  conflictClassification?: PortalAccessConflictClassification;
  canChangeEmail?: boolean;
  canRetryProvisioning: boolean;
  canResendActivation: boolean;
  message: string;
}

export class AssociateAccessError extends Error {
  constructor(message: string, readonly status = 409) {
    super(message);
  }
}

export class AssociateAccessService {
  async resolve(applicationId: number): Promise<AssociateAccessResult> {
    const application = await prisma.membershipApplication.findUnique({
      where: { id: applicationId },
      include: {
        person: { include: { contacts: { orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }] }, user: { include: { role: { select: { slug: true } }, credentials: { where: { type: CredentialType.PASSWORD, isActive: true }, select: { id: true } } } } } },
      },
    });

    if (!application || application.deletedAt || application.status !== ApplicationStatus.COMPLETED || !application.person || application.person.deletedAt) {
      return errorResult("La afiliación no está disponible para la gestión de acceso.");
    }

    const email = (application.person.contacts.find((contact) => contact.email)?.email || application.email || "").trim().toLowerCase();
    if (!email) return errorResult("La afiliación completada no tiene un correo válido.");

    const applicant = {
      name: [application.person.firstName, application.person.paternalLastName, application.person.maternalLastName].filter(Boolean).join(" "),
      documentNumber: application.person.documentNumber,
      email,
      applicationCode: application.applicationCode,
    };

    const user = application.person.user;
    if (user) {
      if (user.status === UserStatus.PENDING) return { status: "PENDING_ACTIVATION", userId: user.id, email: user.email, role: user.role?.slug, applicant, canRetryProvisioning: false, canResendActivation: true, message: "La cuenta fue creada y está pendiente de activación." };
      if (user.status === UserStatus.ACTIVE && user.credentials.length > 0) return { status: "ACTIVE", userId: user.id, email: user.email, role: user.role?.slug, applicant, canRetryProvisioning: false, canResendActivation: false, message: "La cuenta está activa y el asociado ya puede ingresar al portal." };
      return errorResult("La cuenta asociada no se encuentra en un estado habilitable.", user.id, user.email, user.role?.slug);
    }

    const duplicate = await prisma.user.findFirst({ where: { email: { equals: email, mode: "insensitive" } }, include: { role: { select: { slug: true } }, person: { select: { firstName: true, paternalLastName: true, maternalLastName: true, documentType: true, documentNumber: true } } } });
    if (duplicate && duplicate.personId !== application.personId) {
      const conflictClassification = classifyConflict(application.person, duplicate.person);
      return {
        status: "CONFLICT", email, userId: duplicate.id, role: duplicate.role?.slug, applicant,
        detectedAccount: { id: duplicate.id, email: duplicate.email, status: duplicate.status, role: duplicate.role?.slug, personName: [duplicate.person?.firstName, duplicate.person?.paternalLastName, duplicate.person?.maternalLastName].filter(Boolean).join(" ") || undefined },
        conflictClassification,
        canChangeEmail: conflictClassification === "DIFFERENT_IDENTITY",
        canRetryProvisioning: false,
        canResendActivation: false,
        message: "El correo registrado se encuentra asociado a otra cuenta. Se requiere revisar la identidad antes de habilitar el acceso al portal.",
      };
    }

    return { status: "NOT_PROVISIONED", email, applicant, canRetryProvisioning: true, canResendActivation: false, message: "La afiliación está completada, pero todavía no se ha habilitado el acceso al portal." };
  }

  async resolveByPerson(personId: number): Promise<AssociateAccessResult> {
    const person = await prisma.person.findUnique({
      where: { id: personId },
      include: {
        contacts: { orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }] },
        user: { include: { role: { select: { slug: true } }, credentials: { where: { type: CredentialType.PASSWORD, isActive: true }, select: { id: true } } } },
        sieAssociateRecords: { where: { provider: "SIE", linkStatus: "LINKED" }, include: { category: true }, orderBy: { updatedAt: "desc" }, take: 1 },
        applications: { where: { deletedAt: null, status: ApplicationStatus.COMPLETED }, select: { id: true, affiliateType: true }, orderBy: { updatedAt: "desc" }, take: 1 },
        _count: { select: { quotas: true } },
      },
    });
    if (!person || person.deletedAt) return errorResult("La persona no está disponible para la gestión de acceso.");

    const email = (person.contacts.find((contact) => contact.email)?.email || person.user?.email || "").trim().toLowerCase();
    const record = person.sieAssociateRecords[0];
    const category = record?.category ?? null;
    const application = person.applications[0] ?? null;
    const applicant = {
      name: [person.firstName, person.paternalLastName, person.maternalLastName].filter(Boolean).join(" "),
      documentNumber: person.documentNumber,
      email,
      applicationCode: record?.externalCode ?? (application ? `APP-${application.id}` : "SIN EXPEDIENTE"),
    };

    if (person.user) {
      const user = person.user;
      if (user.status === UserStatus.PENDING) return { status: "PENDING_ACTIVATION", userId: user.id, email: user.email, role: user.role?.slug, applicant, canRetryProvisioning: false, canResendActivation: true, message: "La cuenta fue creada y está pendiente de activación." };
      if (user.status === UserStatus.ACTIVE && user.credentials.length > 0) return { status: "ACTIVE", userId: user.id, email: user.email, role: user.role?.slug, applicant, canRetryProvisioning: false, canResendActivation: false, message: "La cuenta está activa y el asociado ya puede ingresar al portal." };
      return errorResult("La cuenta asociada no se encuentra en un estado habilitable.", user.id, user.email, user.role?.slug);
    }

    if (person._count.quotas < 1) return errorResult("La persona no tiene cuotas registradas que respalden su acceso al portal.", undefined, email);
    if (!email) return errorResult("La persona no tiene un correo válido para crear la cuenta.", undefined, email);
    if (category && !category.allowsLogin) {
      return errorResult(`La categoría ${category.name} no habilita acceso al portal.`, undefined, email);
    }

    const roleSlug = category?.mappedRoleSlug
      || (category?.code === "E" || application?.affiliateType === "STUDENT" ? "ASOCIADO_ESTUDIANTE" : "ASOCIADO_ACTIVO");
    const role = await prisma.role.findUnique({ where: { slug: roleSlug }, select: { slug: true, isActive: true } });
    if (!role || !role.isActive) return errorResult(`No existe un rol activo para ${roleSlug}.`, undefined, email);

    const duplicate = await prisma.user.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
      include: { role: { select: { slug: true } }, person: { select: { firstName: true, paternalLastName: true, maternalLastName: true, documentType: true, documentNumber: true } } },
    });
    if (duplicate && duplicate.personId !== person.id) {
      const conflictClassification = classifyConflict(person, duplicate.person);
      return {
        status: "CONFLICT", email, userId: duplicate.id, role: duplicate.role?.slug, applicant,
        detectedAccount: { id: duplicate.id, email: duplicate.email, status: duplicate.status, role: duplicate.role?.slug, personName: [duplicate.person?.firstName, duplicate.person?.paternalLastName, duplicate.person?.maternalLastName].filter(Boolean).join(" ") || undefined },
        conflictClassification,
        canChangeEmail: false,
        canRetryProvisioning: false,
        canResendActivation: false,
        message: "El correo registrado se encuentra asociado a otra cuenta. Se requiere revisión administrativa.",
      };
    }

    return { status: "NOT_PROVISIONED", email, role: roleSlug, applicant, canRetryProvisioning: true, canResendActivation: false, message: "La persona tiene cuotas registradas, pero todavía no se ha habilitado su acceso al portal." };
  }

  async retryProvisioningByPerson(personId: number, actorUserId: number): Promise<AssociateAccessResult> {
    const current = await this.resolveByPerson(personId);
    if (current.status !== "NOT_PROVISIONED" || !current.role || !current.email) {
      throw new AssociateAccessError("El acceso no está disponible para habilitación.");
    }
    const role = await prisma.role.findUnique({ where: { slug: current.role }, select: { id: true, isActive: true } });
    if (!role || !role.isActive) throw new AssociateAccessError("No existe un rol activo para habilitar el acceso.", 409);

    const created = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`associate-access-person:${personId}`}))`;
      const person = await tx.person.findUnique({
        where: { id: personId },
        include: { contacts: { orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }] }, user: true },
      });
      if (!person || person.deletedAt) throw new AssociateAccessError("La persona no está disponible.", 404);
      if (person.user) return person.user;
      const email = (person.contacts.find((contact) => contact.email)?.email || current.email || "").trim().toLowerCase();
      const duplicate = await tx.user.findFirst({ where: { email: { equals: email, mode: "insensitive" } }, select: { id: true, personId: true } });
      if (duplicate && duplicate.personId !== person.id) throw new AssociateAccessError("El correo ya pertenece a otra cuenta.", 409);
      const user = await tx.user.create({ data: { email, personId: person.id, roleId: role.id, status: UserStatus.PENDING, type: UserType.AFFILIATE } });
      await tx.auditLog.create({ data: { userId: actorUserId, action: "ASSOCIATE_ACCESS_PROVISIONED_BY_QUOTA", entity: "User", entityId: String(user.id), newValues: { personId, role: current.role } } });
      return user;
    });

    if (created.status === UserStatus.PENDING) await accountActivationService.createAndSendActivation(created.id);
    return this.resolveByPerson(personId);
  }

  async retryProvisioning(applicationId: number, actorUserId: number): Promise<AssociateAccessResult> {
    const current = await this.resolve(applicationId);
    if (current.status !== "NOT_PROVISIONED") throw new AssociateAccessError("La cuenta no está disponible para habilitación.");
    await new AssociateProvisioningService().provisionCompletedApplication(applicationId);
    await this.audit(actorUserId, "ACCESS_PROVISION_RETRY", applicationId, current.userId);
    return this.resolve(applicationId);
  }

  async resendActivation(applicationId: number, actorUserId: number): Promise<AssociateAccessResult> {
    const current = await this.resolve(applicationId);
    if (current.status !== "PENDING_ACTIVATION" || !current.userId) throw new AssociateAccessError("La cuenta no está pendiente de activación.");
    await accountActivationService.createAndSendActivation(current.userId);
    await this.audit(actorUserId, "ACTIVATION_RESEND", applicationId, current.userId);
    return this.resolve(applicationId);
  }

  async changeEmailAndProvision(applicationId: number, emailInput: string, actorUserId: number): Promise<AssociateAccessResult> {
    const email = normalizeEmail(emailInput);
    if (!email) throw new AssociateAccessError("Ingresa un correo electrónico válido.", 422);

    const outcome = await prisma.$transaction(async (tx) => {
      const application = await tx.membershipApplication.findUnique({
        where: { id: applicationId },
        include: { person: { include: { contacts: { orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }] }, user: true } } },
      });
      if (!application || application.deletedAt || application.status !== ApplicationStatus.COMPLETED || !application.person || application.person.deletedAt) throw new AssociateAccessError("La afiliación no está disponible para la gestión de acceso.");
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`portal-access-email:${email}`}))`;
      const sourceEmail = (application.person.user?.email || application.person.contacts.find((contact) => contact.email)?.email || application.email || "").trim().toLowerCase();
      if (sourceEmail) {
        const currentOwner = await tx.user.findFirst({
          where: { email: { equals: sourceEmail, mode: "insensitive" }, personId: { not: application.person.id } },
          include: { person: { select: { documentType: true, documentNumber: true } } },
        });
        if (currentOwner && classifyConflict(application.person, currentOwner.person) !== "DIFFERENT_IDENTITY") {
          throw new AssociateAccessError("El conflicto requiere revisión administrativa.", 409);
        }
      }
      const owner = await tx.user.findFirst({ where: { email: { equals: email, mode: "insensitive" } }, select: { id: true, personId: true } });
      if (owner && owner.personId !== application.person.id) throw new AssociateAccessError("El correo ingresado ya se encuentra registrado.", 409);

      const user = application.person.user;
      if (user?.status === UserStatus.ACTIVE) throw new AssociateAccessError("No se puede cambiar el correo de una cuenta activa desde esta función.");
      const oldEmail = user?.email || application.person.contacts.find((contact) => contact.email)?.email || application.email;
      if (user) await tx.user.update({ where: { id: user.id }, data: { email } });
      const contact = application.person.contacts[0];
      if (contact) await tx.personContact.update({ where: { id: contact.id }, data: { email, isPrimary: true } });
      else await tx.personContact.create({ data: { personId: application.person.id, email, phoneNumber: application.phone, isPrimary: true } });
      await tx.auditLog.create({ data: { userId: actorUserId, action: "PORTAL_ACCESS_EMAIL_CHANGED", entity: "MembershipApplication", entityId: String(applicationId), oldValues: { email: oldEmail }, newValues: { email, personId: application.person.id, userId: user?.id } } });
      return { userId: user?.id };
    });

    if (outcome.userId) await accountActivationService.createAndSendActivation(outcome.userId);
    else await new AssociateProvisioningService().provisionCompletedApplication(applicationId);
    return this.resolve(applicationId);
  }

  private async audit(actorUserId: number, action: string, applicationId: number, targetUserId?: number): Promise<void> {
    await prisma.auditLog.create({ data: { userId: actorUserId, action, entity: "MembershipApplication", entityId: String(applicationId), newValues: { applicationId, targetUserId } } });
  }
}

function errorResult(message: string, userId?: number, email?: string, role?: string): AssociateAccessResult {
  return { status: "ERROR", userId, email, role, canRetryProvisioning: false, canResendActivation: false, message };
}

export const associateAccessService = new AssociateAccessService();

function normalizeEmail(value: string): string | null {
  const email = value.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

function classifyConflict(
  applicationPerson: { documentType: string; documentNumber: string },
  detectedPerson: { documentType: string; documentNumber: string } | null,
): PortalAccessConflictClassification {
  if (!detectedPerson) return "INSUFFICIENT_EVIDENCE";
  if (applicationPerson.documentType !== detectedPerson.documentType || applicationPerson.documentNumber !== detectedPerson.documentNumber) return "DIFFERENT_IDENTITY";
  return "SAME_IDENTITY_CANDIDATE";
}
