import { ApplicationStatus, SieLinkStatus, UserStatus, UserType, type PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isValidEmail } from "../Services/Import/EmailProcessing";
import type { AssociateExcludedItem, AssociateRecipientCandidate, AssociateSourceFilter } from "../Models/AssociateRecipient";

const ROLE_SLUGS: Record<AssociateSourceFilter, string[]> = {
  ALL: ["ASOCIADO_ACTIVO", "ASOCIADO_ESTUDIANTE"],
  ACTIVE: ["ASOCIADO_ACTIVO"],
  STUDENT: ["ASOCIADO_ESTUDIANTE"],
};

export interface AssociateAccessSnapshot {
  id: number;
  email: string;
  status: UserStatus;
  deletedAt: Date | null;
  roleSlug: string | null;
}

export class AssociateRecipientRepository {
  constructor(private readonly db: PrismaClient = prisma) {}

  async countEligible(filter: AssociateSourceFilter): Promise<number> {
    return this.db.user.count({ where: this.eligibleWhere(filter) });
  }

  async listEligible(filter: AssociateSourceFilter, skip: number, take: number): Promise<AssociateRecipientCandidate[]> {
    const rows = await this.db.user.findMany({
      where: this.eligibleWhere(filter),
      orderBy: { id: "asc" },
      skip,
      take,
      select: {
        id: true,
        email: true,
        status: true,
        role: { select: { slug: true } },
        person: { select: { id: true, firstName: true, paternalLastName: true, maternalLastName: true, documentNumber: true } },
      },
    });
    return rows.map((row) => ({
      userId: row.id,
      personId: row.person?.id ?? null,
      nombreCompleto: [row.person?.firstName, row.person?.paternalLastName, row.person?.maternalLastName].filter(Boolean).join(" ").trim(),
      correoAcceso: row.email.trim().toLowerCase(),
      tipoAsociado: row.role?.slug === "ASOCIADO_ESTUDIANTE" ? "ESTUDIANTE" : "ACTIVO",
      accountStatus: row.status === UserStatus.ACTIVE ? "ACTIVE" : "PENDING",
      documentNumber: row.person?.documentNumber ?? null,
    }));
  }

  /** Devuelve el estado actual de acceso de una cuenta (para revalidación al enviar). */
  async getUserAccess(userId: number): Promise<AssociateAccessSnapshot | null> {
    const row = await this.db.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, status: true, deletedAt: true, role: { select: { slug: true } } },
    });
    if (!row) return null;
    return { id: row.id, email: row.email, status: row.status, deletedAt: row.deletedAt, roleSlug: row.role?.slug ?? null };
  }

  /**
   * Reporte de asociados excluidos para revisión. Se deriva de:
   *  1. Postulaciones COMPLETADAS cuya persona no tiene cuenta de acceso elegible.
   *  2. Cuentas de rol asociado con correo inválido (NO_ACCESS_EMAIL) o type≠AFFILIATE.
   *  3. Registros SIE: CONFLICT, LINKED sin cuenta y UNLINKED (deduplicados).
   */
  async listExcluded(limit = 500): Promise<{ items: AssociateExcludedItem[]; total: number }> {
    const items: AssociateExcludedItem[] = [];
    const seen = new Set<string>();
    const push = (item: AssociateExcludedItem, key: string): void => {
      if (seen.has(key)) return;
      seen.add(key);
      items.push(item);
    };

    const applications = await this.db.membershipApplication.findMany({
      where: { status: ApplicationStatus.COMPLETED, deletedAt: null },
      select: {
        email: true,
        person: {
          select: {
            id: true,
            documentNumber: true,
            firstName: true,
            paternalLastName: true,
            maternalLastName: true,
            contacts: { where: { email: { not: null } }, orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }], take: 1, select: { email: true } },
            user: { select: { id: true, deletedAt: true, status: true, type: true, role: { select: { slug: true } } } },
          },
        },
      },
    });

    for (const application of applications) {
      const person = application.person;
      if (!person) continue;
      const user = person.user;
      const contactEmail = person.contacts[0]?.email ?? application.email;
      const nombre = personName(person.firstName, person.paternalLastName, person.maternalLastName);
      if (!user || user.deletedAt) {
        push({ personId: person.id, documentNumber: person.documentNumber, nombre, correoContacto: contactEmail, reason: "NO_ACCOUNT" }, `person:${person.id}`);
        continue;
      }
      const eligible = user.type === UserType.AFFILIATE && (user.role?.slug === "ASOCIADO_ACTIVO" || user.role?.slug === "ASOCIADO_ESTUDIANTE") && (user.status === UserStatus.ACTIVE || user.status === UserStatus.PENDING);
      if (!eligible) {
        push({ personId: person.id, documentNumber: person.documentNumber, nombre, correoContacto: contactEmail, reason: "NOT_ELIGIBLE_ACCOUNT" }, `person:${person.id}`);
      }
    }

    // Cuentas de rol asociado que no serían elegibles: email inválido o type≠AFFILIATE.
    const accountUsers = await this.db.user.findMany({
      where: { role: { slug: { in: ["ASOCIADO_ACTIVO", "ASOCIADO_ESTUDIANTE"] } }, deletedAt: null, status: { in: [UserStatus.ACTIVE, UserStatus.PENDING] } },
      select: { id: true, email: true, type: true, person: { select: { id: true, documentNumber: true, firstName: true, paternalLastName: true, maternalLastName: true } } },
    });
    for (const account of accountUsers) {
      const key = account.person ? `person:${account.person.id}` : `user:${account.id}`;
      const nombre = personName(account.person?.firstName, account.person?.paternalLastName, account.person?.maternalLastName);
      const documentNumber = account.person?.documentNumber ?? null;
      if (account.type !== UserType.AFFILIATE) {
        push({ personId: account.person?.id ?? null, documentNumber, nombre, correoContacto: account.email, reason: "NOT_ELIGIBLE_ACCOUNT" }, key);
      } else if (!isValidEmail(account.email.trim().toLowerCase())) {
        push({ personId: account.person?.id ?? null, documentNumber, nombre, correoContacto: account.email, reason: "NO_ACCESS_EMAIL" }, key);
      }
    }

    const conflicts = await this.db.sieAssociateRecord.findMany({
      where: { linkStatus: SieLinkStatus.CONFLICT },
      select: { personId: true, documentNumber: true, person: { select: { firstName: true, paternalLastName: true, maternalLastName: true, contacts: { where: { email: { not: null } }, take: 1, select: { email: true } } } } },
    });
    for (const record of conflicts) {
      const key = `sie:${record.personId ?? record.documentNumber}`;
      if (seen.has(key)) continue;
      push({ personId: record.personId, documentNumber: record.documentNumber, nombre: personName(record.person?.firstName, record.person?.paternalLastName, record.person?.maternalLastName), correoContacto: record.person?.contacts[0]?.email ?? null, reason: "CONFLICT" }, key);
    }

    const unprovisionedSie = await this.db.sieAssociateRecord.findMany({
      where: { linkStatus: SieLinkStatus.LINKED },
      select: {
        personId: true,
        documentNumber: true,
        person: {
          select: {
            firstName: true,
            paternalLastName: true,
            maternalLastName: true,
            contacts: { where: { email: { not: null } }, take: 1, select: { email: true } },
            user: { select: { id: true, deletedAt: true, status: true, type: true, role: { select: { slug: true } } } },
          },
        },
      },
    });
    for (const record of unprovisionedSie) {
      const person = record.person;
      if (!person) continue;
      const user = person.user;
      const eligible = user && !user.deletedAt && user.type === UserType.AFFILIATE && (user.role?.slug === "ASOCIADO_ACTIVO" || user.role?.slug === "ASOCIADO_ESTUDIANTE") && (user.status === UserStatus.ACTIVE || user.status === UserStatus.PENDING);
      if (!eligible) {
        push({ personId: record.personId, documentNumber: record.documentNumber, nombre: personName(person.firstName, person.paternalLastName, person.maternalLastName), correoContacto: person.contacts[0]?.email ?? null, reason: "NO_ACCOUNT" }, `person:${record.personId}`);
      }
    }

    const unlinkedSie = await this.db.sieAssociateRecord.findMany({
      where: { linkStatus: SieLinkStatus.UNLINKED },
      select: { externalCode: true, personId: true, documentNumber: true, person: { select: { firstName: true, paternalLastName: true, maternalLastName: true, contacts: { where: { email: { not: null } }, take: 1, select: { email: true } } } } },
    });
    for (const record of unlinkedSie) {
      push({ personId: record.personId, documentNumber: record.documentNumber, nombre: personName(record.person?.firstName, record.person?.paternalLastName, record.person?.maternalLastName), correoContacto: record.person?.contacts[0]?.email ?? null, reason: "UNLINKED" }, `sie-unlinked:${record.externalCode}`);
    }

    return { items: items.slice(0, limit), total: items.length };
  }

  private eligibleWhere(filter: AssociateSourceFilter) {
    return {
      type: UserType.AFFILIATE,
      deletedAt: null,
      status: { in: [UserStatus.ACTIVE, UserStatus.PENDING] },
      role: { slug: { in: ROLE_SLUGS[filter] } },
    };
  }
}

function personName(firstName?: string | null, paternalLastName?: string | null, maternalLastName?: string | null): string | null {
  const value = [firstName, paternalLastName, maternalLastName].filter(Boolean).join(" ").trim();
  return value || null;
}
