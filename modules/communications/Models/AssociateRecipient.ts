/** Filtro de origen "Asociados del sistema" (tipo de membresía, no estado de cuenta). */
export type AssociateSourceFilter = "ALL" | "ACTIVE" | "STUDENT";

export type AssociateTipoAsociado = "ACTIVO" | "ESTUDIANTE";

/** Estado administrativo de la cuenta de acceso (no el tipo de membresía). */
export type AssociateAccountStatus = "ACTIVE" | "PENDING";

export interface AssociateRecipientCandidate {
  userId: number;
  personId: number | null;
  nombreCompleto: string;
  /** Fuente de autenticación verificada (User.email), normalizada a minúsculas. */
  correoAcceso: string;
  tipoAsociado: AssociateTipoAsociado;
  accountStatus: AssociateAccountStatus;
  documentNumber: string | null;
}

export type AssociateExcludedReason = "NO_ACCOUNT" | "NOT_ELIGIBLE_ACCOUNT" | "CONFLICT" | "NO_ACCESS_EMAIL" | "UNLINKED" | "NO_ASOCIADO";

export interface AssociateExcludedItem {
  personId: number | null;
  documentNumber: string | null;
  nombre: string | null;
  correoContacto: string | null;
  reason: AssociateExcludedReason;
}

export interface AssociateRecipientSelection {
  filter: AssociateSourceFilter;
  /** Muestra visual (primera página, máximo 50). */
  eligible: AssociateRecipientCandidate[];
  /** Número de elegibles mostrados en esta muestra. */
  shownCount: number;
  /** Total real de elegibles (correos válidos, únicos y utilizables). */
  totalEligible: number;
  /** Muestra de excluidos reales (asociados a revisar). */
  excluded: AssociateExcludedItem[];
  /** Conteo real de excluidos por motivo (asociados a revisar). */
  excludedByReason: Record<AssociateExcludedReason, number>;
  /** Total real de asociados a revisar (sin incluir SIE no-login). */
  totalExcluded: number;
  /** Registros SIE de categorías que NO son activos ni estudiantes. */
  totalNonAssociate: number;
}

/** Snapshot por destinatario de campaña (EmailCampaignRecipient.metadata). */
export interface AssociateRecipientMetadata {
  source: "associates";
  userId: number;
  personId: number | null;
  nombreCompleto: string;
  /** Correo de acceso capturado al preparar la campaña. */
  correoAcceso: string;
  tipoAsociado: AssociateTipoAsociado;
  accountStatus: AssociateAccountStatus;
  documentNumber: string | null;
}

/** Enlace corto persistido en EmailRecipient.metadata (origen "Asociados del sistema"). */
export interface AssociateRecipientLink {
  userId: number;
}

/** Identidad normalizada de un usuario de acceso + persona, para (re)construir el snapshot. */
export interface AssociateIdentity {
  userId: number;
  personId: number | null;
  email: string;
  status: string;
  deletedAt?: Date | null;
  roleSlug: string | null;
  nombreCompleto: string | null;
  documentNumber: string | null;
}

/** Extrae el enlace de asociado ({ source: "associates", userId }) de un metadata JSON. */
export function toAssociateRecipientLink(metadata: unknown): AssociateRecipientLink | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const value = metadata as Record<string, unknown>;
  if (value.source !== "associates" || typeof value.userId !== "number") return null;
  return { userId: value.userId };
}

/** Construye el snapshot completo de asociado desde su identidad verificada. */
export function buildAssociateMetadata(identity: AssociateIdentity | null | undefined): AssociateRecipientMetadata | null {
  if (!identity) return null;
  return {
    source: "associates",
    userId: identity.userId,
    personId: identity.personId,
    nombreCompleto: identity.nombreCompleto ?? "",
    correoAcceso: identity.email.trim().toLowerCase(),
    tipoAsociado: identity.roleSlug === "ASOCIADO_ESTUDIANTE" ? "ESTUDIANTE" : "ACTIVO",
    accountStatus: identity.status === "ACTIVE" ? "ACTIVE" : "PENDING",
    documentNumber: identity.documentNumber,
  };
}

export function tipoAsociadoLabel(tipoAsociado: AssociateTipoAsociado): string {
  return tipoAsociado === "ESTUDIANTE" ? "Asociado Estudiante" : "Asociado Activo";
}

export function personFullName(firstName?: string | null, paternalLastName?: string | null, maternalLastName?: string | null): string | null {
  const value = [firstName, paternalLastName, maternalLastName].filter(Boolean).join(" ").trim();
  return value || null;
}
