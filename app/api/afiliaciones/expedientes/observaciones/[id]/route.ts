import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ObservationStatus, ValidationStatus, ValidationAction } from "@prisma/client";
import { apiAuthorizationStatus, requireApiPermission } from "@/modules/auth/context/api-authorization";
import { expedienteAuthorizationService } from "@/modules/afiliaciones/expedientes/Services/ExpedienteAuthorizationService";
import { stripObservationMarkup } from "@/modules/afiliaciones/observations/ObservationText";

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const currentUser = await requireApiPermission("update", "memberships");
        const { id } = await params;
        const obsId = parseInt(id, 10);
        if (!Number.isInteger(obsId) || obsId < 1) {
            return NextResponse.json({ success: false, message: "Observación inválida." }, { status: 400 });
        }
        
        // Recibimos el comentario del frontend
        const body = await request.json();
        const comment = typeof body.comment === "string" ? stripObservationMarkup(body.comment) : "";
        if (comment.length > 2000) {
            return NextResponse.json({ success: false, message: "El comentario excede el máximo permitido." }, { status: 422 });
        }

        const observation = await prisma.membershipObservation.findUnique({ where: { id: obsId }, select: { reviewDepartment: true } });
        if (!observation) return NextResponse.json({ success: false, message: "Observación no encontrada." }, { status: 404 });
        expedienteAuthorizationService.assertCanWriteDepartment(currentUser, observation.reviewDepartment);

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

    } catch (error: unknown) {
        console.error("[Update Observation Error]:", error);
        const status = apiAuthorizationStatus(error, error instanceof Error && error.message.includes("otra área") ? 403 : 500);
        return NextResponse.json(
            { success: false, message: status < 500 ? "No autorizado." : "Error al actualizar la observación." },
            { status }
        );
    }
}
