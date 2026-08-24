import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ValidationStatus, ValidationAction } from "@prisma/client";
import { contextService } from "@/modules/auth/context/service";
import { ApplicationStatusCalculatorService } from "@/modules/afiliaciones/postulacion/Services/ApplicationStatusCalculatorService";
import { NotifyComiteService } from "@/modules/afiliaciones/expedientes/Services/NotifyComiteService"; 
import { NotifyApplicantService } from "@/modules/afiliaciones/postulacion/Services/NotifyApplicantService";
import { OBSERVATION_FIELD_KEYS } from "@/modules/afiliaciones/observations/ObservationFields";

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const appId = parseInt(id, 10);
        const body = await request.json();
        const { newStatus, reason, fieldPaths = [] } = body;
        const normalizedFieldPaths = Array.isArray(fieldPaths)
            ? [...new Set(fieldPaths.filter((field): field is string => typeof field === "string" && OBSERVATION_FIELD_KEYS.has(field)))]
            : [];

        if (newStatus === "OBSERVED" && normalizedFieldPaths.length === 0) {
            return NextResponse.json({ success: false, message: "Seleccione al menos un campo observado." }, { status: 400 });
        }

        const currentUser = await contextService.getCurrentUser().catch(() => null);
        const userDept = currentUser ? currentUser.role.slug : 'SISTEMA';

        // 1. Ampliamos el mapa para que no falle si evalúa un Admin
        const roleDeptMap: Record<string, string> = {
            "LOGISTICA": "LOGISTICA",
            "ATENCION_ASOCIADO": "ASOCIADOS",
            "COMUNICACIONES": "COMUNICACIONES",
            "LEGAL": "LEGAL",
            "COMITE_EVALUADOR": "COMITE",
            "SUPER_ADMIN": "ASOCIADOS", 
            "SYSTEM_ADMIN": "ASOCIADOS" 
        };

        const deptCode = roleDeptMap[userDept];

        let targetAreaStatus: ValidationStatus | null = null;
        let actionEnum: ValidationAction = ValidationAction.START_REVIEW;

        if (newStatus === "UNDER_EVALUACION" || newStatus === "UNDER_EVALUATION" || newStatus === "APPROVED") {
            targetAreaStatus = ValidationStatus.APPROVED;
            actionEnum = ValidationAction.APPROVED;
        } else if (newStatus === "OBSERVED") {
            targetAreaStatus = ValidationStatus.OBSERVED;
            actionEnum = ValidationAction.OBSERVED;
        } else if (newStatus === "RESOLVED") {
            targetAreaStatus = ValidationStatus.RESOLVED;
            actionEnum = ValidationAction.SUBMITTED_CORRECTION;
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

        await prisma.$transaction(async (tx) => {
            let departmentName = deptCode || "GENERAL";

            if (deptCode) {
                const department = await tx.membershipDepartment.findUnique({ where: { code: deptCode } });

                if (department) {
                    departmentName = department.name;
                    const validation = await tx.membershipValidation.findUnique({
                        where: { applicationId_departmentId: { applicationId: appId, departmentId: department.id } }
                    });

                    if (validation) {
                        // A) Actualizamos la validación
                        await tx.membershipValidation.update({
                            where: { id: validation.id },
                            data: {
                                status: targetAreaStatus,
                                validatedById: currentUser?.id,
                                validatedAt: new Date()
                            }
                        });

                        // B) Registramos en el Historial (Log de acciones)
                        await tx.membershipValidationHistory.create({
                            data: {
                                validationId: validation.id,
                                userId: currentUser?.id,
                                action: actionEnum,
                                comment: reason || 'Actualización de estado del área'
                            }
                        });

                        if (targetAreaStatus === ValidationStatus.OBSERVED) {
                            await tx.membershipObservation.create({
                                data: {
                                    applicationId: appId,
                                    reviewDepartment: deptCode,
                                    errorDescription: reason || "Se requiere subsanación.",
                                    fieldPaths: normalizedFieldPaths,
                                }
                            });
                        }
                    }
                }
            }

            const calculator = new ApplicationStatusCalculatorService();
            await calculator.recalculate(appId, tx);
        });

        // Evento aislado de notificación
        if (targetAreaStatus === ValidationStatus.APPROVED) {
            const notifyService = new NotifyComiteService();
            notifyService.execute(appId).catch(console.error);
        } else if (targetAreaStatus === ValidationStatus.OBSERVED) {
            const notifyApplicant = new NotifyApplicantService();
            notifyApplicant.notifyObservationCreated(appId, reason, normalizedFieldPaths).catch(console.error);
        }

        return NextResponse.json({ success: true, message: "Estado y observaciones actualizadas correctamente." }, { status: 200 });
    } catch (error: any) {
        console.error("[Update Status Error]:", error);
        return NextResponse.json({ success: false, message: error.message || "Error al actualizar el estado." }, { status: 500 });
    }
}
