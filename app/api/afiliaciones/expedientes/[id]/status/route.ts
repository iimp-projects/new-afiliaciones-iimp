import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApplicationStatus, ObservationStatus } from "@prisma/client";
import { contextService } from "@/modules/auth/context/service";

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const appId = parseInt(id, 10);
        const body = await request.json();
        const { newStatus, reason } = body; 

        if (!Object.values(ApplicationStatus).includes(newStatus)) {
            return NextResponse.json({ success: false, message: "Estado inválido." }, { status: 400 });
        }

        const currentUser = await contextService.getCurrentUser().catch(() => null);
        const userName = currentUser ? `${currentUser.person.firstName} ${currentUser.person.paternalLastName}` : 'Sistema';
        const userDept = currentUser ? currentUser.role.slug : 'SISTEMA';
        const roleName = userDept.replace(/_/g, ' ');

        const auditReason = `[Por: ${userName} - ${roleName}] ${reason || 'Validación de etapa.'}`;

        const updatedApplication = await prisma.$transaction(async (tx) => {
            const currentApp = await tx.membershipApplication.findUnique({
                where: { id: appId },
                select: { status: true }
            });

            if (!currentApp) throw new Error("Expediente no encontrado.");

            // 1. Actualizar el estado general de la postulación
            const updated = await tx.membershipApplication.update({
                where: { id: appId },
                data: { status: newStatus as ApplicationStatus }
            });

            // 2. Registrar en la Línea de Tiempo
            await tx.membershipHistory.create({
                data: {
                    applicationId: appId,
                    previousStatus: currentApp.status,
                    newStatus: newStatus as ApplicationStatus,
                    changeReason: auditReason,
                    changedById: currentUser?.id || null
                }
            });

            // 3. USO DE LA NUEVA TABLA (Validaciones por Área)
            const isAreaRole = userDept === "LOGISTICA" || userDept === "ATENCION_ASOCIADO";
            
            if (isAreaRole) {
                // Si eligen "Validar Fase" (UNDER_EVALUATION) -> El área aprueba (RESOLVED)
                // Si eligen "Observar" (OBSERVED) -> El área observa (PENDING)
                let areaStatus: ObservationStatus | null = null;
                if (newStatus === "UNDER_EVALUATION") areaStatus = ObservationStatus.RESOLVED;
                if (newStatus === "OBSERVED") areaStatus = ObservationStatus.PENDING;

                if (areaStatus) {
                    const existingValidation = await tx.membershipAreaValidation.findFirst({
                        where: { applicationId: appId, department: userDept }
                    });

                    if (existingValidation) {
                        await tx.membershipAreaValidation.update({
                            where: { id: existingValidation.id },
                            data: { status: areaStatus, comments: reason, validatedById: currentUser?.id, validatedAt: new Date() }
                        });
                    } else {
                        await tx.membershipAreaValidation.create({
                            data: { applicationId: appId, department: userDept, status: areaStatus, comments: reason, validatedById: currentUser?.id, validatedAt: new Date() }
                        });
                    }
                }
            }

            return updated;
        });

        return NextResponse.json({ success: true, data: updatedApplication }, { status: 200 });

    } catch (error: any) {
        console.error("[Update Status Error]:", error);
        return NextResponse.json({ success: false, message: error.message || "Error al actualizar el estado." }, { status: 500 });
    }
}