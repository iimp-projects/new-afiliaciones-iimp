import "dotenv/config";
import { execSync } from "child_process";
import { randomUUID } from "crypto";
import { PrismaClient } from "@prisma/client";
import {
  classifyProvisioning,
  isValidProvisioningEmail,
  normalizeProvisioningEmail,
  SieUserProvisioningService,
  type SieProvisioningCandidate,
  type SieProvisioningClassification,
} from "../modules/afiliaciones/asociados/Services/SieUserProvisioningService";

const prisma = new PrismaClient();
const service = new SieUserProvisioningService();

const QA_AWS_ACCOUNT = "564914947461";
const QA_AWS_REGION = "us-east-2";

/**
 * Guarda de ejecución. LOCAL exige localhost. QA exige `--environment qa`
 * + `--execute` + `--confirm` y verifica la identidad AWS (cuenta/región),
 * porque QA y PROD comparten cuenta; la identidad AWS por sí sola no basta.
 * Nunca debilita la protección de LOCAL.
 */
function assertExecutionTarget(argv: string[], mode: string): void {
  const envIdx = argv.indexOf("--environment");
  const environment = envIdx !== -1 ? argv[envIdx + 1] : "local";

  if (environment === "qa") {
    if (mode !== "execute") throw new Error("QA requiere --execute explícito.");
    if (!argv.includes("--confirm")) throw new Error("QA requiere --confirm explícito.");
    const account = execSync("aws sts get-caller-identity --query Account --output text", { encoding: "utf8" }).trim();
    if (account !== QA_AWS_ACCOUNT) throw new Error(`REFUSE_WRONG_AWS_ACCOUNT: ${account}. Se espera ${QA_AWS_ACCOUNT}.`);
    const region = process.env.AWS_DEFAULT_REGION ?? process.env.AWS_REGION ?? "";
    if (region !== QA_AWS_REGION) throw new Error(`REFUSE_WRONG_REGION: ${region}. Se espera ${QA_AWS_REGION}.`);
    return;
  }

  const url = process.env.DATABASE_URL ?? "";
  let hostname = "";
  try { hostname = new URL(url).hostname; } catch { throw new Error("DATABASE_URL inválida."); }
  const local = ["localhost", "127.0.0.1", "::1"].includes(hostname.toLowerCase());
  if (!local) throw new Error(`REFUSE_NON_LOCAL_TARGET: host ${hostname}. Para QA usa --environment qa --execute --confirm.`);
}

function parseArgs(argv: string[]): { mode: "dry-run" | "execute"; limit: number; batchSize: number; sourceType: "A" | "E" | null } {
  let mode: "dry-run" | "execute" = "dry-run";
  let limit = Infinity;
  let batchSize = 50;
  let sourceType: "A" | "E" | null = null;
  for (let i = 2; i < argv.length; i += 1) {
    if (argv[i] === "--execute" || argv[i] === "execute") mode = "execute";
    else if (argv[i] === "--dry-run" || argv[i] === "dry-run") mode = "dry-run";
    else if (argv[i] === "--limit") { limit = Number(argv[++i]); }
    else if (argv[i] === "--batch-size") { batchSize = Number(argv[++i]); }
    else if (argv[i] === "--source-type") { const v = argv[++i]; sourceType = v === "A" || v === "E" ? v : null; }
  }
  if (!Number.isFinite(limit) || limit < 1) limit = Infinity;
  if (!Number.isInteger(batchSize) || batchSize < 1) batchSize = 50;
  return { mode, limit, batchSize, sourceType };
}

async function q<T = any>(sql: string, ...params: unknown[]): Promise<T[]> {
  return prisma.$queryRawUnsafe(sql, ...params) as Promise<T[]>;
}

interface Row { pid: number; source_type: string; external_code: string; has_user: boolean; user_email: string | null; contact_email: string | null; }

async function loadRows(): Promise<Row[]> {
  return q<Row>(`
    SELECT DISTINCT
      p.pid,
      p.source_type,
      p.external_code,
      (u.person_id IS NOT NULL) AS has_user,
      u.email AS user_email,
      (SELECT pc.email FROM person_contacts pc WHERE pc.person_id = p.pid AND pc.email IS NOT NULL ORDER BY pc.is_primary DESC, pc.created_at ASC LIMIT 1) AS contact_email
    FROM (
      SELECT s.person_id AS pid, s.source_type, s.external_code,
             c.mapped_affiliate_type
      FROM sie_associate_records s
      JOIN membership_categories c ON c.id = s.category_id
      WHERE s.provider='SIE' AND s.link_status='LINKED' AND c.mapped_affiliate_type IS NOT NULL
    ) p
    LEFT JOIN auth_users u ON u.person_id = p.pid AND u.deleted_at IS NULL
  `);
}

async function buildContexts(rows: Row[], sourceType: "A" | "E" | null) {
  const userEmailOwner = new Map<string, number>();
  const users = await q<{ person_id: number; e: string }>(`SELECT person_id, lower(email) AS e FROM auth_users WHERE email IS NOT NULL AND deleted_at IS NULL`);
  for (const u of users) if (!userEmailOwner.has(u.e)) userEmailOwner.set(u.e, u.person_id);

  const contactEmailFreq = new Map<string, number>();
  const contactEmailOwner = new Map<string, number>();
  const contacts = await q<{ person_id: number; e: string }>(`SELECT person_id, lower(email) AS e FROM person_contacts WHERE email IS NOT NULL`);
  for (const c of contacts) { if (!contactEmailOwner.has(c.e)) contactEmailOwner.set(c.e, c.person_id); contactEmailFreq.set(c.e, (contactEmailFreq.get(c.e) ?? 0) + 1); }

  const counts: Record<SieProvisioningClassification, number> = {
    ELIGIBLE: 0, EXCLUDED_HAS_USER: 0, EXCLUDED_NON_AE: 0, EXCLUDED_NO_EMAIL: 0, EXCLUDED_INVALID_EMAIL: 0, EXCLUDED_EMAIL_CONFLICT: 0, EXCLUDED_DUPLICATE_EMAIL: 0,
  };
  const candidates: SieProvisioningCandidate[] = [];

  for (const r of rows) {
    const isAE = r.source_type === "A" || r.source_type === "E";
    const email = normalizeProvisioningEmail(r.contact_email);
    const ownedByOther = email ? ((userEmailOwner.get(email) ?? contactEmailOwner.get(email)) ?? null) : null;
    const cls = classifyProvisioning({
      hasUser: r.has_user,
      isActiveOrStudent: isAE,
      email,
      emailOwnedByOtherAccount: ownedByOther !== null && ownedByOther !== undefined && ownedByOther !== r.pid,
      emailSharedAcrossPersons: email ? (contactEmailFreq.get(email) ?? 0) > 1 : false,
    });
    counts[cls] += 1;
    if (cls === "ELIGIBLE" && email && (sourceType === null || r.source_type === sourceType)) {
      candidates.push({
        personId: r.pid,
        email,
        roleSlug: r.source_type === "A" ? "ASOCIADO_ACTIVO" : "ASOCIADO_ESTUDIANTE",
        sourceType: r.source_type as "A" | "E",
        externalCode: r.external_code,
      });
    }
  }
  return { counts, candidates };
}

async function provisionCandidate(runId: string, candidate: SieProvisioningCandidate, roleId: number): Promise<{ status: "PROVISIONED"; userId: number } | { status: "SKIP"; reason: string }> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(hashtext($1))`, `sie-provision-user:${candidate.personId}`);
    const existing = await tx.$queryRawUnsafe<Array<{ id: number }>>(`SELECT id FROM auth_users WHERE person_id = $1 AND deleted_at IS NULL`, candidate.personId);
    if (existing.length > 0) return { status: "SKIP", reason: "USER_EXISTS" };
    const emailTaken = await tx.$queryRawUnsafe<Array<{ person_id: number }>>(`SELECT person_id FROM auth_users WHERE lower(email) = $1 AND deleted_at IS NULL LIMIT 1`, candidate.email);
    if (emailTaken.length > 0 && emailTaken[0].person_id !== candidate.personId) return { status: "SKIP", reason: "EMAIL_CONFLICT" };
    const res = await service.provisionUser(tx, candidate, roleId, runId);
    return { status: "PROVISIONED", userId: res.userId };
  });
}

async function main() {
  const { mode, limit, batchSize, sourceType } = parseArgs(process.argv);
  assertExecutionTarget(process.argv, mode);

  const rows = await loadRows();
  const { counts, candidates } = await buildContexts(rows, sourceType);

  const before = await q<{ n: number }>(`SELECT count(*)::int AS n FROM auth_users`);

  console.log(JSON.stringify({
    TOTAL_AE: rows.filter((r) => r.source_type === "A" || r.source_type === "E").length,
    NO_USER: counts.ELIGIBLE + counts.EXCLUDED_NO_EMAIL + counts.EXCLUDED_INVALID_EMAIL + counts.EXCLUDED_EMAIL_CONFLICT + counts.EXCLUDED_DUPLICATE_EMAIL,
    ELIGIBLE_RECONCILED: counts.ELIGIBLE,
    EXCLUDED_HAS_USER: counts.EXCLUDED_HAS_USER,
    EXCLUDED_NON_AE: counts.EXCLUDED_NON_AE,
    EXCLUDED_NO_EMAIL: counts.EXCLUDED_NO_EMAIL,
    EXCLUDED_INVALID_EMAIL: counts.EXCLUDED_INVALID_EMAIL,
    EXCLUDED_EMAIL_CONFLICT: counts.EXCLUDED_EMAIL_CONFLICT,
    EXCLUDED_DUPLICATE_EMAIL: counts.EXCLUDED_DUPLICATE_EMAIL,
    EXCLUDED_OTHER: counts.EXCLUDED_NON_AE + counts.EXCLUDED_INVALID_EMAIL,
    DRY_RUN_CANDIDATES: candidates.length,
    mode,
    batchSize,
  }, null, 2));

  if (mode === "dry-run") {
    console.log("DRY-RUN: sin escrituras. DRY_RUN_WRITES=0.");
    return;
  }

  // execute — requiere confirmación explícita de arg adicional
  if (process.argv.includes("--confirm") === false) {
    console.log("MODO EXECUTE requiere confirmación explícita: --execute --confirm");
    return;
  }

  const roles = await q<{ id: number; slug: string }>(`SELECT id, slug FROM auth_roles WHERE slug IN ('ASOCIADO_ACTIVO','ASOCIADO_ESTUDIANTE')`);
  const roleBySlug = new Map(roles.map((r) => [r.slug, r.id]));

  const runId = `sie-provision-${randomUUID()}`;
  const work = candidates.slice(0, limit);
  let provisioned = 0;
  const skipped: Record<string, number> = {};
  for (let i = 0; i < work.length; i += batchSize) {
    const batch = work.slice(i, i + batchSize);
    for (const c of batch) {
      const roleId = roleBySlug.get(c.roleSlug);
      if (roleId == null) { skipped["ROLE_MISSING"] = (skipped["ROLE_MISSING"] ?? 0) + 1; continue; }
      try {
        const r = await provisionCandidate(runId, c, roleId);
        if (r.status === "PROVISIONED") provisioned += 1;
        else skipped[r.reason] = (skipped[r.reason] ?? 0) + 1;
      } catch (e) {
        throw new Error(`ANOMALÍA candidato ${c.externalCode}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    const after = await q<{ n: number }>(`SELECT count(*)::int AS n FROM auth_users`);
    console.log(`LOTE acumulado: provisioned=${provisioned} auth_users=${after[0].n}`);
  }

  const after = await q<{ n: number }>(`SELECT count(*)::int AS n FROM auth_users`);
  console.log(JSON.stringify({ runId, provisioned, skipped, authUsersBefore: before[0].n, authUsersAfter: after[0].n }, null, 2));
}

main().catch((e) => { console.error("FATAL:", e instanceof Error ? e.message : String(e)); process.exit(1); }).finally(() => prisma.$disconnect());
