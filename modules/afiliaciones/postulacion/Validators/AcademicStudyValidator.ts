import { AcademicStudy } from "../Models/AcademicStudy";
import { MembershipType } from "../Types/MembershipType";
import { BaseValidator } from "./BaseValidator";
import { ValidationResult } from "./ValidationResult";
import { ValidationRules } from "./ValidationRules";


export class AcademicStudyValidator extends BaseValidator {
    public validate(data: AcademicStudy, membershipType: MembershipType): ValidationResult {
        this.reset();
        this.validateInstitution(data);
        this.validateAcademicInformation(data, membershipType);
        this.validateProfessionalInformation(data, membershipType);
        this.validateDates(data);
        return this.getResult();
    }

    private validateInstitution(data: AcademicStudy): void {
        if (data.institutionId === undefined || data.institutionId === null) {
            this.addError("institutionId", "REQ", "Seleccione una universidad o instituto.");
        } else if (data.institutionId === 0) {
            if (ValidationRules.required(data.otherInstitution, "otherInstitution", this, "REQ", "Especifique el nombre de la institución.")) {
                ValidationRules.minLength(data.otherInstitution, 3, "otherInstitution", this, "MIN", "Debe tener al menos 3 caracteres.");
                ValidationRules.maxLength(data.otherInstitution, 150, "otherInstitution", this, "MAX", "Máximo 150 caracteres permitidos.");
            }
        }
    }

    private validateAcademicInformation(data: AcademicStudy, membershipType: MembershipType): void {

        // 👇 REGLAS PARA ESTUDIANTE
       // 👇 REGLAS PARA ESTUDIANTE
        if (membershipType === MembershipType.STUDENT) {
            if (!data.universityLetter) {
                this.addError("universityLetter", "REQ", "La constancia de estudios es obligatoria.");
            }
            if (!data.studentTermsAccepted) {
                this.addError("studentTermsAccepted", "REQ", "Debe aceptar las condiciones de afiliación.");
            }
            return; // Si es estudiante, validamos esto y salimos para no pedirle título ni especialidad obligatoria (o quita el return si quieres que también se lo pida).
        }

        if (ValidationRules.required(data.degreeTitle, "degreeTitle", this, "REQ", "El título o grado es obligatorio.")) {
            ValidationRules.minLength(data.degreeTitle, 5, "degreeTitle", this, "MIN", "Mínimo 5 caracteres.");
            ValidationRules.maxLength(data.degreeTitle, 200, "degreeTitle", this, "MAX", "Máximo 200 caracteres.");
        }

        if (ValidationRules.required(data.specialty, "specialty", this, "REQ", "Seleccione o ingrese una especialidad.")) {
            ValidationRules.minLength(data.specialty, 4, "specialty", this, "MIN", "Mínimo 4 caracteres.");
            ValidationRules.maxLength(data.specialty, 150, "specialty", this, "MAX", "Máximo 150 caracteres.");
        }
    }

    private validateProfessionalInformation(data: AcademicStudy, membershipType: MembershipType): void {
        if (membershipType !== MembershipType.ACTIVE) {
            return;
        }

        const association = (data.professionalAssociation || "").trim();
        const regNumber = (data.registrationNumber || "").trim();

        // 1. Si el usuario ingresó un Colegio Profesional
        if (association.length > 0) {
            ValidationRules.minLength(association, 3, "professionalAssociation", this, "MIN", "Mínimo 3 caracteres.");
            ValidationRules.maxLength(association, 100, "professionalAssociation", this, "MAX", "Máximo 100 caracteres.");

            // Obliga a ingresar el N° de Colegiatura
            if (regNumber.length === 0) {
                this.addError("registrationNumber", "REQ", "Ingrese el número de colegiatura si especifica un colegio profesional.");
            }
        }

        // 2. Si ingresó N° de Colegiatura
        if (regNumber.length > 0) {
            ValidationRules.numeric(regNumber, "registrationNumber", this, "NUM", "Solo se permiten números.");
            ValidationRules.lengthBetween(regNumber, 4, 15, "registrationNumber", this, "LEN", "Debe tener entre 4 y 15 dígitos.");
        }
    }

    private validateDates(data: AcademicStudy): void {
        const currentYear = new Date().getFullYear();

        if (data.admissionYear !== undefined && data.admissionYear !== null) {
            if (data.admissionYear < 1950 || data.admissionYear > currentYear) {
                this.addError("admissionYear", "INV_YEAR", `El año debe estar entre 1950 y ${currentYear}.`);
            }
        }

        if (data.graduationYear !== undefined && data.graduationYear !== null) {
            if (data.graduationYear < 1950 || data.graduationYear > currentYear + 7) {
                this.addError("graduationYear", "INV_YEAR", "El año de egreso no es válido.");
            }
            if (data.admissionYear && data.graduationYear < data.admissionYear) {
                this.addError("graduationYear", "INV_ORDER", "El egreso no puede ser antes del ingreso.");
            }
        }
    }
}