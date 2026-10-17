import type { Prisma, PrismaClient } from "@prisma/client";

/**
 * Aprovisionamiento seguro de cuentas para asociados históricos SIE.
 *
 * Crea únicamente cuentas PENDING (sin credenciales, sin tokens, sin correo).
 * La activación se realiza después, por el flujo existente
 * `accountActivationService`, cuando el asociado define su contraseña.
 *
 * Nunca importa la `Clave` del SIE ni genera contraseñas compartidas.
 */

export const SIE_PROVISIONING_ROLES = {
  A: "ASOCIADO_ACTIVO",
  E: "ASOCIADO_ESTUDIANTE",
} as const;

export type SieProvisioningClassification =
  | "ELIGIBLE"
  | "EXCLUDED_HAS_USER"
  | "EXCLUDED_NON_AE"
  | "EXCLUDED_NO_EMAIL"
  | "EXCLUDED_INVALID_EMAIL"
  | "EXCLUDED_EMAIL_CONFLICT"
  | "EXCLUDED_DUPLICATE_EMAIL";

export interface SieProvisioningContext {
  hasUser: boolean;
  isActiveOrStudent: boolean;
  email: string | null;
  /** true si el email ya pertenece a otra cuenta (auth_user distinto). */
  emailOwnedByOtherAccount: boolean;
  /** true si el email aparece en los contactos de más de una persona. */
  emailSharedAcrossPersons: boolean;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidProvisioningEmail(email: string | null | undefined): boolean {
  return !!email && EMAIL_RE.test(email.trim());
}

export function normalizeProvisioningEmail(email: string | null | undefined): string | null {
  return email ? email.trim().toLowerCase() : null;
}

/** Clasificación única y determinista por persona. */
export function classifyProvisioning(ctx: SieProvisioningContext): SieProvisioningClassification {
  if (ctx.hasUser) return "EXCLUDED_HAS_USER";
  if (!ctx.isActiveOrStudent) return "EXCLUDED_NON_AE";
  if (!ctx.email) return "EXCLUDED_NO_EMAIL";
  if (!isValidProvisioningEmail(ctx.email)) return "EXCLUDED_INVALID_EMAIL";
  if (ctx.emailOwnedByOtherAccount) return "EXCLUDED_EMAIL_CONFLICT";
  if (ctx.emailSharedAcrossPersons) return "EXCLUDED_DUPLICATE_EMAIL";
  return "ELIGIBLE";
}

export interface SieProvisioningCandidate {
  personId: number;
  email: string;
  roleSlug: "ASOCIADO_ACTIVO" | "ASOCIADO_ESTUDIANTE";
  sourceType: "A" | "E";
  externalCode: string;
}

export class SieUserProvisioningService {
  async provisionUser(
    tx: Prisma.TransactionClient,
    candidate: SieProvisioningCandidate,
    roleId: number,
    runId: string,
  ): Promise<{ userId: number }> {
    const ins = await tx.$queryRawUnsafe<Array<{ id: number; audit_rows: number }>>(
      `WITH ins AS (
         INSERT INTO auth_users (email, person_id, role_id, type, status, email_verified, created_at, updated_at)
         VALUES ($1, $2, $3, 'AFFILIATE'::"UserType", 'PENDING'::"UserStatus", NULL, now(), now())
         RETURNING id
       ),
       audit AS (
         INSERT INTO sys_audit_logs (id, trace_id, action, entity, entity_id, new_values, created_at)
         SELECT gen_random_uuid(), $4, 'SIE_PROVISION_USER', 'auth_users', ins.id::text,
                jsonb_build_object('recovery_run_id',$4,'role_slug',$5,'masked_email',$6),
                now()
         FROM ins RETURNING entity_id
       )
       SELECT ins.id, (SELECT count(*)::int FROM audit) AS audit_rows FROM ins`,
      candidate.email,
      candidate.personId,
      roleId,
      runId,
      candidate.roleSlug,
      maskEmail(candidate.email),
    );
    if (ins.length !== 1) throw new Error("PROVISION_INSERT_MISMATCH");
    if (Number(ins[0].audit_rows) !== 1) throw new Error("PROVISION_AUDIT_MISMATCH");
    return { userId: Number(ins[0].id) };
  }
}

function maskEmail(email: string): string {
  const at = email.indexOf("@");
  return at > 1 ? `${email.slice(0, 2)}***@${email.slice(at + 1)}` : "***";
}

export type { PrismaClient };
