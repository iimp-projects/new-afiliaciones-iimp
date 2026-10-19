import { ValidationStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { NotificationDispatcherService } from "./NotificationDispatcherService";
import { NotificationRecipientResolver } from "./NotificationRecipientResolver";
import { NOTIFICATION_TYPES } from "../Types/NotificationTypes";

const EXCLUDED_DEPARTMENTS = new Set(["AVALES"]);

export interface CorrectionReference {
  departmentCode: string;
  validationHistoryId: number;
}

/**
 * Eventos de negocio reales traducidos a notificaciones internas IN_APP.
 *
 * Cada método es idempotente a nivel de `dedup_key` y no lanza: los errores de
 * notificación no deben bloquear el flujo principal de la postulación.
 */
export class ApplicationNotificationEvents {
  constructor(
    private readonly dispatcher: NotificationDispatcherService = new NotificationDispatcherService(),
    private readonly recipientResolver: NotificationRecipientResolver = new NotificationRecipientResolver(),
  ) {}

  async notifyNewApplication(applicationId: number): Promise<number> {
    const application = await prisma.membershipApplication.findUnique({
      where: { id: applicationId },
      select: { applicationCode: true },
    });
    if (!application) return 0;

    const validations = await prisma.membershipValidation.findMany({
      where: { applicationId, status: ValidationStatus.PENDING },
      select: { department: { select: { code: true } } },
    });

    const departments = [...new Set(validations.map((validation) => validation.department.code))]
      .filter((code) => !EXCLUDED_DEPARTMENTS.has(code));

    const recipients = await this.recipientResolver.resolveForDepartments(departments);
    if (recipients.length === 0) return 0;

    return this.dispatcher.dispatch({
      type: NOTIFICATION_TYPES.APPLICATION_SUBMITTED,
      severity: "INFO",
      title: "Nuevo expediente pendiente",
      message: `El expediente ${application.applicationCode} fue registrado y requiere revisión.`,
      applicationId,
      entityType: "MembershipApplication",
      entityId: String(applicationId),
      href: `/intranet/expedientes?applicationId=${applicationId}`,
      dedupBaseKey: `${NOTIFICATION_TYPES.APPLICATION_SUBMITTED}:${applicationId}`,
      recipientUserIds: recipients,
    });
  }

  async notifyCorrectionReceived(applicationId: number, corrections: CorrectionReference[]): Promise<number> {
    if (corrections.length === 0) return 0;

    const application = await prisma.membershipApplication.findUnique({
      where: { id: applicationId },
      select: { applicationCode: true },
    });
    if (!application) return 0;

    const departments = [...new Set(corrections.map((correction) => correction.departmentCode))];
    const recipientsByDepartment = new Map<string, number[]>();
    for (const code of departments) {
      recipientsByDepartment.set(code, await this.recipientResolver.resolveForDepartments([code]));
    }

    let created = 0;
    for (const correction of corrections) {
      const recipients = recipientsByDepartment.get(correction.departmentCode) ?? [];
      if (recipients.length === 0) continue;
      created += await this.dispatcher.dispatch({
        type: NOTIFICATION_TYPES.CORRECTION_SUBMITTED,
        severity: "INFO",
        title: "Subsanación recibida",
        message: `El postulante corrigió las observaciones del expediente ${application.applicationCode}. El área debe volver a revisar.`,
        applicationId,
        entityType: "MembershipValidationHistory",
        entityId: String(correction.validationHistoryId),
        href: `/intranet/expedientes?applicationId=${applicationId}`,
        dedupBaseKey: `${NOTIFICATION_TYPES.CORRECTION_SUBMITTED}:${applicationId}:${correction.validationHistoryId}`,
        recipientUserIds: recipients,
      });
    }
    return created;
  }
}

export const applicationNotificationEvents = new ApplicationNotificationEvents();
