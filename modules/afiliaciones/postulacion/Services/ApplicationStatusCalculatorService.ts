import { PrismaClient, ApplicationStatus, ValidationStatus, EndorsementStatus, PaymentStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export class ApplicationStatusCalculatorService {
  /**
   * Recalcula el Estado General del Expediente basándose estrictamente 
   * en las reglas de negocio y dependencias de cada área.
   * 
   * @param applicationId ID del Expediente
   * @param tx Transacción de Prisma opcional (si se llama dentro de un flujo atómico)
   */
  async recalculate(applicationId: number, tx?: any): Promise<ApplicationStatus> {
    const db = tx || prisma;

    // 1. Obtener la foto completa del Expediente actual
    const app = await db.membershipApplication.findUnique({
      where: { id: applicationId },
      include: {
        validations: { include: { department: true } },
        approvals: true,
        payments: { orderBy: { createdAt: "desc" }, take: 1 }
      }
    });

    if (!app) throw new Error("Expediente no encontrado para recalcular estado.");

    // Regla 1: Si es BORRADOR, no se toca.
    if (app.status === ApplicationStatus.DRAFT) return ApplicationStatus.DRAFT;

    const isStudent = app.affiliateType === "STUDENT";

    // 2. Extraer métricas de las áreas
    const hasRejectedValidation = app.validations.some((v: any) => v.status === ValidationStatus.REJECTED);
    const hasRejectedApproval = app.approvals.some((a: any) => a.status === EndorsementStatus.REJECTED);
    
    const hasObservedValidation = app.validations.some((v: any) => v.status === ValidationStatus.OBSERVED);
    const hasResolvedValidation = app.validations.some((v: any) => v.status === ValidationStatus.RESOLVED);

    // ¿Están listos los Avales? (Estudiantes = true, Activos = 2 aprobados)
    const approvedApprovalsCount = app.approvals.filter((a: any) => a.status === EndorsementStatus.APPROVED).length;
    const areApprovalsReady = isStudent || approvedApprovalsCount >= 2;

    // ¿Están todas las áreas obligatorias aprobadas?
    const mandatoryValidations = app.validations.filter((v: any) => v.department.isRequired);
    const allMandatoryApproved = mandatoryValidations.length > 0 && mandatoryValidations.every((v: any) => v.status === ValidationStatus.APPROVED);

    // ¿Existe AL MENOS UNA actividad? (Cualquier área dejó de ser PENDING o al menos un Aval aprobó)
    const hasAnyActivity = app.validations.some((v: any) => v.status !== ValidationStatus.PENDING) || approvedApprovalsCount > 0;

    // ¿Está pagado?
    const isPaid = app.payments.length > 0 && app.payments[0].status === PaymentStatus.PAID;
    const isPaymentResolved = isStudent || isPaid;

    // ==========================================
    // 3. APLICAR REGLAS DE PRIORIDAD ESTRICTA
    // ==========================================
    let newGeneralStatus: ApplicationStatus = ApplicationStatus.PENDING;

    // Prioridad 2: RECHAZADO (Definitivo)
    if (hasRejectedValidation || hasRejectedApproval) {
        newGeneralStatus = ApplicationStatus.REJECTED;
    } 
    // Prioridad 3: OBSERVADO (Tiene peso sobre los demás en curso)
    else if (hasObservedValidation) {
        newGeneralStatus = ApplicationStatus.OBSERVED;
    } 
    // Prioridad 4: SUBSANADO (El postulante respondió, espera re-evaluación)
    else if (hasResolvedValidation) {
        newGeneralStatus = ApplicationStatus.RESOLVED;
    } 
    // Prioridad 5 y 6: APTO PARA PAGO o COMPLETADO
    else if (allMandatoryApproved && areApprovalsReady) {
        if (isPaymentResolved) {
            newGeneralStatus = ApplicationStatus.COMPLETED; // Completó Evaluaciones y Pagó
        } else {
            newGeneralStatus = ApplicationStatus.READY_FOR_PAYMENT; // Solo falta pagar
        }
    } 
    // Prioridad 7: EN EVALUACIÓN (Ya empezó el proceso, pero falta que terminen)
    else if (hasAnyActivity) {
        newGeneralStatus = ApplicationStatus.UNDER_EVALUACION;
    }
    // Prioridad 8: PENDIENTE (Es el valor inicial por defecto)
    
    // ==========================================
    // 4. ACTUALIZAR SI HUBO CAMBIOS
    // ==========================================
    if (app.status !== newGeneralStatus) {
        await db.membershipApplication.update({
            where: { id: applicationId },
            data: { status: newGeneralStatus }
        });

        // Registrar en el log histórico del expediente
        await db.membershipHistory.create({
            data: {
                applicationId: applicationId,
                previousStatus: app.status,
                newStatus: newGeneralStatus,
                changeReason: "Recálculo automático de estado según áreas (Workflow Engine).",
                changedById: null // Null indica que fue una acción del Sistema
            }
        });
    }

    return newGeneralStatus;
  }
}