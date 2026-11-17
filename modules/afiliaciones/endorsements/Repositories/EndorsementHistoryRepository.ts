import type { ApplicationStatus, EndorsementStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  APPROVED_APPLICATION_STATUSES,
  IN_PROCESS_APPLICATION_STATUSES,
  type EndorsementHistoryFilters,
  type EndorsementHistoryItem,
  type EndorsementHistoryMetrics,
} from "../Models/MyEndorsement";

type ApprovalRow = {
  id: number;
  status: EndorsementStatus;
  createdAt: Date;
  application: {
    status: ApplicationStatus;
    applicationCode: string;
    affiliateType: string;
    person: {
      firstName: string;
      paternalLastName: string;
      maternalLastName: string | null;
    } | null;
  };
};

/**
 * Persistencia de "Mis avales".
 *
 * Todas las consultas se filtran por `sponsorPersonId` (identificador interno
 * de la persona del asociado autenticado), nunca por correo. Se apoya en un
 * único `include` sobre `MembershipApproval` para evitar N+1.
 */
export class EndorsementHistoryRepository {
  constructor(private readonly db = prisma) {}

  /** Resuelve el `Person.id` vinculado a la cuenta autenticada. */
  async personIdForUser(userId: number): Promise<number | null> {
    const account = await this.db.user.findUnique({
      where: { id: userId },
      select: { personId: true },
    });
    return account?.personId ?? null;
  }

  /** Página de avales otorgados, con conteo total bajo los mismos filtros. */
  async list(
    personId: number,
    filters: EndorsementHistoryFilters,
  ): Promise<{ items: EndorsementHistoryItem[]; totalItems: number }> {
    const where = buildWhere(personId, filters);
    const [rows, totalItems] = await Promise.all([
      this.db.membershipApproval.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (filters.page - 1) * filters.pageSize,
        take: filters.pageSize,
        select: {
          id: true,
          status: true,
          createdAt: true,
          application: {
            select: {
              status: true,
              applicationCode: true,
              affiliateType: true,
              person: {
                select: { firstName: true, paternalLastName: true, maternalLastName: true },
              },
            },
          },
        },
      }),
      this.db.membershipApproval.count({ where }),
    ]);
    return { items: rows.map(toItem), totalItems };
  }

  /**
   * Indicadores globales (independientes de los filtros de la tabla):
   * total de avales, solicitudes aprobadas y solicitudes en proceso. Los
   * denominadores por expediente usan `distinct` a través de `approvals.some`,
   * de modo que un mismo expediente no se cuenta dos veces.
   */
  async metrics(personId: number): Promise<EndorsementHistoryMetrics> {
    const applicationScope = {
      deletedAt: null,
      approvals: { some: { sponsorPersonId: personId } },
    } satisfies Prisma.MembershipApplicationWhereInput;

    const [total, approved, inProcess] = await Promise.all([
      this.db.membershipApproval.count({
        where: { sponsorPersonId: personId, application: { is: { deletedAt: null } } },
      }),
      this.db.membershipApplication.count({
        where: {
          ...applicationScope,
          status: { in: APPROVED_APPLICATION_STATUSES as ApplicationStatus[] },
        },
      }),
      this.db.membershipApplication.count({
        where: {
          ...applicationScope,
          status: { in: IN_PROCESS_APPLICATION_STATUSES as ApplicationStatus[] },
        },
      }),
    ]);

    return { total, approved, inProcess };
  }
}

function buildWhere(
  personId: number,
  filters: EndorsementHistoryFilters,
): Prisma.MembershipApprovalWhereInput {
  const search = filters.search?.trim();
  return {
    sponsorPersonId: personId,
    ...(filters.from || filters.to
      ? {
          createdAt: {
            ...(filters.from ? { gte: filters.from } : {}),
            ...(filters.to ? { lte: filters.to } : {}),
          },
        }
      : {}),
    application: {
      is: {
        deletedAt: null,
        ...(filters.status ? { status: filters.status as ApplicationStatus } : {}),
        ...(search
          ? {
              OR: [
                { person: { is: { firstName: { contains: search, mode: "insensitive" as const } } } },
                { person: { is: { paternalLastName: { contains: search, mode: "insensitive" as const } } } },
                { person: { is: { maternalLastName: { contains: search, mode: "insensitive" as const } } } },
              ],
            }
          : {}),
      },
    },
  };
}

function toItem(row: ApprovalRow): EndorsementHistoryItem {
  const person = row.application.person;
  const applicantName = person
    ? [person.firstName, person.paternalLastName, person.maternalLastName]
        .filter(Boolean)
        .join(" ")
    : "Postulante";
  return {
    id: row.id,
    applicantName,
    affiliateType: row.application.affiliateType,
    endorsementStatus: row.status,
    endorsementDate: row.createdAt.toISOString(),
    applicationStatus: row.application.status,
    applicationCode: row.application.applicationCode,
  };
}
