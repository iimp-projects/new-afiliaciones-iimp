import { Application } from "../Entities/Application";
import { UpdateDraftDTO } from "../DTOs/update-draft.dto";
import { IApplicationRepository } from "../Repositories/Interfaces/IApplicationRepository";
import { prisma } from "@/lib/prisma";
import { ObservationStatus, ValidationAction, ValidationStatus } from "@prisma/client";
import { ApplicationStatusCalculatorService } from "./ApplicationStatusCalculatorService";

export class UpdateDraftService {

    constructor(
        private readonly repository: IApplicationRepository
    ) {}

    async execute(
        trackingCode: string,
        dto: UpdateDraftDTO
    ): Promise<Application> {

        const application =
            await this.findApplication(trackingCode);

        await this.ensureEditable(application, dto);

        const updatedApplication = await this.updateDraft(
            trackingCode,
            dto
        );

        if (application.status === "OBSERVED") {
            await this.markCorrectionSubmitted(Number(application.id));
        }

        return updatedApplication;

    }

    /**
     * Obtiene la postulación.
     */
    private async findApplication(
        trackingCode: string
    ): Promise<Application> {

        const application =
            await this.repository.findByTrackingCode(
                trackingCode
            );

        if (!application) {

            throw new Error(
                "La postulación no existe."
            );

        }

        return application;

    }

    /**
     * Verifica que la postulación
     * aún pueda modificarse.
     */
    private async ensureEditable(
        application: Application,
        dto: UpdateDraftDTO
    ): Promise<void> {

        if (application.status === "DRAFT") return;

        if (application.status !== "OBSERVED") {

            throw new Error(
                "La postulación ya fue enviada."
            );

        }

        const observations = await prisma.membershipObservation.findMany({
            where: { applicationId: Number(application.id), status: "PENDING" },
            select: { fieldPaths: true },
        });
        const allowed = new Set(observations.flatMap((item) => Array.isArray(item.fieldPaths) ? item.fieldPaths.filter((path): path is string => typeof path === "string") : []));
        const current = (application.draftData ?? {}) as Record<string, any>;
        const proposed = dto.draftData as Record<string, any>;
        const compare = (before: any, after: any, path = ""): void => {
            if (JSON.stringify(before) === JSON.stringify(after)) return;
            if (before && after && typeof before === "object" && typeof after === "object") {
                const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
                keys.forEach((key) => compare(before[key], after[key], path ? `${path}.${key}` : key));
                return;
            }
            if (!allowed.has(path)) throw new Error("Solo puede modificar los campos solicitados en la observación.");
        };
        Object.keys(proposed).forEach((section) => compare(current[section], proposed[section], section));

    }

    /** Bloquea una subsanación enviada y la deja disponible para reevaluación. */
    private async markCorrectionSubmitted(applicationId: number): Promise<void> {
        await prisma.$transaction(async (tx) => {
            const observations = await tx.membershipObservation.findMany({
                where: { applicationId, status: ObservationStatus.PENDING },
                select: { reviewDepartment: true },
            });
            const departments = new Set(observations.map((observation) => observation.reviewDepartment));

            await tx.membershipObservation.updateMany({
                where: { applicationId, status: ObservationStatus.PENDING },
                data: { status: ObservationStatus.RESOLVED, resolvedAt: new Date() },
            });

            const validations = await tx.membershipValidation.findMany({
                where: { applicationId, status: ValidationStatus.OBSERVED },
                include: { department: true },
            });

            for (const validation of validations.filter((item) => departments.has(item.department.code))) {
                await tx.membershipValidation.update({
                    where: { id: validation.id },
                    data: { status: ValidationStatus.RESOLVED, validatedAt: new Date() },
                });
                await tx.membershipValidationHistory.create({
                    data: {
                        validationId: validation.id,
                        action: ValidationAction.SUBMITTED_CORRECTION,
                        comment: "El postulante envió la subsanación solicitada.",
                    },
                });
            }

            await new ApplicationStatusCalculatorService().recalculate(applicationId, tx);
        });
    }

    /**
     * Guarda el borrador.
     */
    private async updateDraft(
        trackingCode: string,
        dto: UpdateDraftDTO
    ): Promise<Application> {

        return await this.repository.updateDraft(
            trackingCode,
            dto
        );

    }

}
