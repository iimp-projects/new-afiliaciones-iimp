import { AcademicStudy } from "../Models/AcademicStudy";
import { MembershipType } from "../Types/MembershipType";
import { BaseValidator } from "./BaseValidator";
import { ValidationResult } from "./ValidationResult";
import { ValidationRules } from "./ValidationRules";

export class AcademicStudyValidator extends BaseValidator {

    public validate(
        data: AcademicStudy,
        membershipType: MembershipType
    ): ValidationResult {

        this.reset();

        this.validateInstitution(data);
        this.validateAcademicInformation(data);
        this.validateProfessionalInformation(data, membershipType);
        this.validateStudentInformation(data, membershipType);

        return this.getResult();

    }

    /**
     * Institución educativa.
     */
    private validateInstitution(
        data: AcademicStudy
    ): void {

        ValidationRules.required(
            data.institutionId,
            "institutionId",
            this,
            "INSTITUTION_REQUIRED",
            "La institución es obligatoria."
        );

        ValidationRules.requiredIf(
            data.institutionId === 0,
            data.otherInstitution,
            "otherInstitution",
            this,
            "OTHER_INSTITUTION_REQUIRED",
            "Debe indicar el nombre de la institución."
        );

    }

    /**
     * Formación académica.
     */
    private validateAcademicInformation(
        data: AcademicStudy
    ): void {

        ValidationRules.required(
            data.degreeTitle,
            "degreeTitle",
            this,
            "DEGREE_TITLE_REQUIRED",
            "El título o diploma es obligatorio."
        );

        ValidationRules.required(
            data.specialty,
            "specialty",
            this,
            "SPECIALTY_REQUIRED",
            "La especialidad es obligatoria."
        );

    }

    /**
     * Información profesional.
     */
    private validateProfessionalInformation(
        data: AcademicStudy,
        membershipType: MembershipType
    ): void {

        if (membershipType !== MembershipType.ASSOCIATE) {
            return;
        }

        ValidationRules.required(
            data.professionalAssociation,
            "professionalAssociation",
            this,
            "PROFESSIONAL_ASSOCIATION_REQUIRED",
            "El colegio profesional es obligatorio."
        );

        ValidationRules.required(
            data.registrationNumber,
            "registrationNumber",
            this,
            "REGISTRATION_NUMBER_REQUIRED",
            "El número de colegiatura es obligatorio."
        );

    }

    /**
     * Información para estudiantes.
     */
    private validateStudentInformation(
        data: AcademicStudy,
        membershipType: MembershipType
    ): void {

        if (membershipType !== MembershipType.STUDENT) {
            return;
        }

        ValidationRules.required(
            data.universityLetter,
            "universityLetter",
            this,
            "UNIVERSITY_LETTER_REQUIRED",
            "Debe adjuntar la carta de la universidad."
        );

        if (!data.studentTermsAccepted) {

            this.addError(
                "studentTermsAccepted",
                "STUDENT_TERMS_REQUIRED",
                "Debe aceptar las condiciones de la afiliación."
            );

        }

    }

}