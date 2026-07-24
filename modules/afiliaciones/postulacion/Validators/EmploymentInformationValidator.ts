import { EmploymentInformation } from "../Models/EmploymentInformation";
import { BaseValidator } from "./BaseValidator";
import { ValidationResult } from "./ValidationResult";
import { ValidationRules } from "./ValidationRules";

export class EmploymentInformationValidator extends BaseValidator {

    public validate(
        data: EmploymentInformation
    ): ValidationResult {

        this.reset();

        this.validateEmploymentStatus(data);
        this.validateCompany(data);
        this.validatePosition(data);
        this.validateContact(data);
        this.validateAddress(data);
        this.validateTaxInformation(data);

        return this.getResult();

    }

    /**
     * Estado laboral.
     */
    private validateEmploymentStatus(
        data: EmploymentInformation
    ): void {

        if (data.isIndependent && data.isUnemployed) {

            this.addError(
                "employmentStatus",
                "INVALID_EMPLOYMENT_STATUS",
                "No puede seleccionar Profesional Independiente y Actualmente no laboro al mismo tiempo."
            );

        }

    }

    /**
     * Empresa.
     */
    private validateCompany(
        data: EmploymentInformation
    ): void {

        if (data.isUnemployed) {
            return;
        }

        ValidationRules.required(
            data.companyName,
            "companyName",
            this,
            "COMPANY_REQUIRED",
            "La empresa es obligatoria."
        );

        ValidationRules.maxLength(
            data.companyName,
            150,
            "companyName",
            this,
            "COMPANY_MAX_LENGTH",
            "La empresa no puede superar los 150 caracteres."
        );

        ValidationRules.maxLength(
            data.area,
            150,
            "area",
            this,
            "AREA_MAX_LENGTH",
            "El área no puede superar los 150 caracteres."
        );

    }

    /**
     * Cargo.
     */
    private validatePosition(
        data: EmploymentInformation
    ): void {

        if (data.isUnemployed) {
            return;
        }

        ValidationRules.required(
            data.positionName,
            "positionName",
            this,
            "POSITION_REQUIRED",
            "El cargo es obligatorio."
        );

        ValidationRules.maxLength(
            data.positionName,
            150,
            "positionName",
            this,
            "POSITION_MAX_LENGTH",
            "El cargo no puede superar los 150 caracteres."
        );

    }

    /**
     * Información de contacto.
     */
    private validateContact(
        data: EmploymentInformation
    ): void {

        if (data.isUnemployed) {
            return;
        }

        if (
            ValidationRules.required(
                data.workPhone,
                "workPhone",
                this,
                "WORK_PHONE_REQUIRED",
                "El teléfono es obligatorio."
            )
        ) {

            ValidationRules.phone(
                data.workPhone,
                "workPhone",
                this,
                "WORK_PHONE_INVALID",
                "El teléfono no es válido."
            );

        }

        if (
            ValidationRules.required(
                data.workEmail,
                "workEmail",
                this,
                "WORK_EMAIL_REQUIRED",
                "El correo corporativo es obligatorio."
            )
        ) {

            ValidationRules.email(
                data.workEmail,
                "workEmail",
                this,
                "WORK_EMAIL_INVALID",
                "El correo corporativo no es válido."
            );

        }

        ValidationRules.maxLength(
            data.workExtension,
            10,
            "workExtension",
            this,
            "WORK_EXTENSION_MAX_LENGTH",
            "El anexo no puede superar los 10 caracteres."
        );

    }

    /**
     * Dirección laboral.
     */
    private validateAddress(
        data: EmploymentInformation
    ): void {

        if (data.isUnemployed) {
            return;
        }

        ValidationRules.required(
            data.workingAddress,
            "workingAddress",
            this,
            "WORKING_ADDRESS_REQUIRED",
            "La dirección laboral es obligatoria."
        );

        ValidationRules.maxLength(
            data.workingAddress,
            250,
            "workingAddress",
            this,
            "WORKING_ADDRESS_MAX_LENGTH",
            "La dirección no puede superar los 250 caracteres."
        );

    }

    /**
     * Información tributaria.
     */
    private validateTaxInformation(
        data: EmploymentInformation
    ): void {

        if (!data.companyTaxId) {
            return;
        }

        ValidationRules.numeric(
            data.companyTaxId,
            "companyTaxId",
            this,
            "COMPANY_TAX_ID_INVALID",
            "El RUC solo debe contener números."
        );

        ValidationRules.minLength(
            data.companyTaxId,
            11,
            "companyTaxId",
            this,
            "COMPANY_TAX_ID_LENGTH",
            "El RUC debe tener 11 dígitos."
        );

        ValidationRules.maxLength(
            data.companyTaxId,
            11,
            "companyTaxId",
            this,
            "COMPANY_TAX_ID_LENGTH",
            "El RUC debe tener 11 dígitos."
        );

    }

}