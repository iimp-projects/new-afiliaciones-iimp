import { BaseValidator } from "./BaseValidator";

export class ValidationRules {
  // --- REGLAS EXISTENTES MEJORADAS ---
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

  static requiredFile(
    file: File | { name: string } | null | undefined,
    field: string,
    validator: BaseValidator,
    code: string,
    message: string,
  ): boolean {
    if (!file) {
      validator.addError(field, code, message);
      return false;
    }
    return true;
  }

  static onlyLetters(
    value: string | null | undefined,
    field: string,
    validator: BaseValidator,
    code: string,
    message: string,
  ): boolean {
    if (!value) return true;
    // Permite tildes, ñ, y espacios. Bloquea números y emojis.
    const regex = /^[A-Za-zÁÉÍÓÚáéíóúÑñ\s]+$/;
    if (!regex.test(value)) {
      validator.addError(field, code, message);
      return false;
    }
    return true;
  }

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

  static numeric(
    value: string | null | undefined,
    field: string,
    validator: BaseValidator,
    code: string,
    message: string,
  ): boolean {
    if (!value) return true;
    if (!/^\d+$/.test(value.trim())) {
      validator.addError(field, code, message);
      return false;
    }
    return true;
  }

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

  // --- NUEVAS REGLAS DE NEGOCIO ---
  static exactLength(
    value: string | null | undefined,
    exact: number,
    field: string,
    validator: BaseValidator,
    code: string,
    message: string,
  ): boolean {
    if (!value) return true;
    if (value.trim().length !== exact) {
      validator.addError(field, code, message);
      return false;
    }
    return true;
  }

  static lengthBetween(
    value: string | null | undefined,
    min: number,
    max: number,
    field: string,
    validator: BaseValidator,
    code: string,
    message: string,
  ): boolean {
    if (!value) return true;
    const len = value.trim().length;
    if (len < min || len > max) {
      validator.addError(field, code, message);
      return false;
    }
    return true;
  }

  static alphaNumeric(
    value: string | null | undefined,
    field: string,
    validator: BaseValidator,
    code: string,
    message: string,
  ): boolean {
    if (!value) return true;
    if (!/^[A-Za-z0-9]+$/.test(value.trim())) {
      validator.addError(field, code, message);
      return false;
    }
    return true;
  }

  static addressFormat(
    value: string | null | undefined,
    field: string,
    validator: BaseValidator,
    code: string,
    message: string,
  ): boolean {
    if (!value) return true;
    // Letras, números, espacios, comas, puntos, guiones y el símbolo de grados °
    if (!/^[A-Za-zÁÉÍÓÚáéíóúÑñ0-9\s,.\-°]+$/.test(value.trim())) {
      validator.addError(field, code, message);
      return false;
    }
    return true;
  }

  static notFutureDate(
    value: string | Date | null | undefined,
    field: string,
    validator: BaseValidator,
    code: string,
    message: string,
  ): boolean {
    if (!value) return true;
    const date = new Date(value);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (date > today) {
      validator.addError(field, code, message);
      return false;
    }
    return true;
  }

  static validateAgeRange(
    value: string | Date | null | undefined,
    minAge: number,
    maxAge: number,
    field: string,
    validator: BaseValidator,
    code: string,
    message: string,
  ): boolean {
    if (!value) return true;
    const birthDate = new Date(value);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();

    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }

    if (age < minAge || age > maxAge) {
      validator.addError(field, code, message);
      return false;
    }
    return true;
  }

  // --- REGLAS DE ARCHIVOS (Existentes) ---
  static allowedExtensions(
    file: any, // Cambiado a any para evitar errores de tipado con objetos vacíos
    allowed: string[],
    field: string,
    validator: BaseValidator,
    code: string,
    message: string,
  ): boolean {
    // BLINDAJE: Si el archivo es nulo, o si viene serializado de la BD como {}
    if (!file || !file.name || typeof file.name !== "string") {
      return true;
    }

    const extension = file.name.split(".").pop()?.toLowerCase();
    if (!extension || !allowed.includes(extension)) {
      validator.addError(field, code, message);
      return false;
    }
    return true;
  }

  static maxFileSize(
    file: any, // Cambiado a any
    maxBytes: number,
    field: string,
    validator: BaseValidator,
    code: string,
    message: string,
  ): boolean {
    // BLINDAJE: Si el archivo es nulo, o si viene serializado de la BD como {}
    if (!file || typeof file.size !== "number") {
      return true;
    }

    if (file.size > maxBytes) {
      validator.addError(field, code, message);
      return false;
    }
    return true;
  }

  /**
   * Campo obligatorio bajo una condición
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
   * Validación de formato de teléfono o celular básico
   */
  static phone(
    value: string | null | undefined,
    field: string,
    validator: BaseValidator,
    code: string,
    message: string,
  ): boolean {
    if (!value) return true;
    // Permite números, espacios, el signo más y paréntesis
    const regex = /^[0-9+\s\-()]{7,20}$/;
    if (!regex.test(value.trim())) {
      validator.addError(field, code, message);
      return false;
    }
    return true;
  }
}
