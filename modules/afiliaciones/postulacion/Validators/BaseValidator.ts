import { ValidationError } from "./ValidationError";
import { ValidationResult } from "./ValidationResult";

export abstract class BaseValidator {
  protected readonly errors: ValidationError[] = [];

  /**
   * Agrega un error de validación.
   */
  public addError(field: string, code: string, message: string): void {
    this.errors.push({
      field,
      code,
      message,
    });
  }
  /**
   * Indica si existen errores.
   */
  protected hasErrors(): boolean {
    return this.errors.length > 0;
  }

  /**
   * Retorna el resultado de la validación.
   */
  protected getResult(): ValidationResult {
    return {
      valid: !this.hasErrors(),
      errors: this.errors,
    };
  }

  /**
   * Limpia los errores antes de una nueva validación.
   */
  protected reset(): void {
    this.errors.length = 0;
  }

  protected merge(result: ValidationResult): void {
    for (const error of result.errors) {
      this.errors.push(error);
    }
  }
}
