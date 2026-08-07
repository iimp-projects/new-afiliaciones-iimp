import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ValidationStatus, ValidationAction } from "@prisma/client";
import { contextService } from "@/modules/auth/context/service";
import { ApplicationStatusCalculatorService } from "@/modules/afiliaciones/postulacion/Services/ApplicationStatusCalculatorService";

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const appId = parseInt(id, 10);
        const body = await request.json();
        const { newStatus, reason } = body; 

        // 1. Obtener usuario actual y mapear su Rol a un Área
        const currentUser = await contextService.getCurrentUser().catch(() => null);
        const userDept = currentUser ? currentUser.role.slug : 'SISTEMA';
        
        const roleDeptMap: Record<string, string> = {
            "LOGISTICA": "LOGISTICA",
            "ATENCION_ASOCIADO": "ASOCIADOS",
            "COMITE_EVALUADOR": "COMITE"
        };
        const deptCode = roleDeptMap[userDept];

        // 2. EL FIX ESTÁ AQUÍ: Mapeamos la acción del Frontend al Estado Real del Área
        let targetAreaStatus: ValidationStatus | null = null;
        let actionEnum: ValidationAction = ValidationAction.START_REVIEW;

        // Si el front manda UNDER_EVALUATION (Validar Fase), significa que el área APRUEBA.
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
        }

        if (!targetAreaStatus) {
            return NextResponse.json({ success: false, message: "Estado de área inválido." }, { status: 400 });
        }

        // 3. Ejecutar actualización
        await prisma.$transaction(async (tx) => {
            
            // A) Actualizar el área específica que le corresponde al usuario
            if (deptCode) {
                const department = await tx.membershipDepartment.findUnique({ where: { code: deptCode } });

                if (department) {
                    const validation = await tx.membershipValidation.findUnique({
                        where: { applicationId_departmentId: { applicationId: appId, departmentId: department.id } }
                    });

                    if (validation) {
                        await tx.membershipValidation.update({
                            where: { id: validation.id },
                            data: {
                                status: targetAreaStatus, // AHORA SE GUARDA "APPROVED"
                                validatedById: currentUser?.id,
                                validatedAt: new Date()   // AQUÍ CAPTURAMOS LA HORA EXACTA
                            }
                        });

                        await tx.membershipValidationHistory.create({
                            data: {
                                validationId: validation.id,
                                userId: currentUser?.id,
                                action: actionEnum,
                                comment: reason || 'Actualización de estado del área'
                            }
                        });
                    }
                }
            }

            // B) Disparamos el Cerebro para recalcular
            const calculator = new ApplicationStatusCalculatorService();
            await calculator.recalculate(appId, tx);
        });

        return NextResponse.json({ success: true, message: "Estado actualizado y recalculado correctamente." }, { status: 200 });

    } catch (error: any) {
        console.error("[Update Status Error]:", error);
        return NextResponse.json({ success: false, message: error.message || "Error al actualizar el estado." }, { status: 500 });
    }
}