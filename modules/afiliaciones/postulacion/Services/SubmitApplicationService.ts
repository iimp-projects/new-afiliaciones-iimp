import { Application } from "../Entities/Application";
import { ApplicationDraft } from "../Models/ApplicationDraft";
import { IApplicationRepository } from "../Repositories/Interfaces/IApplicationRepository";
import { ApplicationValidator } from "../Validators/ApplicationValidator";
import { ValidationException } from "./Exceptions/ValidationException";
import { NotifySponsorsService } from "./NotifySponsorsService";
import { NotifyApplicantService } from "./NotifyApplicantService";
import { DeclarationPdfService } from "./DeclarationPdfService";

export class SubmitApplicationService {
  private readonly notifyService = new NotifySponsorsService();
  private readonly notifyApplicantService = new NotifyApplicantService();
  private readonly declarationPdfService = new DeclarationPdfService();

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

    // 2. Generar el PDF en memoria en un scope global a la función
    let pdfBuffer: Buffer | undefined;
    try {
      const pdfUint8Array = await this.declarationPdfService.generate(draft);
      pdfBuffer = Buffer.from(pdfUint8Array);
    } catch (pdfError) {
      console.error("[SubmitApplicationService] Error generando PDF:", pdfError);
    }

    // 3. Notificar al postulante con el PDF
    try {
      await this.notifyApplicantService.execute(submittedApplication, draft, pdfBuffer);
    } catch (applicantMailError) {
      console.error("[SubmitApplicationService] Error enviando correo al postulante:", applicantMailError);
    }

    // 4. Enviar notificaciones a los avales pasando TAMBIÉN el pdfBuffer
    const isActiveMember = 
      draft.membershipType === "ACTIVE" || 
      (draft as any)?.affiliateType === "ACTIVE" ||
      submittedApplication.affiliateType === "ACTIVE";

    if (isActiveMember) {
      try {
        await this.notifyService.execute(submittedApplication, draft, pdfBuffer);
      } catch (sponsorsMailError) {
        console.error("[SubmitApplicationService] Error enviando correo a los avales:", sponsorsMailError);
      }
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
    if (application.status !== "DRAFT" && application.status !== "PENDING") {
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