import { AffiliateType, ApplicationStatus, SieLinkStatus, UserStatus, UserType, type PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isValidEmail } from "../Services/Import/EmailProcessing";
import type { AssociateExcludedItem, AssociateIdentity, AssociateRecipientCandidate, AssociateSourceFilter } from "../Models/AssociateRecipient";

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

  /** Total real de elegibles con correo de acceso válido (utilizables para envío). */
  async countEligibleValid(filter: AssociateSourceFilter): Promise<number> {
    const slugs = ROLE_SLUGS[filter].map((slug) => `'${slug}'`).join(",");
    const rows = await this.db.$queryRawUnsafe<Array<{ count: number }>>(
      `SELECT COUNT(*)::int AS count
       FROM auth_users u
       JOIN auth_roles r ON r.id = u.role_id
       WHERE u.type = 'AFFILIATE' AND u.deleted_at IS NULL
         AND u.status IN ('ACTIVE','PENDING')
         AND r.slug IN (${slugs})
         AND u.email ~ '^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$'`,
    );
    return Number(rows[0]?.count ?? 0);
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
   * Devuelve la identidad completa de un asociado (usuario + persona) para
   * reconstruir el contexto de personalización desde `userId`, sin depender del
   * snapshot de campaña. Revalida nombre y correo de acceso contra la fuente.
   */
  async getAssociateIdentity(userId: number): Promise<AssociateIdentity | null> {
    const row = await this.db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        status: true,
        deletedAt: true,
        role: { select: { slug: true } },
        person: { select: { id: true, firstName: true, paternalLastName: true, maternalLastName: true, documentNumber: true } },
      },
    });
    if (!row) return null;
    return {
      userId: row.id,
      personId: row.person?.id ?? null,
      email: row.email,
      status: row.status,
      deletedAt: row.deletedAt,
      roleSlug: row.role?.slug ?? null,
      nombreCompleto: personName(row.person?.firstName, row.person?.paternalLastName, row.person?.maternalLastName),
      documentNumber: row.person?.documentNumber ?? null,
    };
  }

  /**
   * Reporte de exclusiones. Separa:
   *  - Asociados a revisar (A/E sin cuenta elegible, correo inválido, type≠AFFILIATE,
   *    conflicto A/E, sin vincular A/E). Respeta el filtro de membresía.
   *  - Registros SIE de categorías NO-login (Fallecido, Honorario, Renunciante,
   *    Adherente, Anulado, Vitalicio, Separado) que NO son activos ni estudiantes.
   */
  async listExcluded(filter: AssociateSourceFilter, limit = 500): Promise<{ items: AssociateExcludedItem[]; total: number; byReason: Record<string, number>; nonAssociate: number }> {
    const items: AssociateExcludedItem[] = [];
    const seen = new Set<string>();
    const byReason: Record<string, number> = {};
    let nonAssociate = 0;
    const nonAssociateSeen = new Set<string>();

    const push = (item: AssociateExcludedItem, key: string): void => {
      if (seen.has(key)) return;
      seen.add(key);
      items.push(item);
      byReason[item.reason] = (byReason[item.reason] ?? 0) + 1;
    };
    const pushNonAssociate = (key: string): void => {
      if (nonAssociateSeen.has(key)) return;
      nonAssociateSeen.add(key);
      nonAssociate += 1;
    };

    const affiliateTypes: AffiliateType[] = filter === "ALL" ? [AffiliateType.ACTIVE, AffiliateType.STUDENT] : [filter as AffiliateType];
    const roleSlugs = ROLE_SLUGS[filter];

    // 1. Postulaciones COMPLETADAS (del filtro) sin cuenta de acceso elegible.
    const applications = await this.db.membershipApplication.findMany({
      where: { status: ApplicationStatus.COMPLETED, deletedAt: null, affiliateType: { in: affiliateTypes } },
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

    // 2. Cuentas del filtro con correo inválido o type≠AFFILIATE.
    const accountUsers = await this.db.user.findMany({
      where: { role: { slug: { in: roleSlugs } }, deletedAt: null, status: { in: [UserStatus.ACTIVE, UserStatus.PENDING] } },
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

    // 3. Registros SIE: separar categorías login (A/E) de NO-login.
    const sie = await this.db.sieAssociateRecord.findMany({
      select: {
        id: true,
        linkStatus: true,
        personId: true,
        documentNumber: true,
        externalCode: true,
        category: { select: { allowsLogin: true } },
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
    for (const record of sie) {
      const person = record.person;
      const user = person?.user;
      const eligible = user && !user.deletedAt && user.type === UserType.AFFILIATE && (user.role?.slug === "ASOCIADO_ACTIVO" || user.role?.slug === "ASOCIADO_ESTUDIANTE") && (user.status === UserStatus.ACTIVE || user.status === UserStatus.PENDING);
      const nombre = personName(person?.firstName, person?.paternalLastName, person?.maternalLastName);
      const contactEmail = person?.contacts[0]?.email ?? null;
      const isLoginCategory = record.category?.allowsLogin === true;

      if (record.linkStatus === SieLinkStatus.LINKED) {
        if (eligible) continue;
        if (isLoginCategory) {
          push({ personId: record.personId, documentNumber: record.documentNumber, nombre, correoContacto: contactEmail, reason: "NO_ACCOUNT" }, `person:${record.personId}`);
        } else {
          pushNonAssociate(`person:${record.personId}`);
        }
      } else if (record.linkStatus === SieLinkStatus.CONFLICT) {
        if (isLoginCategory) {
          push({ personId: record.personId, documentNumber: record.documentNumber, nombre, correoContacto: contactEmail, reason: "CONFLICT" }, `sie:${record.personId ?? record.documentNumber}`);
        } else {
          pushNonAssociate(`conflict:${record.id}`);
        }
      } else if (record.linkStatus === SieLinkStatus.UNLINKED) {
        if (isLoginCategory) {
          push({ personId: record.personId, documentNumber: record.documentNumber, nombre, correoContacto: contactEmail, reason: "UNLINKED" }, `sie-unlinked:${record.externalCode}`);
        } else {
          pushNonAssociate(`unlinked:${record.externalCode}`);
        }
      }
    }

    return { items: items.slice(0, limit), total: items.length, byReason, nonAssociate };
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
