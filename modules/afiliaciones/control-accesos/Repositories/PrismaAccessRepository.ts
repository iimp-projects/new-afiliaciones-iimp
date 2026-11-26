import { Prisma, ApplicationStatus } from "@prisma/client";
import type { AccessMovementSource, AccessMovementType, AccessValidationResult } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type MovementFilters = {
  siteId?: number;
  personId?: number;
  movementType?: AccessMovementType;
  validationResult?: AccessValidationResult;
  from?: Date;
  to?: Date;
};

export type EntryInput = {
  personId: number;
  cardId: string | null;
  siteId: number;
  accessPointId: number;
  source: AccessMovementSource;
  operatorId: number;
  idempotencyKey?: string;
  reasonCode: string;
  validationResult: AccessValidationResult;
};

export type ExitInput = {
  personId: number;
  siteId: number;
  accessPointId: number;
  source: AccessMovementSource;
  operatorId: number;
  idempotencyKey?: string;
  reasonCode: string;
  administrative: boolean;
};

const personMiniSelect = {
  id: true,
  firstName: true,
  paternalLastName: true,
  maternalLastName: true,
  associateCode: true,
  user: { select: { image: true } },
} satisfies Prisma.PersonSelect;

export class PrismaAccessRepository {
  findCardByToken(token: string) {
    return prisma.associateCard.findUnique({
      where: { verificationToken: token },
      select: { id: true, personId: true, status: true },
    });
  }

  findCardByPerson(personId: number) {
    return prisma.associateCard.findUnique({
      where: { personId },
      select: { id: true, personId: true, status: true },
    });
  }

  findSite(id: number) {
    return prisma.accessSite.findUnique({
      where: { id },
      select: { id: true, name: true, isActive: true },
    });
  }

  findPoint(id: number) {
    return prisma.accessPoint.findUnique({
      where: { id },
      select: { id: true, name: true, siteId: true, isActive: true, movementMode: true },
    });
  }

  findActivePolicy(siteId: number) {
    return prisma.accessPolicy.findFirst({
      where: { siteId, isActive: true },
      orderBy: { version: "desc" },
    });
  }

  findOpenSession(personId: number, siteId: number) {
    return prisma.accessSession.findFirst({
      where: { personId, siteId, status: "OPEN" },
      orderBy: { entryAt: "desc" },
      select: { id: true, entryAt: true, entryPoint: { select: { name: true } } },
    });
  }

  async isOperatorAssigned(userId: number, siteId: number, accessPointId: number): Promise<boolean> {
    const count = await prisma.accessOperatorAssignment.count({
      where: {
        userId,
        siteId,
        isActive: true,
        OR: [{ accessPointId: null }, { accessPointId }],
      },
    });
    return count > 0;
  }

  findMovementByKey(idempotencyKey: string) {
    return prisma.accessMovement.findUnique({
      where: { idempotencyKey },
      select: { id: true, sessionId: true, movementType: true, occurredAt: true, validationResult: true, reasonCode: true },
    });
  }

  async registerEntry(input: EntryInput) {
    return prisma.$transaction(async (tx) => {
      if (input.idempotencyKey) {
        const existing = await tx.accessMovement.findUnique({
          where: { idempotencyKey: input.idempotencyKey },
          select: { id: true, sessionId: true, movementType: true, occurredAt: true, validationResult: true, reasonCode: true },
        });
        if (existing) return { movement: existing, sessionId: existing.sessionId, reused: true };
      }

      const session = await tx.accessSession.create({
        data: {
          personId: input.personId,
          siteId: input.siteId,
          entryPointId: input.accessPointId,
          entryRegisteredBy: input.operatorId,
          status: "OPEN",
        },
        select: { id: true },
      });

      const movement = await tx.accessMovement.create({
        data: {
          personId: input.personId,
          cardId: input.cardId,
          siteId: input.siteId,
          accessPointId: input.accessPointId,
          sessionId: session.id,
          movementType: "ENTRY",
          validationResult: input.validationResult,
          reasonCode: input.reasonCode,
          source: input.source,
          registeredBy: input.operatorId,
          idempotencyKey: input.idempotencyKey ?? null,
        },
        select: { id: true, sessionId: true, movementType: true, occurredAt: true, validationResult: true, reasonCode: true },
      });

      await tx.auditLog.create({
        data: {
          userId: input.operatorId,
          action: "ACCESS_CHECK_IN",
          entity: "AccessMovement",
          entityId: movement.id,
          newValues: {
            personId: input.personId,
            siteId: input.siteId,
            accessPointId: input.accessPointId,
            sessionId: session.id,
            reasonCode: input.reasonCode,
            source: input.source,
          },
        },
      });

      return { movement, sessionId: session.id, reused: false };
    });
  }

  async registerExit(input: ExitInput) {
    return prisma.$transaction(async (tx) => {
      if (input.idempotencyKey) {
        const existing = await tx.accessMovement.findUnique({
          where: { idempotencyKey: input.idempotencyKey },
          select: { id: true, sessionId: true, movementType: true, occurredAt: true, validationResult: true, reasonCode: true },
        });
        if (existing) return { movement: existing, sessionId: existing.sessionId, reused: true };
      }

      const open = await tx.accessSession.findFirst({
        where: { personId: input.personId, siteId: input.siteId, status: "OPEN" },
        orderBy: { entryAt: "desc" },
        select: { id: true },
      });
      if (!open) return { movement: null, sessionId: null, reused: false };

      const closed = await tx.accessSession.updateMany({
        where: { id: open.id, status: "OPEN" },
        data: {
          exitAt: new Date(),
          exitPointId: input.accessPointId,
          exitRegisteredBy: input.operatorId,
          status: input.administrative ? "ADMINISTRATIVELY_CLOSED" : "CLOSED",
        },
      });
      if (closed.count === 0) return { movement: null, sessionId: open.id, reused: false };

      const movement = await tx.accessMovement.create({
        data: {
          personId: input.personId,
          siteId: input.siteId,
          accessPointId: input.accessPointId,
          sessionId: open.id,
          movementType: "EXIT",
          validationResult: "ALLOWED",
          reasonCode: input.reasonCode,
          source: input.source,
          registeredBy: input.operatorId,
          idempotencyKey: input.idempotencyKey ?? null,
        },
        select: { id: true, sessionId: true, movementType: true, occurredAt: true, validationResult: true, reasonCode: true },
      });

      await tx.auditLog.create({
        data: {
          userId: input.operatorId,
          action: "ACCESS_CHECK_OUT",
          entity: "AccessMovement",
          entityId: movement.id,
          newValues: {
            personId: input.personId,
            siteId: input.siteId,
            accessPointId: input.accessPointId,
            sessionId: open.id,
            administrative: input.administrative,
            source: input.source,
          },
        },
      });

      return { movement, sessionId: open.id, reused: false };
    });
  }

  async registerAdministrativeExit(input: {
    personId: number;
    siteId: number;
    accessPointId: number;
    operatorId: number;
    idempotencyKey?: string;
    reasonCode: string;
  }) {
    return prisma.$transaction(async (tx) => {
      if (input.idempotencyKey) {
        const existing = await tx.accessMovement.findUnique({
          where: { idempotencyKey: input.idempotencyKey },
          select: { id: true, sessionId: true, movementType: true, occurredAt: true, validationResult: true, reasonCode: true },
        });
        if (existing) return { movement: existing, sessionId: existing.sessionId, reused: true };
      }

      const movement = await tx.accessMovement.create({
        data: {
          personId: input.personId,
          siteId: input.siteId,
          accessPointId: input.accessPointId,
          sessionId: null,
          movementType: "EXIT",
          validationResult: "REVIEW_REQUIRED",
          reasonCode: input.reasonCode,
          source: "ADMIN_OVERRIDE",
          registeredBy: input.operatorId,
          idempotencyKey: input.idempotencyKey ?? null,
        },
        select: { id: true, sessionId: true, movementType: true, occurredAt: true, validationResult: true, reasonCode: true },
      });

      await tx.auditLog.create({
        data: {
          userId: input.operatorId,
          action: "ACCESS_ADMINISTRATIVE_EXIT",
          entity: "AccessMovement",
          entityId: movement.id,
          newValues: {
            personId: input.personId,
            siteId: input.siteId,
            accessPointId: input.accessPointId,
            reasonCode: input.reasonCode,
          },
        },
      });

      return { movement, sessionId: null, reused: false };
    });
  }

  async listSites() {
    return prisma.accessSite.findMany({
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
      select: { id: true, code: true, name: true, address: true, isActive: true, updatedAt: true },
    });
  }

  createSite(data: { code: string; name: string; address?: string | null; description?: string | null }) {
    return prisma.accessSite.create({ data });
  }

  updateSite(id: number, data: Prisma.AccessSiteUpdateInput) {
    return prisma.accessSite.update({ where: { id }, data });
  }

  async listPoints(siteId?: number) {
    return prisma.accessPoint.findMany({
      where: siteId ? { siteId } : undefined,
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
      select: { id: true, siteId: true, code: true, name: true, movementMode: true, isActive: true, updatedAt: true },
    });
  }

  createPoint(data: { siteId: number; code: string; name: string; description?: string | null; movementMode: "ENTRY" | "EXIT" | "BOTH" }) {
    return prisma.accessPoint.create({ data });
  }

  updatePoint(id: number, data: Prisma.AccessPointUpdateInput) {
    return prisma.accessPoint.update({ where: { id }, data });
  }

  listPolicies() {
    return prisma.accessPolicy.findMany({
      orderBy: [{ isActive: "desc" }, { updatedAt: "desc" }],
      include: { site: { select: { id: true, name: true } } },
    });
  }

  async upsertPolicy(data: {
    siteId: number;
    name: string;
    allowedMembershipCategories: string[] | null;
    requireActiveMembership: boolean;
    requireValidCard: boolean;
    quotaRestrictionEnabled: boolean;
    maxPendingQuotas: number | null;
    allowManualLookup: boolean;
  }) {
    const values = {
      name: data.name,
      allowedMembershipCategories: data.allowedMembershipCategories === null ? Prisma.DbNull : data.allowedMembershipCategories,
      requireActiveMembership: data.requireActiveMembership,
      requireValidCard: data.requireValidCard,
      quotaRestrictionEnabled: data.quotaRestrictionEnabled,
      maxPendingQuotas: data.maxPendingQuotas,
      allowManualLookup: data.allowManualLookup,
    };
    const current = await prisma.accessPolicy.findFirst({ where: { siteId: data.siteId, isActive: true } });
    if (current) {
      return prisma.accessPolicy.update({ where: { id: current.id }, data: { ...values, version: { increment: 1 } } });
    }
    return prisma.accessPolicy.create({ data: { siteId: data.siteId, ...values } });
  }

  listOperatorAssignments(siteId?: number) {
    return prisma.accessOperatorAssignment.findMany({
      where: siteId ? { siteId } : undefined,
      orderBy: { updatedAt: "desc" },
      include: {
        user: { select: { id: true, name: true, email: true } },
        site: { select: { id: true, name: true } },
        accessPoint: { select: { id: true, name: true } },
      },
    });
  }

  createOperatorAssignment(data: { userId: number; siteId: number; accessPointId?: number | null; isActive: boolean }) {
    return prisma.accessOperatorAssignment.create({
      data: { userId: data.userId, siteId: data.siteId, accessPointId: data.accessPointId ?? null, isActive: data.isActive },
    });
  }

  async searchPersons(query: string, limit: number) {
    return prisma.person.findMany({
      where: {
        deletedAt: null,
        OR: [
          { firstName: { contains: query, mode: "insensitive" } },
          { paternalLastName: { contains: query, mode: "insensitive" } },
          { maternalLastName: { contains: query, mode: "insensitive" } },
          { associateCode: { contains: query, mode: "insensitive" } },
          { documentNumber: { contains: query } },
        ],
      },
      select: {
        ...personMiniSelect,
        applications: {
          where: { status: ApplicationStatus.COMPLETED, deletedAt: null },
          orderBy: { updatedAt: "desc" },
          take: 1,
          select: {
            affiliateType: true,
            documents: {
              where: { mimeType: { startsWith: "image/" } },
              orderBy: { updatedAt: "desc" },
              take: 1,
              select: { fileUrl: true },
            },
          },
        },
        sieAssociateRecords: {
          take: 1,
          orderBy: { lastSyncedAt: "desc" },
          select: { externalCode: true, category: { select: { name: true, mappedAffiliateType: true } } },
        },
      },
      take: limit,
      orderBy: [{ paternalLastName: "asc" }, { firstName: "asc" }],
    });
  }

  async listMovements(filters: MovementFilters, page: number, pageSize: number) {
    const where: Prisma.AccessMovementWhereInput = {
      ...(filters.siteId ? { siteId: filters.siteId } : {}),
      ...(filters.personId ? { personId: filters.personId } : {}),
      ...(filters.movementType ? { movementType: filters.movementType } : {}),
      ...(filters.validationResult ? { validationResult: filters.validationResult } : {}),
      ...(filters.from || filters.to
        ? { occurredAt: { ...(filters.from ? { gte: filters.from } : {}), ...(filters.to ? { lte: filters.to } : {}) } }
        : {}),
    };
    const [total, rows] = await Promise.all([
      prisma.accessMovement.count({ where }),
      prisma.accessMovement.findMany({
        where,
        orderBy: { occurredAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          person: { select: personMiniSelect },
          site: { select: { id: true, name: true } },
          accessPoint: { select: { id: true, name: true } },
          registeredByUser: { select: { name: true, email: true } },
        },
      }),
    ]);
    return { total, rows };
  }

  async exportMovements(filters: MovementFilters, maxRows: number) {
    const where: Prisma.AccessMovementWhereInput = {
      ...(filters.siteId ? { siteId: filters.siteId } : {}),
      ...(filters.personId ? { personId: filters.personId } : {}),
      ...(filters.movementType ? { movementType: filters.movementType } : {}),
      ...(filters.validationResult ? { validationResult: filters.validationResult } : {}),
      ...(filters.from || filters.to
        ? { occurredAt: { ...(filters.from ? { gte: filters.from } : {}), ...(filters.to ? { lte: filters.to } : {}) } }
        : {}),
    };
    return prisma.accessMovement.findMany({
      where,
      orderBy: { occurredAt: "desc" },
      take: maxRows,
      include: {
        person: { select: personMiniSelect },
        site: { select: { name: true } },
        accessPoint: { select: { name: true } },
        registeredByUser: { select: { name: true } },
      },
    });
  }

  async listPresence(filters: { siteId?: number }, page: number, pageSize: number) {
    const where: Prisma.AccessSessionWhereInput = {
      status: "OPEN",
      ...(filters.siteId ? { siteId: filters.siteId } : {}),
    };
    const [total, rows] = await Promise.all([
      prisma.accessSession.count({ where }),
      prisma.accessSession.findMany({
        where,
        orderBy: { entryAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          person: { select: personMiniSelect },
          site: { select: { id: true, name: true } },
          entryPoint: { select: { id: true, name: true } },
        },
      }),
    ]);
    return { total, rows };
  }

  async dashboard(siteId?: number) {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    const base: Prisma.AccessMovementWhereInput = {
      occurredAt: { gte: start, lt: end },
      ...(siteId ? { siteId } : {}),
    };
    const [entries, exits, denied, review, open] = await Promise.all([
      prisma.accessMovement.count({ where: { ...base, movementType: "ENTRY", validationResult: "ALLOWED" } }),
      prisma.accessMovement.count({ where: { ...base, movementType: "EXIT", validationResult: "ALLOWED" } }),
      prisma.accessMovement.count({ where: { ...base, validationResult: "DENIED" } }),
      prisma.accessMovement.count({ where: { ...base, validationResult: "REVIEW_REQUIRED" } }),
      prisma.accessSession.count({ where: { status: "OPEN", ...(siteId ? { siteId } : {}) } }),
    ]);
    return { entries, exits, denied, review, open, since: start.toISOString() };
  }
}

export const prismaAccessRepository = new PrismaAccessRepository();
