import { BaseValidator } from "./BaseValidator";

export class ValidationRules {
  /**
   * Campo obligatorio
   */
  static required(
    value: unknown,
    field: string,
    validator: BaseValidator,
    code: string,
    message: string,
  ): boolean {
    if (
      value === null ||
      value === undefined ||
      (typeof value === "string" && value.trim() === "")
    ) {
      validator.addError(field, code, message);
      return false;
    }

    return true;
  }

  /**
   * Solo letras, espacios y tildes
   */
  static onlyLetters(
    value: string | null | undefined,
    field: string,
    validator: BaseValidator,
    code: string,
    message: string,
  ): boolean {
    if (!value) return true;

    const regex = /^[A-Za-zÁÉÍÓÚáéíóúÑñ\s]+$/;

    if (!regex.test(value)) {
      validator.addError(field, code, message);
      return false;
    }

    return true;
  }

  /**
   * Correo electrónico
   */
  static email(
    value: string | null | undefined,
    field: string,
    validator: BaseValidator,
    code: string,
    message: string,
  ): boolean {
    if (!value) return true;

    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!regex.test(value)) {
      validator.addError(field, code, message);
      return false;
    }

    return true;
  }

  /**
   * Celular
   * Permite + y números
   */
  static phone(
    value: string | null | undefined,
    field: string,
    validator: BaseValidator,
    code: string,
    message: string,
  ): boolean {
    if (!value) return true;

    const regex = /^\+?[0-9]{6,20}$/;

    if (!regex.test(value)) {
      validator.addError(field, code, message);
      return false;
    }

    return true;
  }

  /**
   * Longitud mínima
   */
  static minLength(
    value: string | null | undefined,
    min: number,
    field: string,
    validator: BaseValidator,
    code: string,
    message: string,
  ): boolean {
    if (!value) return true;

    if (value.trim().length < min) {
      validator.addError(field, code, message);
      return false;
    }

    return true;
  }

  /**
   * Longitud máxima
   */
  static maxLength(
    value: string | null | undefined,
    max: number,
    field: string,
    validator: BaseValidator,
    code: string,
    message: string,
  ): boolean {
    if (!value) return true;

    if (value.trim().length > max) {
      validator.addError(field, code, message);
      return false;
    }

    return true;
  }

  /**
   * Campo obligatorio bajo una condición.
   */
  static requiredIf(
    condition: boolean,
    value: unknown,
    field: string,
    validator: BaseValidator,
    code: string,
    message: string,
  ): boolean {
    if (!condition) {
      return true;
    }

    return this.required(value, field, validator, code, message);
  }

  /**
   * Solo números.
   */
  static numeric(
    value: string | null | undefined,
    field: string,
    validator: BaseValidator,
    code: string,
    message: string,
  ): boolean {
    if (!value) return true;

    if (!/^\d+$/.test(value)) {
      validator.addError(field, code, message);
      return false;
    }

    return true;
  }

  /**
   * Valida mediante una expresión regular.
   */
  static regex(
   value: string | null | undefined,
    pattern: RegExp,
    field: string,
    validator: BaseValidator,
    code: string,
    message: string,
  ): boolean {
    if (!value) return true;

    if (!pattern.test(value)) {
      validator.addError(field, code, message);
      return false;
    }

    return true;
  }

  /**
   * Valida que el valor pertenezca a una lista.
   */
  static enum(
    value: string | number,
    allowedValues: Array<string | number>,
    field: string,
    validator: BaseValidator,
    code: string,
    message: string,
  ): boolean {
    if (value === null || value === undefined) {
      return true;
    }

    if (!allowedValues.includes(value)) {
      validator.addError(field, code, message);
      return false;
    }

    return true;
  }

  /**
   * Fecha válida.
   */
  static date(
    value: string | Date | null | undefined,
    field: string,
    validator: BaseValidator,
    code: string,
    message: string,
  ): boolean {
    if (!value) return true;

    const date = value instanceof Date ? value : new Date(value);

    if (isNaN(date.getTime())) {
      validator.addError(field, code, message);
      return false;
    }

    return true;
  }

  /**
   * Extensiones permitidas.
   */
  static allowedExtensions(
    file: File | { name: string } | null | undefined,
    allowed: string[],
    field: string,
    validator: BaseValidator,
    code: string,
    message: string,
  ): boolean {
    if (!file) return true;

    const extension = file.name.split(".").pop()?.toLowerCase();

    if (!extension || !allowed.includes(extension)) {
      validator.addError(field, code, message);
      return false;
    }

    return true;
  }

  /**
   * Tamaño máximo del archivo.
   */
  static maxFileSize(
    file: File | { size: number } | null | undefined,
    maxBytes: number,
    field: string,
    validator: BaseValidator,
    code: string,
    message: string,
  ): boolean {
    if (!file) return true;

    if (file.size > maxBytes) {
      validator.addError(field, code, message);
      return false;
    }

    return true;
  }
}
