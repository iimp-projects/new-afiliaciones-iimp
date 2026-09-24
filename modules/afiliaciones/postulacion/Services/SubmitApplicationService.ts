import { Application } from "../Entities/Application";
import { ApplicationDraft } from "../Models/ApplicationDraft";
import { IApplicationRepository } from "../Repositories/Interfaces/IApplicationRepository";
import { ApplicationValidator } from "../Validators/ApplicationValidator";
import { ValidationException } from "./Exceptions/ValidationException";
import { NotifySponsorsService } from "./NotifySponsorsService";
import { NotifyApplicantService } from "./NotifyApplicantService";
import { S3StorageService } from "@/modules/shared/Services/S3StorageService";
import { ApplicationAccessService } from "./ApplicationAccessService";
import { ApplicationFlowError } from "./Exceptions/ApplicationFlowError";
import { canSubmitApplication } from "../Models/ApplicationAction";

export class SubmitApplicationService {
  private readonly notifyService = new NotifySponsorsService();
  private readonly notifyApplicantService = new NotifyApplicantService();

  constructor(
    private readonly repository: IApplicationRepository,
    private readonly validator: ApplicationValidator,
  ) {}

  async execute(trackingCode: string, token?: string): Promise<Application> {
    const application = await this.findApplication(trackingCode);
    new ApplicationAccessService().require(Number(application.id), token);
    this.ensureDraft(application);

    const draft = this.getDraft(application);
    this.validateDraft(draft);

    // 1. Guardar en BD (commit de la postulación y persistencia de documentos).
    const submittedApplication =
      await this.repository.submitApplication(trackingCode);

    // 2. Recuperar la Declaración Jurada FIRMADA (una sola vez por submit).
    //    La fuente es ApplicationDocument(category = SWORN_DECLARATION); NO se
    //    regenera el PDF con DeclarationPdfService.
    let signedDeclarationBuffer: Buffer | undefined;
    try {
      const signedDocument = await this.repository.findSwornDeclaration(Number(submittedApplication.id));
      if (
        signedDocument
        && signedDocument.applicationId === Number(submittedApplication.id)
        && signedDocument.category === "SWORN_DECLARATION"
      ) {
        const s3StorageService = new S3StorageService();
        signedDeclarationBuffer = await s3StorageService.getObjectBuffer(
          signedDocument.fileUrl,
          [`afiliaciones/applications/${submittedApplication.id}`],
        );
      }
    } catch (signedDownloadError) {
      console.error("[SubmitApplicationService] No se pudo recuperar la Declaración Jurada firmada:", signedDownloadError);
    }

    // 3. Notificar al postulante con la declaración firmada (si está disponible).
    try {
      await this.notifyApplicantService.execute(submittedApplication, draft, signedDeclarationBuffer);
    } catch (applicantMailError) {
      console.error("[SubmitApplicationService] Error enviando correo al postulante:", applicantMailError);
    }

    // 4. Notificar a los avales con la MISMA declaración firmada.
    const isActiveMember = 
      draft.membershipType === "ACTIVE" || 
      (draft as any)?.affiliateType === "ACTIVE" ||
      submittedApplication.affiliateType === "ACTIVE";

    if (isActiveMember) {
      try {
        await this.notifyService.execute(submittedApplication, draft, signedDeclarationBuffer);
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
    if (!canSubmitApplication(application.status)) {
      throw new ApplicationFlowError("ALREADY_SUBMITTED", "Tu solicitud ya fue enviada. Puedes revisarla desde Consultar.");
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
