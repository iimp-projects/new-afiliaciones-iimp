import { OperationalAlertStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { operationalAlertsService, type OperationalAlert } from "./OperationalAlertsService";
import { OPERATIONAL_ALERTS_CUTOFF_DATE } from "../Config/operationalAlerts.config";

const openStatuses: OperationalAlertStatus[] = [OperationalAlertStatus.ACTIVE, OperationalAlertStatus.IN_PROGRESS];
const BATCH_SIZE = 100;
type Tracking = { id: number; alertKey: string; applicationId: number; type: string; severity: string; status: OperationalAlertStatus; application?: { createdAt: Date } };
type Audit = Prisma.AuditLogCreateManyInput;

const batches = <T>(items: T[]) => Array.from({ length: Math.ceil(items.length / BATCH_SIZE) }, (_, index) => items.slice(index * BATCH_SIZE, (index + 1) * BATCH_SIZE));
const audit = (action: string, row: Pick<Tracking, "id" | "applicationId" | "alertKey">): Audit => ({ action, entity: "OperationalAlertTracking", entityId: String(row.id), newValues: { applicationId: row.applicationId, alertKey: row.alertKey } });

export class OperationalAlertTrackingService {
  async synchronize() {
    const startedAt = Date.now();
    // Detection and the complete tracking preload intentionally happen before writes.
    const detected = await operationalAlertsService.detectAll();
    const detectedByKey = new Map(detected.map((alert) => [alert.id, alert]));
    const existingRows = await prisma.operationalAlertTracking.findMany({ where: { OR: [{ alertKey: { in: [...detectedByKey.keys()] } }, { status: { in: openStatuses } }] }, include: { application: { select: { createdAt: true } } } }) as Tracking[];
    const existingByKey = new Map(existingRows.map((row) => [row.alertKey, row]));
    const toCreate = detected.filter((alert) => !existingByKey.has(alert.id));
    const toReopen = detected.filter((alert) => existingByKey.get(alert.id)?.status === OperationalAlertStatus.RESOLVED);
    const toUpdate = detected.filter((alert) => { const current = existingByKey.get(alert.id); return current && current.status !== OperationalAlertStatus.RESOLVED; });
    const toResolve = existingRows.filter((row) => openStatuses.includes(row.status) && !detectedByKey.has(row.alertKey));
    const now = new Date();
    const audits: Audit[] = [];
    let createdCount = 0;

    for (const batch of batches(toCreate)) {
      try {
        const result = await prisma.operationalAlertTracking.createMany({ data: batch.map((alert) => ({ alertKey: alert.id, applicationId: alert.applicationId, type: alert.type, severity: alert.severity, status: OperationalAlertStatus.ACTIVE })), skipDuplicates: true });
        createdCount += result.count;
      } catch (error) {
        if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") throw error;
      }
      if (createdCount >= batch.length) {
        const created = await prisma.operationalAlertTracking.findMany({ where: { alertKey: { in: batch.map((alert) => alert.id) } }, select: { id: true, alertKey: true, applicationId: true } });
        for (const row of created) audits.push(audit("OPERATIONAL_ALERT_CREATED", row));
      }
    }
    for (const batch of batches(toUpdate)) {
      await Promise.all(batch.map((alert) => prisma.operationalAlertTracking.update({ where: { id: existingByKey.get(alert.id)!.id }, data: { type: alert.type, severity: alert.severity, lastDetectedAt: now } })));
    }
    for (const batch of batches(toReopen)) {
      await Promise.all(batch.map((alert) => prisma.operationalAlertTracking.update({ where: { id: existingByKey.get(alert.id)!.id }, data: { status: OperationalAlertStatus.ACTIVE, type: alert.type, severity: alert.severity, assignedUserId: null, assignedAt: null, resolvedAt: null, resolvedByUserId: null, lastDetectedAt: now } })));
      audits.push(...batch.map((alert) => audit("OPERATIONAL_ALERT_REOPENED", existingByKey.get(alert.id)!)));
    }
    for (const batch of batches(toResolve)) {
      await Promise.all(batch.map((row) => prisma.operationalAlertTracking.update({ where: { id: row.id }, data: { status: OperationalAlertStatus.RESOLVED, resolvedAt: now, resolvedByUserId: null } })));
      audits.push(...batch.map((row) => audit("OPERATIONAL_ALERT_AUTO_RESOLVED", row)));
    }
    for (const batch of batches(audits)) await prisma.auditLog.createMany({ data: batch });
    const legacyResolved = toResolve.filter((row) => row.application?.createdAt && row.application.createdAt < OPERATIONAL_ALERTS_CUTOFF_DATE).length;
    const result = { detected: detected.length, created: createdCount, updated: toUpdate.length, reopened: toReopen.length, resolved: toResolve.length, legacyResolved, durationMs: Date.now() - startedAt };
    console.info("[OPERATIONAL_ALERTS_SYNC]", result);
    return result;
  }

  async list(limit = 20): Promise<{ total: number; critical: number; warning: number; alerts: OperationalAlert[] }> {
    const where = { status: { in: openStatuses }, application: { createdAt: { gte: OPERATIONAL_ALERTS_CUTOFF_DATE } } };
    const [groups, rows] = await Promise.all([
      prisma.operationalAlertTracking.groupBy({ by: ["severity"], where, _count: { _all: true } }),
      prisma.operationalAlertTracking.findMany({ where, orderBy: { lastDetectedAt: "desc" }, take: Math.min(Math.max(limit, 1), 50), include: { application: { select: { applicationCode: true, person: { select: { firstName: true, paternalLastName: true } } } } } }),
    ]);
    const critical = groups.find((item) => item.severity === "CRITICAL")?._count._all ?? 0; const warning = groups.find((item) => item.severity === "WARNING")?._count._all ?? 0;
    return { total: critical + warning, critical, warning, alerts: rows.map((row) => ({ id: row.alertKey, type: row.type as OperationalAlert["type"], severity: row.severity as OperationalAlert["severity"], title: row.type.replace(/_/g, " "), message: "Alerta operativa pendiente de revisión.", applicationId: row.applicationId, applicationCode: row.application.applicationCode, personName: row.application.person ? `${row.application.person.firstName} ${row.application.person.paternalLastName}`.trim() : undefined, createdAt: row.lastDetectedAt.toISOString(), action: { label: "Ver expediente", href: `/intranet/expedientes?applicationId=${row.applicationId}` } })) };
  }
}
export const operationalAlertTrackingService = new OperationalAlertTrackingService();
