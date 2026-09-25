import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ValidationStatus, ValidationAction } from "@prisma/client";
import { ApplicationStatusCalculatorService } from "@/modules/afiliaciones/postulacion/Services/ApplicationStatusCalculatorService";
import { AssociatesIntegrationService } from "@/modules/afiliaciones/associates-integration/Services/AssociatesIntegrationService";
import { processPreparedStudentIntegrationAfterCommit } from "@/modules/afiliaciones/expedientes/Services/AdministrativeStatusPostCommitService";
import { NotifyComiteService } from "@/modules/afiliaciones/expedientes/Services/NotifyComiteService"; 
import { NotifyApplicantService } from "@/modules/afiliaciones/postulacion/Services/NotifyApplicantService";
import { OBSERVATION_FIELD_KEYS } from "@/modules/afiliaciones/observations/ObservationFields";
import { stripObservationMarkup } from "@/modules/afiliaciones/observations/ObservationText";
import { AssociateProvisioningService } from "@/modules/afiliaciones/asociados/Services/AssociateProvisioningService";
import { apiAuthorizationStatus, requireApiPermission } from "@/modules/auth/context/api-authorization";
import { expedienteAuthorizationService, resolveRequiredApplicationPermission } from "@/modules/afiliaciones/expedientes/Services/ExpedienteAuthorizationService";

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const appId = parseInt(id, 10);
        if (!Number.isInteger(appId) || appId < 1) return NextResponse.json({ success: false, message: "Expediente inválido." }, { status: 400 });
        const body = await request.json();
        
        // 1. Extraemos el targetDepartmentCode que ahora envía el Modal del SuperAdmin
        const { newStatus, reason, fieldPaths = [], targetDepartmentCode } = body;

        // 2. Autorización dinámica por acción (CAPABILITY) — FAIL-CLOSED.
        //    RESOLVED, estados desconocidos o inválidos se rechazan aquí.
        const requiredAction = resolveRequiredApplicationPermission(newStatus);
        if (!requiredAction) {
            return NextResponse.json({ success: false, message: "Estado de área inválido." }, { status: 400 });
        }
        const currentUser = await requireApiPermission(requiredAction, "applications");

        const plainTextReason = typeof reason === "string" ? stripObservationMarkup(reason) : "";
        if (plainTextReason.length > 2000) {
            return NextResponse.json({ success: false, message: "El motivo excede el máximo de 2000 caracteres." }, { status: 422 });
        }
        if (["OBSERVED", "REJECTED"].includes(newStatus) && !plainTextReason) {
            return NextResponse.json({ success: false, message: "Debe indicar un motivo." }, { status: 422 });
        }
        
        const normalizedFieldPaths = Array.isArray(fieldPaths)
            ? [...new Set(fieldPaths.filter((field): field is string => typeof field === "string" && OBSERVATION_FIELD_KEYS.has(field)))]
            : [];

        if (newStatus === "OBSERVED" && normalizedFieldPaths.length === 0) {
            return NextResponse.json({ success: false, message: "Seleccione al menos un campo observado." }, { status: 400 });
        }

        // 3. Scope de área (SCOPE) — ownership. No confía en targetDepartmentCode para no-admin.
        const deptCode = expedienteAuthorizationService.resolveWritableDepartment(currentUser, targetDepartmentCode);

        // 4. Mapeo de Estados
        let targetAreaStatus: ValidationStatus | null = null;
        let actionEnum: ValidationAction = ValidationAction.START_REVIEW;

        if (newStatus === "APPROVED") {
            targetAreaStatus = ValidationStatus.APPROVED;
            actionEnum = ValidationAction.APPROVED;
        } else if (newStatus === "OBSERVED") {
            targetAreaStatus = ValidationStatus.OBSERVED;
            actionEnum = ValidationAction.OBSERVED;
        } else if (newStatus === "REJECTED") {
            targetAreaStatus = ValidationStatus.REJECTED;
            actionEnum = ValidationAction.REJECTED;
        } else if (newStatus === "PENDING") {
            targetAreaStatus = ValidationStatus.PENDING;
            actionEnum = ValidationAction.REOPENED;
        }

        if (!targetAreaStatus) {
            return NextResponse.json({ success: false, message: "Estado de área inválido." }, { status: 400 });
        }

        // 5. Transacción de Base de Datos
        const associatesIntegrationService = new AssociatesIntegrationService();
        let integrationId: number | null = null;

        await prisma.$transaction(async (tx) => {
            let departmentName = deptCode || "GENERAL";

            const department = await tx.membershipDepartment.findUnique({ where: { code: deptCode } });

            if (department) {
                departmentName = department.name;
                const validation = await tx.membershipValidation.findUnique({
                    where: { applicationId_departmentId: { applicationId: appId, departmentId: department.id } }
                });

                if (validation) {
                    // A) Actualizamos la validación individual del área
                    await tx.membershipValidation.update({
                        where: { id: validation.id },
                        data: {
                            status: targetAreaStatus,
                            validatedById: currentUser.id,
                            validatedAt: new Date()
                        }
                    });

                    // B) Registramos en el Historial inmutable (Log de acciones)
                    await tx.membershipValidationHistory.create({
                        data: {
                            validationId: validation.id,
                            userId: currentUser.id,
                            action: actionEnum,
                            comment: plainTextReason || 'Actualización de estado del área'
                        }
                    });

                    // C) Si fue observado, creamos el registro de la observación para el postulante
                    if (targetAreaStatus === ValidationStatus.OBSERVED) {
                        await tx.membershipObservation.create({
                            data: {
                                applicationId: appId,
                                reviewDepartment: deptCode,
                                errorDescription: plainTextReason || "Se requiere subsanación.",
                                fieldPaths: normalizedFieldPaths,
                            }
                        });
                    }
                }
            }

            // D) Recalculamos automáticamente el estado general del expediente
            const calculator = new ApplicationStatusCalculatorService(associatesIntegrationService);
            await calculator.recalculate(appId, tx, (preparedIntegrationId) => {
                integrationId = preparedIntegrationId;
            });
        });

        await processPreparedStudentIntegrationAfterCommit(integrationId, associatesIntegrationService);
        if (integrationId !== null) {
            await new AssociateProvisioningService().provisionCompletedApplication(appId);
        }

        // 6. Lanzamiento de Eventos / Notificaciones (Fuera de la transacción para no bloquear)
        if (targetAreaStatus === ValidationStatus.APPROVED) {
            const notifyService = new NotifyComiteService();
            notifyService.execute(appId).catch(console.error);
        } else if (targetAreaStatus === ValidationStatus.OBSERVED) {
            const notifyApplicant = new NotifyApplicantService();
            notifyApplicant.notifyObservationCreated(appId, plainTextReason, normalizedFieldPaths).catch(console.error);
        }

        return NextResponse.json({ success: true, message: "Estado y observaciones actualizadas correctamente." }, { status: 200 });
    } catch (error: unknown) {
        console.error("[Update Status Error]:", error);
        const status = apiAuthorizationStatus(error, error instanceof Error && (error.message.includes("área") || error.message.includes("rol")) ? 403 : 500);
        return NextResponse.json({ success: false, message: status < 500 ? "No autorizado." : "Error al actualizar el estado." }, { status });
    }
}
