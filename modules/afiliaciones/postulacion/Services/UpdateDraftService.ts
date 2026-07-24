import { Application } from "../Entities/Application";
import { UpdateDraftDTO } from "../DTOs/update-draft.dto";
import { IApplicationRepository } from "../Repositories/Interfaces/IApplicationRepository";

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

        this.ensureDraft(application);

        return await this.updateDraft(
            trackingCode,
            dto
        );

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
    private ensureDraft(
        application: Application
    ): void {

        if (application.status !== "DRAFT") {

            throw new Error(
                "La postulación ya fue enviada."
            );

        }

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