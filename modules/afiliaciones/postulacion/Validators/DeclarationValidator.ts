import { Declaration } from "../Models/Declaration";
import { BaseValidator } from "./BaseValidator";
import { ValidationResult } from "./ValidationResult";
import { ValidationRules } from "./ValidationRules";

/**
 * Valida exclusivamente las reglas documentales de la Declaración Jurada
 * (aceptación + documento firmado). No valida avales: esos corresponden a
 * EndorsementsValidator (solo ACTIVE).
 */
export class DeclarationValidator extends BaseValidator {
    validate(declaration?: Declaration | null): ValidationResult {
        this.reset();

        if (!declaration) {
            this.addError(
                "declarationAccepted",
                "DECLARATION_ACCEPTANCE_REQUIRED",
                "Debe aceptar la Declaración Jurada."
            );
            this.addError(
                "declarationDocumentId",
                "DECLARATION_DOCUMENT_REQUIRED",
                "Debe adjuntar la Declaración Jurada firmada."
            );
            return this.getResult();
        }

        if (!declaration.declarationAccepted) {
            this.addError(
                "declarationAccepted",
                "DECLARATION_ACCEPTANCE_REQUIRED",
                "Debe aceptar la Declaración Jurada."
            );
        }

        ValidationRules.required(
            declaration.declarationDocumentId,
            "declarationDocumentId",
            this,
            "DECLARATION_DOCUMENT_REQUIRED",
            "Debe adjuntar la Declaración Jurada firmada."
        );

        return this.getResult();
    }
}
