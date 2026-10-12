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

export type AssociateExcludedReason = "NO_ACCOUNT" | "NOT_ELIGIBLE_ACCOUNT" | "CONFLICT" | "NO_ACCESS_EMAIL" | "UNLINKED";

export interface AssociateExcludedItem {
  personId: number | null;
  documentNumber: string | null;
  nombre: string | null;
  correoContacto: string | null;
  reason: AssociateExcludedReason;
}

export interface AssociateRecipientSelection {
  filter: AssociateSourceFilter;
  eligible: AssociateRecipientCandidate[];
  excluded: AssociateExcludedItem[];
  totalEligible: number;
  totalExcluded: number;
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
