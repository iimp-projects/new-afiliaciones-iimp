import { Application } from "../Entities/Application";
import { ApplicationDraft } from "../Models/ApplicationDraft";
import { IApplicationRepository } from "../Repositories/Interfaces/IApplicationRepository";
import { ApplicationValidator } from "../Validators/ApplicationValidator";
import { ValidationException } from "./Exceptions/ValidationException";

export class SubmitApplicationService {

    constructor(
        private readonly repository: IApplicationRepository,
        private readonly validator: ApplicationValidator
    ) {}

    async execute(
        trackingCode: string
    ): Promise<Application> {

        const application =
            await this.findApplication(trackingCode);

        this.ensureDraft(application);

        const draft = this.getDraft(application);

        this.validateDraft(draft);

        return await this.repository.submitApplication(
            trackingCode
        );

    }

    /**
     * Obtiene la postulación.
     */
    private async findApplication(
        trackingCode: string
    ): Promise<Application> {

        const application =
            await this.repository.findByTrackingCode(trackingCode);

        if (!application) {
            throw new Error(
                "La postulación no existe."
            );
        }

        return application;

    }

    /**
     * Verifica que la postulación pueda enviarse.
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
     * Obtiene el Draft tipado.
     */
    private getDraft(
        application: Application
    ): ApplicationDraft {

        if (!application.draftData) {

            throw new Error(
                "La postulación no contiene información para validar."
            );

        }

        return application.draftData as unknown as ApplicationDraft;

    }

    /**
     * Ejecuta todas las validaciones.
     */
    private validateDraft(
        draft: ApplicationDraft
    ): void {

        const result =
            this.validator.validate(draft);

        if (!result.valid) {

            throw new ValidationException(
                result.errors
            );

        }

    }

}