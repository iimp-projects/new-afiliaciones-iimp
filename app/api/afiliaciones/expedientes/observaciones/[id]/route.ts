import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ObservationStatus, ValidationStatus, ValidationAction } from "@prisma/client";

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const obsId = parseInt(id, 10);
        
        // Recibimos el comentario del frontend
        const body = await request.json();
        const { comment } = body;

        const result = await prisma.$transaction(async (tx) => {
            
            // 1. Subsanamos la observación individual y guardamos el comentario tipo WhatsApp
            const updatedObs = await tx.membershipObservation.update({
                where: { id: obsId },
                data: {
                    status: ObservationStatus.RESOLVED,
                    resolvedAt: new Date(),
                    resolutionComment: comment || "Observación subsanada." 
                }
            });

            // 2. Revisamos si quedan observaciones PENDIENTES en esta misma área
            const remainingPendingCount = await tx.membershipObservation.count({
                where: {
                    applicationId: updatedObs.applicationId,
                    reviewDepartment: updatedObs.reviewDepartment,
                    status: ObservationStatus.PENDING
                }
            });

            // 3. REGLA DE ORO: Si ya no hay pendientes, el área entera pasa a RESOLVED
            if (remainingPendingCount === 0) {
                // Buscamos el departamento correcto con flexibilidad de nombre para evitar errores
                const allDepts = await tx.membershipDepartment.findMany();
                const matchedDept = allDepts.find(d => 
                    d.name.toUpperCase() === updatedObs.reviewDepartment.toUpperCase() || 
                    d.code.toUpperCase() === updatedObs.reviewDepartment.toUpperCase() ||
                    (updatedObs.reviewDepartment.toUpperCase().includes("ASOCIADO") && d.code === "ASOCIADOS") ||
                    (updatedObs.reviewDepartment.toUpperCase().includes("LOGISTICA") && d.code === "LOGISTICA")
                );

                if (matchedDept) {
                    const areaValidation = await tx.membershipValidation.findFirst({
                        where: {
                            applicationId: updatedObs.applicationId,
                            departmentId: matchedDept.id
                        }
                    });

                    if (areaValidation && areaValidation.status === ValidationStatus.OBSERVED) {
                        await tx.membershipValidation.update({
                            where: { id: areaValidation.id },
                            data: {
                                status: ValidationStatus.RESOLVED,
                                validatedAt: new Date()
                            }
                        });

                        await tx.membershipValidationHistory.create({
                            data: {
                                validationId: areaValidation.id,
                                action: ValidationAction.SUBMITTED_CORRECTION,
                                comment: "Área subsanada automáticamente: Se resolvieron todas las observaciones individuales."
                            }
                        });
                    }
                }
            }

            return updatedObs;
        });

        return NextResponse.json({ 
            success: true, 
            message: "Observación subsanada correctamente.",
            data: result
        }, { status: 200 });

    } catch (error: any) {
        console.error("[Update Observation Error]:", error);
        return NextResponse.json(
            { success: false, message: "Error al actualizar la observación. ¿Ejecutaste npx prisma db push?" },
            { status: 500 }
        );
    }
}