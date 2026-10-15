import bcrypt from "bcryptjs";
import { CredentialType, type Prisma } from "@prisma/client";

/**
 * Compatibilidad de credenciales históricas SIE.
 *
 * Prepara (sin ejecutar por defecto) la importación de la contraseña SIE
 * de un asociado histórico como credencial bcrypt en `auth_credentials`.
 *
 * Invariantes de seguridad:
 * - Nunca almacena la `Clave` original; solo el hash bcrypt (cost 12).
 * - Nunca registra la contraseña ni el hash en logs o auditoría.
 * - Nunca sobrescribe una credencial PASSWORD activa existente.
 * - Nunca modifica el estado del usuario (permanece PENDING); no activa cuentas.
 * - No envía correos ni genera tokens.
 */

export const SIE_LEGACY_CREDENTIAL_BCRYPT_COST = 12;

/**
 * Longitud mínima de la Clave HISTÓRICA del SIE. El sistema legacy generó
 * claves de 4 a 6 caracteres y bcrypt las acepta; la política de contraseña
 * FUERTE (mínimo 8) aplica SOLO a contraseñas NUEVAS (activación/reset), no a
 * la importación de credenciales históricas. Se conserva un piso de 4 para
 * descartar valores residuales claramente inválidos.
 */
export const SIE_MIN_HISTORICAL_CLAVE_LENGTH = 4;

export type SieLegacyCredentialClassification =
  | "ELIGIBLE"
  | "EXCLUDED_IDENTITY_CONFLICT"
  | "EXCLUDED_NO_USER"
  | "EXCLUDED_NOT_PENDING"
  | "EXCLUDED_HAS_CREDENTIAL"
  | "EXCLUDED_EMPTY_CLAVE"
  | "EXCLUDED_WEAK_PASSWORD"
  | "EXCLUDED_INVALID_EMAIL";

export type SieUserStatus = "PENDING" | "ACTIVE" | "INACTIVE" | "BLOCKED";

export interface SieLegacyCredentialContext {
  hasUser: boolean;
  userStatus: SieUserStatus | null;
  /** true si el usuario posee CUALQUIER credencial (PASSWORD o PASSKEY, activa o no). */
  hasAnyCredential: boolean;
  email: string | null;
  identityConflict: boolean;
}

export interface SieLegacyCredentialCandidate {
  userId: number;
  email: string;
  clave: string;
  externalCode: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidLegacyCredentialEmail(email: string | null | undefined): boolean {
  return !!email && EMAIL_RE.test(email.trim());
}

export function isWeakSiePassword(clave: string): boolean {
  return clave.trim().length < SIE_MIN_HISTORICAL_CLAVE_LENGTH;
}

/**
 * Clasificación única y determinista por usuario. El orden de prioridad
 * refleja la política de seguridad: nunca se toca una cuenta con conflicto
 * de identidad, ni una cuenta no-PENDING, ni una credencial ya existente.
 */
export function classifyLegacyCredential(
  clave: string | null,
  ctx: SieLegacyCredentialContext,
): SieLegacyCredentialClassification {
  if (ctx.identityConflict) return "EXCLUDED_IDENTITY_CONFLICT";
  if (!ctx.hasUser) return "EXCLUDED_NO_USER";
  if (ctx.userStatus !== "PENDING") return "EXCLUDED_NOT_PENDING";
  if (ctx.hasAnyCredential) return "EXCLUDED_HAS_CREDENTIAL";
  if (clave === null || clave.trim().length === 0) return "EXCLUDED_EMPTY_CLAVE";
  if (isWeakSiePassword(clave)) return "EXCLUDED_WEAK_PASSWORD";
  if (!isValidLegacyCredentialEmail(ctx.email)) return "EXCLUDED_INVALID_EMAIL";
  return "ELIGIBLE";
}

export class SieLegacyCredentialError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SieLegacyCredentialError";
  }
}

export class SieLegacyCredentialConflictError extends SieLegacyCredentialError {
  constructor(message: string) {
    super(message);
    this.name = "SieLegacyCredentialConflictError";
  }
}

export class SieLegacyCredentialService {
  /**
   * Crea la credencial PASSWORD (bcrypt cost 12) para un usuario PENDING
   * sin credencial activa, dentro de una transacción y con bloqueo
   * advisory. No modifica el estado del usuario. Es idempotente por diseño:
   * si ya existe una credencial activa, lanza conflicto y no sobrescribe.
   */
  async importCredential(
    tx: Prisma.TransactionClient,
    candidate: SieLegacyCredentialCandidate,
    runId: string,
  ): Promise<{ credentialId: string }> {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`sie-legacy-credential:${candidate.userId}`}))`;

    // Regla innegociable: si el usuario ya posee CUALQUIER credencial
    // (PASSWORD o PASSKEY, activa o inactiva), no se toca nada.
    const existing = await tx.credential.findFirst({
      where: { userId: candidate.userId },
      select: { id: true },
    });
    if (existing) {
      throw new SieLegacyCredentialConflictError(
        "El usuario ya posee una credencial previa; no se modifica ni sobrescribe.",
      );
    }

    const secret = await bcrypt.hash(candidate.clave, SIE_LEGACY_CREDENTIAL_BCRYPT_COST);
    const credential = await tx.credential.create({
      data: { userId: candidate.userId, type: CredentialType.PASSWORD, secret, isActive: true },
    });

    // Marca el cambio obligatorio de contraseña en el primer ingreso. No cambia
    // el estado del usuario (permanece PENDING); solo prepara el flujo seguro.
    await tx.user.update({ where: { id: candidate.userId }, data: { mustChangePassword: true } });

    await tx.auditLog.create({
      data: {
        action: "SIE_LEGACY_CREDENTIAL_IMPORT",
        entity: "auth_credentials",
        entityId: credential.id,
        newValues: {
          recoveryRunId: runId,
          userId: candidate.userId,
          maskedEmail: maskEmail(candidate.email),
          externalCode: candidate.externalCode,
        },
      },
    });

    return { credentialId: credential.id };
  }

  /**
   * Completa el cambio obligatorio de contraseña del primer ingreso: actualiza
   * la credencial PASSWORD activa con el nuevo hash bcrypt (cost 12) y limpia
   * el flag `mustChangePassword`. No registra la contraseña ni el hash.
   */
  async completeFirstLoginPasswordChange(
    tx: Prisma.TransactionClient,
    userId: number,
    newPassword: string,
  ): Promise<void> {
    const secret = await bcrypt.hash(newPassword, SIE_LEGACY_CREDENTIAL_BCRYPT_COST);
    await tx.credential.updateMany({
      where: { userId, type: CredentialType.PASSWORD, isActive: true },
      data: { secret },
    });
    await tx.user.update({ where: { id: userId }, data: { mustChangePassword: false } });
    await tx.auditLog.create({
      data: {
        action: "SIE_FIRST_LOGIN_PASSWORD_CHANGE",
        entity: "auth_users",
        entityId: String(userId),
        newValues: { userId },
      },
    });
  }
}

function maskEmail(email: string): string {
  const at = email.indexOf("@");
  return at > 1 ? `${email.slice(0, 2)}***@${email.slice(at + 1)}` : "***";
}

export const sieLegacyCredentialService = new SieLegacyCredentialService();
