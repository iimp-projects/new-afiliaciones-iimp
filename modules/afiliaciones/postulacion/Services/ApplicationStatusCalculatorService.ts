import { ApplicationStatus, ValidationStatus, EndorsementStatus, PaymentStatus, ValidationAction } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export class ApplicationStatusCalculatorService {
  /**
   * Recalcula el Estado General del Expediente basándose estrictamente 
   * en las reglas de negocio y dependencias de cada área.
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

    if (app.status === ApplicationStatus.DRAFT) return ApplicationStatus.DRAFT;

    const isStudent = app.affiliateType === "STUDENT";

    // ==========================================
    // 1. EVALUAR AVALES (Tabla externa)
    // ==========================================
    const approvedApprovalsCount = app.approvals.filter((a: any) => a.status === EndorsementStatus.APPROVED).length;
    const areApprovalsReady = isStudent || approvedApprovalsCount >= 2;

    // =========================================================================
    // [!] FIX: AUTO-APROBAR AVALES EN LA TABLA DE VALIDACIONES SIN ROMPER PRISMA
    // =========================================================================
    const avalesValidation = app.validations.find((v: any) => v.department.code === 'AVALES');
    if (avalesValidation && avalesValidation.status !== ValidationStatus.APPROVED && areApprovalsReady) {
        
        // Actualizamos la tabla principal (OJO: Sin 'comments' para que Prisma no explote)
        await db.membershipValidation.update({
            where: { id: avalesValidation.id },
            data: { 
              status: ValidationStatus.APPROVED, 
              validatedAt: new Date()
            }
        });

        // Insertamos el comentario donde realmente va: En el historial
        await db.membershipValidationHistory.create({
            data: {
                validationId: avalesValidation.id,
                action: ValidationAction.APPROVED,
                comment: "Aprobación automática al completarse los avales externos."
            }
        });
        
        avalesValidation.status = ValidationStatus.APPROVED; 
    }

    // ==========================================
    // 2. EXTRAER MÉTRICAS ACTUALIZADAS
    // ==========================================
    const hasRejectedValidation = app.validations.some((v: any) => v.status === ValidationStatus.REJECTED);
    const hasRejectedApproval = app.approvals.some((a: any) => a.status === EndorsementStatus.REJECTED);
    
    const hasObservedValidation = app.validations.some((v: any) => v.status === ValidationStatus.OBSERVED);
    const hasResolvedValidation = app.validations.some((v: any) => v.status === ValidationStatus.RESOLVED);

    // ¿Están todas las áreas obligatorias aprobadas? (Incluyendo AVALES que se auto-aprobó arriba)
    const mandatoryValidations = app.validations.filter((v: any) => v.department.isRequired);
    const allMandatoryApproved = mandatoryValidations.length > 0 && mandatoryValidations.every((v: any) => v.status === ValidationStatus.APPROVED);

    const hasAnyActivity = app.validations.some((v: any) => v.status !== ValidationStatus.PENDING) || approvedApprovalsCount > 0;
    
    const isPaid = app.payments.length > 0 && app.payments[0].status === PaymentStatus.PAID;
    const isPaymentResolved = isStudent || isPaid;

    // ==========================================
    // 3. LÓGICA ESTRICTA DE ESTADOS
    // ==========================================
    let newGeneralStatus: ApplicationStatus = ApplicationStatus.PENDING;

    if (hasRejectedValidation || hasRejectedApproval) {
        newGeneralStatus = ApplicationStatus.REJECTED;
    } else if (hasObservedValidation) {
        newGeneralStatus = ApplicationStatus.OBSERVED;
    } else if (hasResolvedValidation) {
        newGeneralStatus = ApplicationStatus.RESOLVED;
    } else if (allMandatoryApproved && areApprovalsReady) {
        // [!] ESTE ES TU OBJETIVO: Los 4 Ok -> Se va directo a Pago
        newGeneralStatus = isPaymentResolved ? ApplicationStatus.COMPLETED : ApplicationStatus.READY_FOR_PAYMENT;
    } else if (hasAnyActivity) {
        newGeneralStatus = ApplicationStatus.UNDER_EVALUACION;
    }

    // ==========================================
    // 4. GUARDAR CAMBIOS DE ESTADO GENERAL
    // ==========================================
    if (app.status !== newGeneralStatus) {
        await db.membershipApplication.update({
            where: { id: applicationId },
            data: { status: newGeneralStatus }
        });

        await db.membershipHistory.create({
            data: {
                applicationId: applicationId,
                previousStatus: app.status,
                newStatus: newGeneralStatus,
                changeReason: "Recálculo automático de estado según áreas (Flujo Integrado).",
                changedById: null 
            }
        });
    }

    return newGeneralStatus;
  }
}