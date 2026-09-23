/**
 * Unicidad de contacto (correo y celular) durante la postulación.
 *
 * Encapsula la normalización y la detección de conflictos de forma pura para
 * que la regla de negocio sea testeable sin acceder a la base de datos.
 *
 * Reglas:
 * - El correo se normaliza con trim + lowercase.
 * - El celular se normaliza conservando únicamente los dígitos.
 * - Una postulación no entra en conflicto consigo misma (se excluye por id).
 * - Solo una postulación REJECTED deja de bloquear la reutilización de contacto;
 *   cualquier otro estado (incluido COMPLETED) bloquea.
 */
export interface ContactRecord {
  id: number;
  email?: string | null;
  phone?: string | null;
}

export interface ContactCandidate {
  email?: string | null;
  phone?: string | null;
  excludeId?: number;
}

export class ContactUniquenessService {
  static normalizeEmail(value?: string | null): string {
    return (value ?? "").trim().toLowerCase();
  }

  static normalizePhone(value?: string | null): string {
    return (value ?? "").replace(/\D/g, "");
  }

  /**
   * Regla de negocio definitiva para la unicidad de contacto.
   *
   * `REJECTED` es la única excepción: si la postulación anterior fue rechazada,
   * se permite volver a postular con el mismo correo/celular. Cualquier otro
   * estado (DRAFT, PENDING, UNDER_EVALUACION, OBSERVED, RESOLVED,
   * READY_FOR_PAYMENT, COMPLETED) bloquea la reutilización.
   */
  static blocksDuplicateReuse(status: string | null | undefined): boolean {
    return status !== "REJECTED";
  }

  /**
   * Detecta si el candidato colisiona con algún registro existente.
   *
   * Un valor vacío (tras normalización) nunca se considera duplicado: la
   * obligatoriedad del campo la resuelve la validación de formulario, no esta
   * regla de unicidad.
   */
  static detectConflict(
    existing: ContactRecord[],
    candidate: ContactCandidate,
  ): { email: boolean; phone: boolean } {
    const email = this.normalizeEmail(candidate.email);
    const phone = this.normalizePhone(candidate.phone);

    const others = existing.filter((record) => record.id !== candidate.excludeId);

    return {
      email: email.length > 0 && others.some((record) => this.normalizeEmail(record.email) === email),
      phone: phone.length > 0 && others.some((record) => this.normalizePhone(record.phone) === phone),
    };
  }
}
