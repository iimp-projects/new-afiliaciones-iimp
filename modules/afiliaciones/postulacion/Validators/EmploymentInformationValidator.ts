import { EmploymentInformation, resolveEmploymentStatus } from "../Models/EmploymentInformation";
import { BaseValidator } from "./BaseValidator";
import { ValidationResult } from "./ValidationResult";
import { ValidationRules } from "./ValidationRules";

const INVALID_PLACEHOLDERS = new Set(["-", ".", "..", "...", "N/A", "NA", "S/D", "SIN DATO", "SIN DIRECCION", "NO REGISTRA"]);
const normalizeText = (value?: string) => (value ?? "").trim().replace(/\s+/g, " ");

export function isValidEmploymentAddress(value?: string): boolean {
    const normalized = normalizeText(value);
    if (normalized.length < 8 || INVALID_PLACEHOLDERS.has(normalized.toUpperCase())) return false;
    const alphanumeric = normalized.match(/[A-Za-zÁÉÍÓÚáéíóúÑñ0-9]/g)?.length ?? 0;
    const symbols = normalized.match(/[^A-Za-zÁÉÍÓÚáéíóúÑñ0-9\s]/g)?.length ?? 0;
    return /[A-Za-zÁÉÍÓÚáéíóúÑñ]/.test(normalized) && alphanumeric >= 3 && normalized.includes(" ") && symbols / normalized.length <= 0.3;
}

export class EmploymentInformationValidator extends BaseValidator {

    public validate(
        data: EmploymentInformation
    ): ValidationResult {

        this.reset();

        const status = resolveEmploymentStatus(data);
        if (!status) {
            this.addError("employmentStatus", "EMPLOYMENT_STATUS_REQUIRED", "Seleccione su situación laboral actual.");
            return this.getResult();
        }
        if (status === "NOT_WORKING") return this.getResult();
        this.validateCompany(data, status);
        this.validatePosition(data, status);
        this.validateContact(data);
        this.validateAddress(data);
        this.validateTaxInformation(data);

        return this.getResult();

    }

    /**
     * Estado laboral.
     */
    /**
     * Empresa.
     */
    private validateCompany(data: EmploymentInformation, status: "EMPLOYED" | "SELF_EMPLOYED"): void {

        if (status === "EMPLOYED") ValidationRules.required(
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
        if (status === "EMPLOYED") this.validateMeaningful(data.companyName, "companyName", "COMPANY_CONTENT", "Ingrese un nombre de empresa válido.", 2);

        ValidationRules.maxLength(
            data.area,
            150,
            "area",
            this,
            "AREA_MAX_LENGTH",
            "El área no puede superar los 150 caracteres."
        );
        if (data.area?.trim()) this.validateMeaningful(data.area, "area", "AREA_CONTENT", "Ingrese un área o departamento válido.", 2);

    }

    /**
     * Cargo.
     */
    private validatePosition(data: EmploymentInformation, status: "EMPLOYED" | "SELF_EMPLOYED"): void {

        ValidationRules.required(
            data.positionName,
            "positionName",
            this,
            "POSITION_REQUIRED",
            status === "EMPLOYED" ? "El cargo es obligatorio." : "La actividad o profesión principal es obligatoria."
        );

        ValidationRules.maxLength(
            data.positionName,
            150,
            "positionName",
            this,
            "POSITION_MAX_LENGTH",
            "El cargo no puede superar los 150 caracteres."
        );
        this.validateMeaningful(data.positionName, "positionName", "POSITION_CONTENT", "Ingrese un cargo válido.", 2, true);

    }

    /**
     * Información de contacto.
     */
    private validateContact(data: EmploymentInformation): void {

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
            const phoneDigits = data.workPhone.replace(/\D/g, "");
            if (phoneDigits.length < 7 || phoneDigits.length > 15 || /^0+$/.test(phoneDigits)) this.addError("workPhone", "WORK_PHONE_CONTENT", "Ingrese un teléfono válido.");

        }

        if (
            ValidationRules.required(
                data.workEmail,
                "workEmail",
                this,
                "WORK_EMAIL_REQUIRED",
                "El correo profesional es obligatorio."
            )
        ) {

            ValidationRules.email(
                data.workEmail,
                "workEmail",
                this,
                "WORK_EMAIL_INVALID",
                "El correo corporativo no es válido."
            );
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(data.workEmail.trim())) this.addError("workEmail", "WORK_EMAIL_CONTENT", "Ingrese un correo corporativo válido.");

        }

        ValidationRules.maxLength(
            data.workExtension,
            10,
            "workExtension",
            this,
            "WORK_EXTENSION_MAX_LENGTH",
            "El anexo no puede superar los 10 caracteres."
        );
        if (data.workExtension?.trim() && !/^\d+$/.test(data.workExtension.trim())) this.addError("workExtension", "WORK_EXTENSION_INVALID", "El anexo debe contener únicamente números.");

    }

    /**
     * Dirección laboral.
     */
    private validateAddress(data: EmploymentInformation): void {

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
        if (data.workingAddress?.trim() && !isValidEmploymentAddress(data.workingAddress)) this.addError("workingAddress", "WORKING_ADDRESS_CONTENT", "Ingrese una dirección con información válida.");

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

    private validateMeaningful(value: string | undefined, field: string, code: string, message: string, minimumLength: number, requireLetter = false): void {
        const normalized = normalizeText(value);
        const hasAlphaNumeric = /[A-Za-zÁÉÍÓÚáéíóúÑñ0-9]/.test(normalized);
        const hasLetter = /[A-Za-zÁÉÍÓÚáéíóúÑñ]/.test(normalized);
        const symbols = normalized.match(/[^A-Za-zÁÉÍÓÚáéíóúÑñ0-9\s]/g)?.length ?? 0;
        if (normalized && (INVALID_PLACEHOLDERS.has(normalized.toUpperCase()) || normalized.length < minimumLength || !hasAlphaNumeric || (requireLetter && !hasLetter) || symbols / normalized.length > 0.45)) this.addError(field, code, message);
    }

}
