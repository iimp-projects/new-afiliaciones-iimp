import { Application } from "../Entities/Application";
import { UpdateDraftDTO } from "../DTOs/update-draft.dto";
import { IApplicationRepository } from "../Repositories/Interfaces/IApplicationRepository";
import { prisma } from "@/lib/prisma";
import { ObservationStatus, ValidationAction, ValidationStatus } from "@prisma/client";
import { ApplicationStatusCalculatorService } from "./ApplicationStatusCalculatorService";
import { NotifyApplicantService } from "./NotifyApplicantService";

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
            await this.syncPersistedEntities(Number(application.id), dto.draftData);
            await this.markCorrectionSubmitted(Number(application.id));

            try {
                const notifyService = new NotifyApplicantService();
                await notifyService.notifyCorrectionReceived(application, dto.draftData);
            } catch (err) {
                console.error("[UpdateDraftService] Error enviando correo de confirmación de subsanación:", err);
            }
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
        const allowed = new Set(
            observations.flatMap((item) =>
                Array.isArray(item.fieldPaths)
                    ? item.fieldPaths.filter((path): path is string => typeof path === "string")
                    : []
            )
        );
        const current = (application.draftData ?? {}) as Record<string, any>;
        const proposed = dto.draftData as Record<string, any>;

        const compare = (before: any, after: any, path = ""): void => {
            if (JSON.stringify(before) === JSON.stringify(after)) return;
            // Si la ruta exacta está en las permitidas, se acepta cualquier cambio en esa rama
            if (path && allowed.has(path)) return;
            if (before && after && typeof before === "object" && typeof after === "object") {
                const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
                keys.forEach((key) => compare(before[key], after[key], path ? `${path}.${key}` : key));
                return;
            }
            if (!allowed.has(path)) throw new Error("Solo puede modificar los campos solicitados en la observación.");
        };
        Object.keys(proposed).forEach((section) => compare(current[section], proposed[section], section));

    }

    /**
     * Sincroniza las tablas relacionales (membership_documents, person, etc.)
     * con los datos subsanados del draftData para que el CMS y la BD se actualicen de inmediato.
     */
    private async syncPersistedEntities(applicationId: number, draftData: any): Promise<void> {
        if (!draftData) return;
        const draft = draftData as Record<string, any>;

        await prisma.$transaction(async (tx) => {
            const app = await tx.membershipApplication.findUnique({
                where: { id: applicationId },
            });
            if (!app) return;

            // 1. Sincronizar membership_documents
            await tx.applicationDocument.deleteMany({
                where: { applicationId },
            });

            const identityDoc = draft.personalInformation?.identityDocument;
            const identityUrl = typeof identityDoc === "string" ? identityDoc : identityDoc?.url;
            if (identityUrl) {
                await tx.applicationDocument.create({
                    data: {
                        applicationId,
                        category: "ID_DOCUMENT",
                        fileUrl: identityUrl,
                        fileName:
                            (typeof identityDoc === "object" && identityDoc?.name) ||
                            `Documento_Identidad_${draft.personalInformation?.documentNumber || app.documentNumber || ""}`,
                        mimeType: (typeof identityDoc === "object" && identityDoc?.type) || "application/pdf",
                        sizeBytes: BigInt(0),
                    },
                });
            }

            const photoDoc = draft.personalInformation?.photo;
            const photoUrl = typeof photoDoc === "string" ? photoDoc : photoDoc?.url;
            if (photoUrl) {
                await tx.applicationDocument.create({
                    data: {
                        applicationId,
                        category: "OTHER",
                        fileUrl: photoUrl,
                        fileName:
                            (typeof photoDoc === "object" && photoDoc?.name) ||
                            `Foto_${draft.personalInformation?.documentNumber || app.documentNumber || ""}`,
                        mimeType: (typeof photoDoc === "object" && photoDoc?.type) || "image/jpeg",
                        sizeBytes: BigInt(0),
                    },
                });
            }

            const declarationDoc = draft.endorsements?.declarationDocumentId;
            const declarationUrl = typeof declarationDoc === "string" ? declarationDoc : declarationDoc?.url;
            if (declarationUrl) {
                await tx.applicationDocument.create({
                    data: {
                        applicationId,
                        category: "SWORN_DECLARATION",
                        fileUrl: declarationUrl,
                        fileName:
                            (typeof declarationDoc === "object" && declarationDoc?.name) ||
                            "Declaracion_Jurada_Firmada.pdf",
                        mimeType: (typeof declarationDoc === "object" && declarationDoc?.type) || "application/pdf",
                        sizeBytes: BigInt(0),
                    },
                });
            }

            const universityLetter = draft.academicStudies?.[0]?.universityLetter;
            const letterUrl = typeof universityLetter === "string" ? universityLetter : universityLetter?.url;
            if (letterUrl) {
                await tx.applicationDocument.create({
                    data: {
                        applicationId,
                        category: "OTHER",
                        fileUrl: letterUrl,
                        fileName:
                            (typeof universityLetter === "object" && universityLetter?.name) ||
                            "Constancia_Estudios.pdf",
                        mimeType: (typeof universityLetter === "object" && universityLetter?.type) || "application/pdf",
                        sizeBytes: BigInt(0),
                    },
                });
            }

            // 2. Sincronizar datos de la persona si existe
            if (app.personId && draft.personalInformation) {
                const personal = draft.personalInformation;
                await tx.person.update({
                    where: { id: app.personId },
                    data: {
                        firstName: personal.names || undefined,
                        paternalLastName: personal.fatherLastName || undefined,
                        maternalLastName: personal.motherLastName || undefined,
                        birthDate: personal.birthDate ? new Date(personal.birthDate) : undefined,
                        gender: personal.gender || undefined,
                    },
                });
            }
        });
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
