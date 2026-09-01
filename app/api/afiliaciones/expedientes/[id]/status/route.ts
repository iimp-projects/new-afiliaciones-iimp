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
        
        // 1. Extraemos el targetDepartmentCode que ahora envía el Modal del SuperAdmin
        const { newStatus, reason, fieldPaths = [], targetDepartmentCode } = body;
        
        const normalizedFieldPaths = Array.isArray(fieldPaths)
            ? [...new Set(fieldPaths.filter((field): field is string => typeof field === "string" && OBSERVATION_FIELD_KEYS.has(field)))]
            : [];

        if (newStatus === "OBSERVED" && normalizedFieldPaths.length === 0) {
            return NextResponse.json({ success: false, message: "Seleccione al menos un campo observado." }, { status: 400 });
        }

        const currentUser = await contextService.getCurrentUser().catch(() => null);
        const userDept = currentUser ? currentUser.role.slug : 'SISTEMA';

        // 2. Mapa estricto de roles normales a departamentos
        const roleDeptMap: Record<string, string> = {
            "LOGISTICA": "LOGISTICA",
            "ATENCION_ASOCIADO": "ASOCIADOS",
            "COMUNICACIONES": "COMUNICACIONES",
            "LEGAL": "LEGAL",
            "COMITE_EVALUADOR": "COMITE",
        };

        // 3. Asignación Dinámica del Área
        let deptCode = roleDeptMap[userDept];

        // Magia para Administradores: Si envían un área objetivo, sobreescribimos la suya
        if ((userDept === "SUPER_ADMIN" || userDept === "SYSTEM_ADMIN") && targetDepartmentCode) {
            deptCode = targetDepartmentCode; 
        }

        if (!deptCode) {
            return NextResponse.json({ success: false, message: "No se pudo determinar el área de revisión o faltan permisos." }, { status: 400 });
        }

        // 4. Mapeo de Estados
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

        // 5. Transacción de Base de Datos
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
                            validatedById: currentUser?.id,
                            validatedAt: new Date()
                        }
                    });

                    // B) Registramos en el Historial inmutable (Log de acciones)
                    await tx.membershipValidationHistory.create({
                        data: {
                            validationId: validation.id,
                            userId: currentUser?.id,
                            action: actionEnum,
                            comment: reason || 'Actualización de estado del área'
                        }
                    });

                    // C) Si fue observado, creamos el registro de la observación para el postulante
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

            // D) Recalculamos automáticamente el estado general del expediente
            const calculator = new ApplicationStatusCalculatorService();
            await calculator.recalculate(appId, tx);
        });

        // 6. Lanzamiento de Eventos / Notificaciones (Fuera de la transacción para no bloquear)
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