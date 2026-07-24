import { Endorsements } from "../Models/Endorsements";
import { BaseValidator } from "./BaseValidator";
import { ValidationResult } from "./ValidationResult";
import { ValidationRules } from "./ValidationRules";

export class EndorsementsValidator extends BaseValidator {

    validate(endorsements?: Endorsements): ValidationResult {

        this.reset();

        if (!endorsements) {
            this.addError(
                "endorsements",
                "ENDORSEMENTS_REQUIRED",
                "La información de avales es obligatoria."
            );

            return this.getResult();
        }

        this.validateFirstEndorsement(endorsements);

        this.validateSecondEndorsement(endorsements);

        this.validateDifferentEndorsements(endorsements);

        this.validateDeclaration(endorsements);

        this.validateDeclarationDocument(endorsements);

        return this.getResult();

    }

    /**
     * Valida el primer aval.
     */
    private validateFirstEndorsement(
        endorsements: Endorsements
    ): void {

        ValidationRules.required(
            endorsements.firstEndorsement?.sponsorDocumentNumber,
            "firstEndorsement.sponsorDocumentNumber",
            this,
            "FIRST_ENDORSEMENT_REQUIRED",
            "El DNI del primer aval es obligatorio."
        );

    }

    /**
     * Valida el segundo aval.
     */
    private validateSecondEndorsement(
        endorsements: Endorsements
    ): void {

        ValidationRules.required(
            endorsements.secondEndorsement?.sponsorDocumentNumber,
            "secondEndorsement.sponsorDocumentNumber",
            this,
            "SECOND_ENDORSEMENT_REQUIRED",
            "El DNI del segundo aval es obligatorio."
        );

    }

    /**
     * Valida que ambos avales sean distintos.
     */
    private validateDifferentEndorsements(
        endorsements: Endorsements
    ): void {

        const first =
            endorsements.firstEndorsement?.sponsorDocumentNumber?.trim();

        const second =
            endorsements.secondEndorsement?.sponsorDocumentNumber?.trim();

        if (
            first &&
            second &&
            first === second
        ) {

            this.addError(
                "secondEndorsement.sponsorDocumentNumber",
                "ENDORSEMENTS_MUST_BE_DIFFERENT",
                "Los avales deben ser diferentes."
            );

        }

    }

    /**
     * Valida la aceptación de la Declaración Jurada.
     */
    private validateDeclaration(
        endorsements: Endorsements
    ): void {

        if (!endorsements.declarationAccepted) {

            this.addError(
                "declarationAccepted",
                "DECLARATION_ACCEPTANCE_REQUIRED",
                "Debe aceptar la Declaración Jurada."
            );

        }

    }

    /**
     * Valida que exista la Declaración Jurada firmada.
     */
    private validateDeclarationDocument(
        endorsements: Endorsements
    ): void {

        ValidationRules.required(
            endorsements.declarationDocumentId,
            "declarationDocumentId",
            this,
            "DECLARATION_DOCUMENT_REQUIRED",
            "Debe adjuntar la Declaración Jurada firmada."
        );

    }

}