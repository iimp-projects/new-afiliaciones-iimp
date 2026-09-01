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
    const activeApprovals = app.approvals.filter((a: any) => String(a.status) !== "INACTIVE");
    const approvedApprovalsCount = activeApprovals.filter((a: any) => a.status === EndorsementStatus.APPROVED).length;
    const hasRejectedApproval = activeApprovals.some((a: any) => String(a.status) === "REJECTED");
    const areApprovalsReady = isStudent || approvedApprovalsCount >= 2;

    // =========================================================================
    // [!] AUTO-APROBAR AVALES EN LA TABLA DE VALIDACIONES SIN ROMPER PRISMA
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
    // Función auxiliar para obtener el estado de un área específica
    const getStatus = (code: string) => {
      const v = app.validations.find((val: any) => val.department.code === code);
      return v ? v.status : ValidationStatus.PENDING;
    };

    // Evaluamos el estado explícito de las áreas de tu flujo (Acepta APPROVED y RESOLVED)
    const logisticaOk = ["APPROVED", "RESOLVED"].includes(getStatus("LOGISTICA"));
    const asociadosOk = ["APPROVED", "RESOLVED"].includes(getStatus("ASOCIADOS"));
    const comiteOk = ["APPROVED", "RESOLVED"].includes(getStatus("COMITE"));

    // El flujo está completado si las 3 áreas obligatorias y los avales dieron conformidad
    const isFlowCompleted = logisticaOk && asociadosOk && comiteOk && areApprovalsReady;

    const hasRejectedValidation = app.validations.some((v: any) => v.status === ValidationStatus.REJECTED);    
    const hasObservedValidation = app.validations.some((v: any) => v.status === ValidationStatus.OBSERVED);
    const hasResolvedValidation = app.validations.some((v: any) => v.status === ValidationStatus.RESOLVED);
    const hasAnyActivity = app.validations.some((v: any) => v.status !== ValidationStatus.PENDING) || approvedApprovalsCount > 0;
    
    const isPaid = app.payments.length > 0 && app.payments[0].status === PaymentStatus.PAID;
    const isPaymentResolved = isStudent || isPaid;

    // ==========================================
    // 3. LÓGICA ESTRICTA DE ESTADOS
    // ==========================================
    let newGeneralStatus: ApplicationStatus = ApplicationStatus.PENDING;

    if (hasRejectedValidation) {
        // Si un área interna/comité rechaza la postulación, se rechaza definitivamente.
        newGeneralStatus = ApplicationStatus.REJECTED;
    } else if (hasObservedValidation || hasRejectedApproval) {
        // Si un área la observa O SI UN AVAL RECHAZA, pasa a ser OBSERVADO
        newGeneralStatus = ApplicationStatus.OBSERVED;
    } else if (isFlowCompleted) {
        // Los 4 pilares están Ok -> Se va directo a Pago (o Completado si ya pagó / es estudiante)
        newGeneralStatus = isPaymentResolved ? ApplicationStatus.COMPLETED : ApplicationStatus.READY_FOR_PAYMENT;
    } else if (hasResolvedValidation) {
        newGeneralStatus = ApplicationStatus.RESOLVED;
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