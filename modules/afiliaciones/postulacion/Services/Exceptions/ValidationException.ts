import { ValidationError } from "../../Validators/ValidationError";

export class ValidationException extends Error {

    constructor(
        public readonly errors: ValidationError[]
    ) {
        super("La validación de la postulación ha fallado.");
        this.name = "ValidationException";
    }

}