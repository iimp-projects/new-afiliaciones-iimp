import { OperationalAlertStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { OPERATIONAL_ALERTS_CUTOFF_DATE } from "../Config/operationalAlerts.config";

export class OperationalAlertManagementError extends Error {
  constructor(message: string, readonly status = 409) { super(message); }
}

export class OperationalAlertManagementService {
  async listCenter(input: { page: number; pageSize: number; search?: string; status?: OperationalAlertStatus; severity?: string; type?: string; applicationId?: number; assignedUserId?: number | "UNASSIGNED" }) {
    const where: Prisma.OperationalAlertTrackingWhereInput = { application: { createdAt: { gte: OPERATIONAL_ALERTS_CUTOFF_DATE } } };
    if (input.status) where.status = input.status;
    if (input.severity) where.severity = input.severity;
    if (input.type) where.type = input.type;
    if (input.applicationId) where.applicationId = input.applicationId;
    if (input.assignedUserId === "UNASSIGNED") where.assignedUserId = null;
    else if (typeof input.assignedUserId === "number") where.assignedUserId = input.assignedUserId;
    if (input.search?.trim()) {
      const term = input.search.trim();
      where.OR = [
        { alertKey: { contains: term, mode: "insensitive" } },
        { application: { applicationCode: { contains: term, mode: "insensitive" } } },
        { application: { person: { is: { OR: [
          { firstName: { contains: term, mode: "insensitive" } },
          { paternalLastName: { contains: term, mode: "insensitive" } },
          { documentNumber: { contains: term, mode: "insensitive" } },
        ] } } } },
      ];
    }
    const [total, data, byStatus, bySeverity] = await Promise.all([
      prisma.operationalAlertTracking.count({ where }),
      prisma.operationalAlertTracking.findMany({ where, orderBy: [{ severity: "asc" }, { lastDetectedAt: "desc" }], skip: (input.page - 1) * input.pageSize, take: input.pageSize, include: { application: { select: { applicationCode: true, person: { select: { firstName: true, paternalLastName: true, documentNumber: true } } } }, assignedUser: { select: { id: true, name: true, image: true } } } }),
      prisma.operationalAlertTracking.groupBy({ by: ["status"], where: { application: { createdAt: { gte: OPERATIONAL_ALERTS_CUTOFF_DATE } } }, _count: { _all: true } }),
      prisma.operationalAlertTracking.groupBy({ by: ["severity"], where: { application: { createdAt: { gte: OPERATIONAL_ALERTS_CUTOFF_DATE } } }, _count: { _all: true } }),
    ]);
    const count = (items: Array<{ [key: string]: unknown; _count: { _all: number } }>, key: string, value: string) => items.find((item) => item[key] === value)?._count._all ?? 0;
    return { data, pagination: { page: input.page, pageSize: input.pageSize, total, totalPages: Math.max(1, Math.ceil(total / input.pageSize)) }, summary: { total: byStatus.reduce((sum, item) => sum + item._count._all, 0), active: count(byStatus, "status", OperationalAlertStatus.ACTIVE), inProgress: count(byStatus, "status", OperationalAlertStatus.IN_PROGRESS), resolved: count(byStatus, "status", OperationalAlertStatus.RESOLVED), critical: count(bySeverity, "severity", "CRITICAL"), warning: count(bySeverity, "severity", "WARNING") } };
  }

  async listEligibleAssignees() {
    const users = await prisma.user.findMany({
      where: { status: "ACTIVE", role: { is: { isActive: true } } },
      select: { id: true, name: true, role: { select: { rolePermissions: { where: { permission: { isActive: true } }, select: { permission: { select: { action: true, subject: true } } } } } } },
      orderBy: { name: "asc" },
    });
    return users.filter((user) => (user.role?.rolePermissions ?? []).some(({ permission }) => permission.action === "manage" && permission.subject === "all" || permission.action === "update" && permission.subject === "memberships")).map(({ id, name }) => ({ id, name: name ?? `Usuario #${id}` }));
  }
  async takeAlert(id: number, actorUserId: number) {
    return prisma.$transaction(async (tx) => {
      const result = await tx.operationalAlertTracking.updateMany({ where: { id, status: OperationalAlertStatus.ACTIVE, assignedUserId: null }, data: { status: OperationalAlertStatus.IN_PROGRESS, assignedUserId: actorUserId, assignedAt: new Date() } });
      if (result.count !== 1) throw new OperationalAlertManagementError("La alerta ya fue tomada o no está disponible.");
      const alert = await tx.operationalAlertTracking.findUniqueOrThrow({ where: { id } });
      await tx.auditLog.create({ data: { userId: actorUserId, action: "OPERATIONAL_ALERT_TAKEN", entity: "OperationalAlertTracking", entityId: String(id), newValues: { applicationId: alert.applicationId, alertKey: alert.alertKey, assignedUserId: actorUserId } } });
      return alert;
    });
  }

  async assignAlert(id: number, assignedUserId: number, actorUserId: number) {
    return prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({ where: { id: assignedUserId }, select: { id: true, status: true, role: { select: { isActive: true, rolePermissions: { where: { permission: { isActive: true } }, select: { permission: { select: { action: true, subject: true } } } } } } } });
      if (!user || user.status !== "ACTIVE") throw new OperationalAlertManagementError("El responsable no está activo.", 422);
      const permissions = new Set(user.role?.rolePermissions.map(({ permission }) => `${permission.action}:${permission.subject}`));
      if (!permissions?.has("manage:all") && !permissions?.has("update:memberships")) throw new OperationalAlertManagementError("El responsable no tiene permisos para gestionar alertas.", 422);
      const current = await tx.operationalAlertTracking.findUnique({ where: { id } });
      if (!current || current.status === OperationalAlertStatus.RESOLVED) throw new OperationalAlertManagementError("La alerta no está disponible.", 404);
      const action = current.assignedUserId ? "OPERATIONAL_ALERT_REASSIGNED" : "OPERATIONAL_ALERT_ASSIGNED";
      const alert = await tx.operationalAlertTracking.update({ where: { id }, data: { status: OperationalAlertStatus.IN_PROGRESS, assignedUserId, assignedAt: new Date() } });
      await tx.auditLog.create({ data: { userId: actorUserId, action, entity: "OperationalAlertTracking", entityId: String(id), oldValues: { assignedUserId: current.assignedUserId }, newValues: { applicationId: alert.applicationId, alertKey: alert.alertKey, assignedUserId } } });
      return alert;
    });
  }

  async unassignAlert(id: number, actorUserId: number) {
    const alert = await prisma.operationalAlertTracking.update({ where: { id }, data: { status: OperationalAlertStatus.ACTIVE, assignedUserId: null, assignedAt: null } });
    await prisma.auditLog.create({ data: { userId: actorUserId, action: "OPERATIONAL_ALERT_UNASSIGNED", entity: "OperationalAlertTracking", entityId: String(id), newValues: { applicationId: alert.applicationId, alertKey: alert.alertKey } } });
    return alert;
  }

  async resolveAlert(id: number, actorUserId: number) {
    return prisma.$transaction(async (tx) => {
      const current = await tx.operationalAlertTracking.findUnique({ where: { id } });
      if (!current) throw new OperationalAlertManagementError("La alerta no existe.", 404);
      if (current.status === OperationalAlertStatus.RESOLVED) throw new OperationalAlertManagementError("La alerta ya está resuelta.", 409);
      const alert = await tx.operationalAlertTracking.update({ where: { id }, data: { status: OperationalAlertStatus.RESOLVED, resolvedAt: new Date(), resolvedByUserId: actorUserId } });
      await tx.auditLog.create({ data: { userId: actorUserId, action: "OPERATIONAL_ALERT_MANUALLY_RESOLVED", entity: "OperationalAlertTracking", entityId: String(id), newValues: { applicationId: alert.applicationId, alertKey: alert.alertKey } } });
      return alert;
    });
  }

  async addNote(id: number, contentInput: string, actorUserId: number) {
    const content = contentInput.trim(); if (!content || content.length > 4000) throw new OperationalAlertManagementError("La nota debe contener entre 1 y 4000 caracteres.", 422);
    return prisma.$transaction(async (tx) => { const note = await tx.operationalAlertNote.create({ data: { alertTrackingId: id, authorUserId: actorUserId, content } }); await tx.auditLog.create({ data: { userId: actorUserId, action: "OPERATIONAL_ALERT_NOTE_ADDED", entity: "OperationalAlertTracking", entityId: String(id), newValues: { noteId: note.id } } }); return note; });
  }

  async getAlertDetail(id: number) { return prisma.operationalAlertTracking.findUnique({ where: { id }, include: { application: { select: { applicationCode: true, affiliateType: true, person: { select: { firstName: true, paternalLastName: true } } } }, assignedUser: { select: { id: true, name: true, image: true } }, notes: { orderBy: { createdAt: "asc" }, include: { author: { select: { id: true, name: true, image: true } } } } } }); }
}
export const operationalAlertManagementService = new OperationalAlertManagementService();
