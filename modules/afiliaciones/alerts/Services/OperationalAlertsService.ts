import { AssociateIntegrationStatus, PaymentStatus, UserStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { buildOperationalAlertKey } from "../utils/OperationalAlertKey";
import { OPERATIONAL_ALERTS_CUTOFF_DATE } from "../Config/operationalAlerts.config";

export type OperationalAlertType = "PORTAL_ACCESS_CONFLICT" | "PORTAL_ACCESS_NOT_PROVISIONED" | "ACTIVATION_PENDING" | "ACTIVATION_STALE" | "SIE_SYNC_FAILED" | "SIE_PENDING" | "PAYMENT_FAILURE";
export type OperationalAlert = { id: string; type: OperationalAlertType; severity: "WARNING" | "CRITICAL"; title: string; message: string; applicationId: number; applicationCode: string; personName?: string; createdAt: string; action: { label: string; href: string } };

const STALE_MS = 24 * 60 * 60 * 1000;

export class OperationalAlertsService {
  async detectAll(): Promise<OperationalAlert[]> {
    const applications = await prisma.membershipApplication.findMany({
      where: { deletedAt: null, status: "COMPLETED", createdAt: { gte: OPERATIONAL_ALERTS_CUTOFF_DATE } }, orderBy: { updatedAt: "desc" },
      select: { id: true, applicationCode: true, email: true, updatedAt: true, personId: true, person: { select: { firstName: true, paternalLastName: true, contacts: { select: { email: true }, orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }] }, user: { select: { id: true, status: true, createdAt: true, credentials: { where: { type: "PASSWORD", isActive: true }, select: { id: true } } } } } }, associateIntegration: { select: { id: true, status: true, updatedAt: true, lastAttemptAt: true } } },
    });
    const emails = [...new Set(applications.map((app) => (app.person?.contacts.find((contact) => contact.email)?.email || app.email).trim().toLowerCase()))];
    const users = emails.length ? await prisma.user.findMany({ where: { email: { in: emails } }, select: { id: true, email: true, personId: true } }) : [];
    const owners = new Map(users.map((user) => [user.email.toLowerCase(), user]));
    const alerts: OperationalAlert[] = [];
    for (const app of applications) {
      const person = app.person; if (!person) continue;
      const email = (person.contacts.find((contact) => contact.email)?.email || app.email).trim().toLowerCase();
      const name = `${person.firstName} ${person.paternalLastName}`.trim(); const href = `/intranet/expedientes?applicationId=${app.id}`;
      const user = person.user;
      if (!user) {
        const owner = owners.get(email);
        if (owner && owner.personId !== app.personId) alerts.push(this.alert("PORTAL_ACCESS_CONFLICT", "CRITICAL", app, name, "El asociado completó su afiliación, pero existe un conflicto de identidad/correo que impide habilitar el acceso al portal.", "Revisar conflicto", href));
        else alerts.push(this.alert("PORTAL_ACCESS_NOT_PROVISIONED", "WARNING", app, name, "La afiliación fue completada, pero el acceso al portal todavía no ha sido habilitado.", "Habilitar acceso", href));
      } else if (user.status === UserStatus.PENDING) {
        const stale = Date.now() - user.createdAt.getTime() >= STALE_MS;
        alerts.push(this.alert(stale ? "ACTIVATION_STALE" : "ACTIVATION_PENDING", "WARNING", app, name, stale ? "La activación de la cuenta continúa pendiente por más de 24 horas." : "El acceso fue creado, pero la cuenta todavía no ha sido activada.", "Reenviar activación", href));
      }
      const integration = app.associateIntegration;
      if (integration?.status === AssociateIntegrationStatus.FAILED || integration?.status === AssociateIntegrationStatus.RETRYABLE) alerts.push(this.alert("SIE_SYNC_FAILED", "CRITICAL", app, name, "La afiliación fue completada, pero la sincronización con SIE presentó un error.", "Ver expediente", href, integration.id));
      else if (integration && (integration.status === AssociateIntegrationStatus.PENDING || integration.status === AssociateIntegrationStatus.PROCESSING) && Date.now() - (integration.lastAttemptAt ?? integration.updatedAt).getTime() >= STALE_MS) alerts.push(this.alert("SIE_PENDING", "WARNING", app, name, "La sincronización con SIE continúa pendiente.", "Ver expediente", href, integration.id));
    }
    const failedPayments = await prisma.payment.findMany({ where: { status: PaymentStatus.FAILED, application: { deletedAt: null, createdAt: { gte: OPERATIONAL_ALERTS_CUTOFF_DATE } } }, orderBy: { updatedAt: "desc" }, select: { id: true, updatedAt: true, application: { select: { id: true, applicationCode: true, person: { select: { firstName: true, paternalLastName: true } } } } } });
    for (const payment of failedPayments) alerts.push({ id: buildOperationalAlertKey("PAYMENT_FAILURE", payment.application.id, payment.id), type: "PAYMENT_FAILURE", severity: "WARNING", title: "Intento de pago no confirmado", message: "Se registró un intento de pago no confirmado que requiere revisión.", applicationId: payment.application.id, applicationCode: payment.application.applicationCode, personName: payment.application.person ? `${payment.application.person.firstName} ${payment.application.person.paternalLastName}` : undefined, createdAt: payment.updatedAt.toISOString(), action: { label: "Ver expediente", href: `/intranet/expedientes?applicationId=${payment.application.id}` } });
    alerts.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return alerts;
  }
  async list(limit = 20): Promise<{ total: number; critical: number; warning: number; alerts: OperationalAlert[] }> { const alerts = await this.detectAll(); const visible = alerts.slice(0, Math.min(Math.max(limit, 1), 50)); return { total: alerts.length, critical: alerts.filter((alert) => alert.severity === "CRITICAL").length, warning: alerts.filter((alert) => alert.severity === "WARNING").length, alerts: visible }; }
  private alert(type: Exclude<OperationalAlertType, "PAYMENT_FAILURE">, severity: "WARNING" | "CRITICAL", app: { id: number; applicationCode: string; updatedAt: Date }, personName: string, message: string, label: string, href: string, relatedId?: number): OperationalAlert { return { id: buildOperationalAlertKey(type, app.id, relatedId), type, severity, title: type.replace(/_/g, " "), message, applicationId: app.id, applicationCode: app.applicationCode, personName, createdAt: app.updatedAt.toISOString(), action: { label, href } }; }
}

export const operationalAlertsService = new OperationalAlertsService();
