import { AcademicStudyValidator } from "./AcademicStudyValidator";
import { ApplicationDraft } from "../Models/ApplicationDraft";
import { BaseValidator } from "./BaseValidator";
import { PersonalInformationValidator } from "./PersonalInformationValidator";
import { ValidationResult } from "./ValidationResult";
import { EmploymentInformationValidator } from "./EmploymentInformationValidator";
import { EndorsementsValidator } from "./EndorsementsValidator";

export class ApplicationValidator extends BaseValidator {
  private readonly personalValidator = new PersonalInformationValidator();

  private readonly academicValidator = new AcademicStudyValidator();

  private readonly employmentValidator = new EmploymentInformationValidator();

  private readonly endorsementsValidator = new EndorsementsValidator();

  public validate(draft: ApplicationDraft): ValidationResult {
    this.reset();

    this.validatePersonalInformation(draft);

    this.validateAcademicStudies(draft);

    this.validateEmploymentInformation(draft);

    this.validateEndorsements(draft);

    return this.getResult();
  }

  /**
   * Valida el Paso 1: Información Personal.
   */
  private validatePersonalInformation(draft: ApplicationDraft): void {
    if (!draft.personalInformation) {
      this.addError(
        "personalInformation",
        "PERSONAL_INFORMATION_REQUIRED",
        "La información personal es obligatoria.",
      );

      return;
    }

    this.merge(this.personalValidator.validate(draft.personalInformation));
  }

  /**
   * Valida el Paso 2: Estudios Académicos.
   */
  private validateAcademicStudies(draft: ApplicationDraft): void {
    if (!draft.academicStudies || draft.academicStudies.length === 0) {
      this.addError(
        "academicStudies",
        "ACADEMIC_STUDY_REQUIRED",
        "Debe registrar al menos un estudio académico.",
      );

      return;
    }

    for (const study of draft.academicStudies) {
      this.merge(this.academicValidator.validate(study, draft.membershipType));
    }
  }

  /**
   * Valida el Paso 3: Información Laboral.
   */
  private validateEmploymentInformation(draft: ApplicationDraft): void {
    if (!draft.employmentInformation) {
      this.addError(
        "employmentInformation",
        "EMPLOYMENT_INFORMATION_REQUIRED",
        "La información laboral es obligatoria.",
      );

      return;
    }

    this.merge(this.employmentValidator.validate(draft.employmentInformation));
  }

  /**
   * Valida el Paso 4: Avales y Declaración Jurada.
   */
  private validateEndorsements(draft: ApplicationDraft): void {
    if (!draft.endorsements) {
      this.addError(
        "endorsements",
        "ENDORSEMENTS_REQUIRED",
        "La información de avales es obligatoria.",
      );

      return;
    }

    this.merge(this.endorsementsValidator.validate(draft.endorsements));
  }
}
