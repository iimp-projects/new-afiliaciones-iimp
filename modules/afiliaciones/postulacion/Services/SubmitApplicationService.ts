import { Application } from "../Entities/Application";
import { ApplicationDraft } from "../Models/ApplicationDraft";
import { IApplicationRepository } from "../Repositories/Interfaces/IApplicationRepository";
import { ApplicationValidator } from "../Validators/ApplicationValidator";
import { ValidationException } from "./Exceptions/ValidationException";
import { NotifySponsorsService } from "./NotifySponsorsService";

export class SubmitApplicationService {

  private readonly notifyService = new NotifySponsorsService();
  
  constructor(
    private readonly repository: IApplicationRepository,
    private readonly validator: ApplicationValidator,
  ) {}

  async execute(trackingCode: string): Promise<Application> {
    const application = await this.findApplication(trackingCode);
    this.ensureDraft(application);

    const draft = this.getDraft(application);
    this.validateDraft(draft);

    // 1. Guardar en BD
    const submittedApplication =
      await this.repository.submitApplication(trackingCode);

    // 2. NUEVO: Enviar notificaciones a los avales si es Asociado Activo
    if (draft.membershipType === "ACTIVE") {
      // El proceso de envío de correos no debe bloquear la respuesta al usuario.
      // Lo enviamos sin "await" para que corra en segundo plano, o con "await" si prefieres asegurar el envío.
      await this.notifyService.execute(submittedApplication, draft);
    }

    return submittedApplication;
  }

  /**
   * Obtiene la postulación.
   */
  private async findApplication(trackingCode: string): Promise<Application> {
    const application = await this.repository.findByTrackingCode(trackingCode);

    if (!application) {
      throw new Error("La postulación no existe.");
    }

    return application;
  }

  /**
   * Verifica que la postulación pueda enviarse.
   */
  private ensureDraft(application: Application): void {
    if (application.status !== "DRAFT") {
      throw new Error("La postulación ya fue enviada.");
    }
  }

  /**
   * Obtiene el Draft tipado.
   */
  private getDraft(application: Application): ApplicationDraft {
    if (!application.draftData) {
      throw new Error("La postulación no contiene información para validar.");
    }

    return application.draftData as unknown as ApplicationDraft;
  }

  /**
   * Ejecuta todas las validaciones.
   */
  private validateDraft(draft: ApplicationDraft): void {
    const result = this.validator.validate(draft);

    if (!result.valid) {
      throw new ValidationException(result.errors);
    }
  }
}
