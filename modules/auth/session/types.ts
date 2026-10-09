// Entidad de Dominio (DTO) - Sin rastro de @prisma/client
export interface SessionDTO {
  id: string; // Este es nuestro Opaque Token criptográfico
  userId: number;
  ipAddress: string | null;
  userAgent: string | null;
  os: string | null;
  browser: string | null;
  expiresAt: Date;
  lastActivityAt: Date;
  isRevoked: boolean;
  revokedAt: Date | null;
  revokeReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateSessionInput {
  userId: number;
  expiresAt: Date;
  ipAddress?: string | null;
  userAgent?: string | null;
  os?: string | null;
  browser?: string | null;
}

export type SessionExpiryReason = "IDLE" | "ABSOLUTE";

/** Datos seguros que el cliente necesita para representar el estado de sesión. */
export interface SessionStatusDTO {
  valid: boolean;
  serverNow: Date;
  expiresAt: Date | null;
  lastActivityAt: Date | null;
  effectiveExpiresAt: Date | null;
  expiryReason: SessionExpiryReason | null;
}
