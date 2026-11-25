import type {
  AccessMovementMode,
  AccessMovementSource,
  AccessMovementType,
  AccessValidationResult,
} from "@prisma/client";

export type AccessReasonCode =
  | "OK"
  | "CARD_REVOKED"
  | "CARD_NOT_FOUND"
  | "TOKEN_INVALID"
  | "MEMBERSHIP_UNKNOWN"
  | "CATEGORY_NOT_ALLOWED"
  | "QUOTA_RESTRICTED"
  | "MANUAL_LOOKUP_DISABLED"
  | "ACTIVE_SESSION"
  | "NO_OPEN_SESSION"
  | "SITE_INACTIVE"
  | "POINT_INACTIVE"
  | "POINT_MODE_MISMATCH"
  | "OPERATOR_NOT_AUTHORIZED"
  | "TICKET_INVALID"
  | "TICKET_EXPIRED"
  | "IDEMPOTENT_REPLAY"
  | "SERVICE_ERROR";

export const ACCESS_REASON_MESSAGES: Record<AccessReasonCode, string> = {
  OK: "Acceso autorizado.",
  CARD_REVOKED: "La credencial fue revocada. Se requiere revisión administrativa.",
  CARD_NOT_FOUND: "No se encontró una credencial válida para el código escaneado.",
  TOKEN_INVALID: "El código QR no corresponde a una credencial institucional.",
  MEMBERSHIP_UNKNOWN: "No se pudo determinar la condición de membresía del asociado.",
  CATEGORY_NOT_ALLOWED: "La categoría del asociado no está autorizada para esta sede.",
  QUOTA_RESTRICTED: "El asociado presenta una restricción de cuotas configurada para esta sede.",
  MANUAL_LOOKUP_DISABLED: "La búsqueda manual está deshabilitada para esta sede.",
  ACTIVE_SESSION: "El asociado ya registra un ingreso activo en esta sede.",
  NO_OPEN_SESSION: "No se registra un ingreso abierto para esta sede.",
  SITE_INACTIVE: "La sede no está habilitada.",
  POINT_INACTIVE: "El punto de acceso no está habilitado.",
  POINT_MODE_MISMATCH: "El punto de acceso no permite el tipo de movimiento solicitado.",
  OPERATOR_NOT_AUTHORIZED: "El operador no está autorizado para esta sede o punto de acceso.",
  TICKET_INVALID: "La validación expiró o no es válida. Vuelva a escanear.",
  TICKET_EXPIRED: "La validación expiró. Vuelva a escanear la credencial.",
  IDEMPOTENT_REPLAY: "El movimiento ya fue registrado.",
  SERVICE_ERROR: "No se pudo completar la operación. Intente nuevamente.",
};

export type AccessPolicyConfig = {
  allowedMembershipCategories: string[] | null;
  requireActiveMembership: boolean;
  requireValidCard: boolean;
  quotaRestrictionEnabled: boolean;
  maxPendingQuotas: number | null;
  allowManualLookup: boolean;
};

export type AccessIdentityDto = {
  id: number;
  fullName: string;
  code: string | null;
  category: string | null;
  photoUrl: string | null;
};

export type AccessCardStatus = "ISSUED" | "REVOKED" | "NONE";

export type AccessSessionSummary = {
  open: boolean;
  sessionId: number | null;
  entryAt: string | null;
  entryPoint: string | null;
};

export type AccessValidationDto = {
  result: AccessValidationResult;
  reasonCode: AccessReasonCode;
  message: string;
  person: AccessIdentityDto | null;
  card: { status: AccessCardStatus };
  membership: { known: boolean; pendingQuotaCount: number; source: "NEW" | "MIGRATED" | null };
  session: AccessSessionSummary;
  site: { id: number; name: string };
  accessPoint: { id: number; name: string; movementMode: AccessMovementMode };
  movementType: AccessMovementType;
  ticket: string | null;
  ticketExpiresAt: string | null;
};

export type AccessMovementResultDto = {
  result: AccessValidationResult;
  reasonCode: AccessReasonCode;
  message: string;
  movementId: string | null;
  sessionId: number | null;
  movementType: AccessMovementType;
  occurredAt: string | null;
  idempotent: boolean;
};

export type AccessMovementSourceInput = Exclude<AccessMovementSource, "ADMIN_OVERRIDE">;

export type AccessMovementDto = {
  id: string;
  person: { id: number; fullName: string; code: string | null };
  site: { id: number; name: string };
  accessPoint: { id: number; name: string };
  movementType: AccessMovementType;
  validationResult: AccessValidationResult;
  reasonCode: string | null;
  source: AccessMovementSource;
  occurredAt: string;
  registeredBy: string | null;
};

export type AccessPresenceDto = {
  sessionId: number;
  person: { id: number; fullName: string; code: string | null; photoUrl: string | null };
  site: { id: number; name: string };
  entryPoint: { id: number; name: string };
  entryAt: string;
};
