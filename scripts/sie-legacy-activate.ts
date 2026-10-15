import "dotenv/config";
import { execSync } from "child_process";
import { randomUUID } from "crypto";
import { PrismaClient } from "@prisma/client";
import { AssociatesApiClient } from "../modules/afiliaciones/associates-integration/Clients/AssociatesApiClient";
import { getAssociatesApiConfig } from "../modules/afiliaciones/associates-integration/Config/AssociatesApiConfig";
import {
  classifyLegacyCredential,
  SieLegacyCredentialConflictError,
  SieLegacyCredentialService,
  type SieLegacyCredentialClassification,
} from "../modules/afiliaciones/asociados/Services/SieLegacyCredentialService";

const prisma = new PrismaClient();
const service = new SieLegacyCredentialService();

const AWS_ACCOUNT = "564914947461";
const AWS_REGION = "us-east-2";
const PAGE_SIZE = 500;

/**
 * Guarda de ejecución para la ACTIVACIÓN de cuentas históricas.
 * LOCAL exige localhost. PROD/QA exigen --environment explícito + --execute + --confirm
 * y verifica identidad AWS (cuenta/región). Nunca se activa sin estos tres.
 */
function assertExecutionTarget(argv: string[], mode: string): void {
  const envIdx = argv.indexOf("--environment");
  const environment = envIdx !== -1 ? argv[envIdx + 1] : "local";

  if (environment === "prod" || environment === "qa") {
    if (mode !== "execute") throw new Error(`${environment.toUpperCase()} requiere --execute explícito.`);
    if (!argv.includes("--confirm")) throw new Error(`${environment.toUpperCase()} requiere --confirm explícito.`);
    // Neutraliza credenciales ambientales (p. ej. AWS_* en .env cargado por
    // dotenv) para que la verificación use SIEMPRE el perfil sara-aws-cli.
    const env = { ...process.env };
    delete env.AWS_ACCESS_KEY_ID;
    delete env.AWS_SECRET_ACCESS_KEY;
    delete env.AWS_SESSION_TOKEN;
    env.AWS_PROFILE = "sara-aws-cli";
    env.AWS_DEFAULT_REGION = AWS_REGION;
    const account = execSync("aws sts get-caller-identity --query Account --output text", { encoding: "utf8", env }).trim();
    if (account !== AWS_ACCOUNT) throw new Error(`REFUSE_WRONG_AWS_ACCOUNT: ${account}. Se espera ${AWS_ACCOUNT}.`);
    return;
  }

  const url = process.env.DATABASE_URL ?? "";
  let hostname = "";
  try { hostname = new URL(url).hostname; } catch { throw new Error("DATABASE_URL inválida."); }
  const local = ["localhost", "127.0.0.1", "::1"].includes(hostname.toLowerCase());
  if (!local) throw new Error(`REFUSE_NON_LOCAL_TARGET: host ${hostname}. Para PROD usa --environment prod --execute --confirm.`);
}

function parseArgs(argv: string[]): { mode: "dry-run" | "execute"; limit: number; batchSize: number } {
  let mode: "dry-run" | "execute" = "dry-run";
  let limit = Infinity;
  let batchSize = 50;
  for (let i = 2; i < argv.length; i += 1) {
    if (argv[i] === "--execute" || argv[i] === "execute") mode = "execute";
    else if (argv[i] === "--dry-run" || argv[i] === "dry-run") mode = "dry-run";
    else if (argv[i] === "--limit") { limit = Number(argv[++i]); }
    else if (argv[i] === "--batch-size") { batchSize = Number(argv[++i]); }
  }
  if (!Number.isFinite(limit) || limit < 1) limit = Infinity;
  if (!Number.isInteger(batchSize) || batchSize < 1) batchSize = 50;
  return { mode, limit, batchSize };
}

async function q<T = any>(sql: string, ...params: unknown[]): Promise<T[]> {
  return prisma.$queryRawUnsafe(sql, ...params) as Promise<T[]>;
}

interface CandidateRow {
  user_id: number;
  user_email: string | null;
  contact_email: string | null;
  external_code: string;
  credential_count: number;
}

async function loadCandidateRows(): Promise<CandidateRow[]> {
  return q<CandidateRow>(`
    SELECT DISTINCT ON (u.id)
      u.id AS user_id,
      u.email AS user_email,
      s.external_code,
      (SELECT pc.email FROM person_contacts pc WHERE pc.person_id = u.person_id AND pc.email IS NOT NULL ORDER BY pc.is_primary DESC, pc.created_at ASC LIMIT 1) AS contact_email,
      (SELECT count(*)::int FROM auth_credentials c WHERE c.user_id = u.id) AS credential_count
    FROM auth_users u
    JOIN persons p ON p.id = u.person_id AND p.deleted_at IS NULL
    JOIN sie_associate_records s ON s.person_id = p.id AND s.provider='SIE' AND s.link_status='LINKED'
    WHERE u.deleted_at IS NULL AND u.type='AFFILIATE' AND u.status='PENDING'
    ORDER BY u.id, s.external_code
  `);
}

async function loadEmailOwners(): Promise<Map<string, number>> {
  const rows = await q<{ user_id: number; e: string }>(`SELECT id AS user_id, lower(email) AS e FROM auth_users WHERE email IS NOT NULL AND deleted_at IS NULL`);
  const owners = new Map<string, number>();
  for (const row of rows) if (!owners.has(row.e)) owners.set(row.e, row.user_id);
  return owners;
}

async function fetchSieClaveMap(): Promise<Map<string, string | null>> {
  const client = new AssociatesApiClient(getAssociatesApiConfig());
  const first = await client.listAssociatesWithClave({ pagina: 1, tamanioPagina: PAGE_SIZE });
  const pages = [first];
  for (let page = 2; page <= (first.totalPaginas || 1); page += 1) {
    pages.push(await client.listAssociatesWithClave({ pagina: page, tamanioPagina: PAGE_SIZE }));
  }
  const map = new Map<string, string | null>();
  for (const page of pages) {
    for (const item of page.associates) {
      if (item.record.externalCode) map.set(item.record.externalCode, item.clave);
    }
  }
  return map;
}

async function activateCandidate(runId: string, userId: number, email: string, clave: string, externalCode: string): Promise<{ status: "ACTIVATED" } | { status: "SKIP"; reason: string }> {
  return prisma.$transaction(async (tx) => {
    try {
      await service.activateLegacyAccount(tx, { userId, email, clave, externalCode }, runId);
      return { status: "ACTIVATED" };
    } catch (error) {
      if (error instanceof SieLegacyCredentialConflictError) return { status: "SKIP", reason: "CREDENTIAL_EXISTS" };
      throw error;
    }
  }, { maxWait: 60000, timeout: 60000 });
}

async function activateWithRetry(runId: string, c: { userId: number; email: string; clave: string; externalCode: string }): Promise<{ status: "ACTIVATED" } | { status: "SKIP"; reason: string }> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await activateCandidate(runId, c.userId, c.email, c.clave, c.externalCode);
    } catch (error) {
      lastError = error;
      await new Promise((r) => setTimeout(r, 1500 * attempt));
    }
  }
  throw new Error(`ANOMALÍA candidato ${c.externalCode}: ${lastError instanceof Error ? lastError.message : String(lastError)}`);
}

async function main() {
  const { mode, limit, batchSize } = parseArgs(process.argv);
  assertExecutionTarget(process.argv, mode);

  const [rows, emailOwners, sieClaveMap] = await Promise.all([loadCandidateRows(), loadEmailOwners(), fetchSieClaveMap()]);

  const counts: Record<SieLegacyCredentialClassification, number> = {
    ELIGIBLE: 0,
    EXCLUDED_IDENTITY_CONFLICT: 0,
    EXCLUDED_NO_USER: 0,
    EXCLUDED_NOT_PENDING: 0,
    EXCLUDED_HAS_CREDENTIAL: 0,
    EXCLUDED_EMPTY_CLAVE: 0,
    EXCLUDED_WEAK_PASSWORD: 0,
    EXCLUDED_INVALID_EMAIL: 0,
  };

  interface Candidate { userId: number; email: string; clave: string; externalCode: string; }
  const candidates: Candidate[] = [];

  for (const row of rows) {
    const email = (row.user_email ?? row.contact_email ?? "").trim().toLowerCase();
    const emailOwner = email ? (emailOwners.get(email) ?? row.user_id) : row.user_id;
    const identityConflict = emailOwner !== row.user_id;
    const clave = sieClaveMap.get(row.external_code) ?? null;

    const classification = classifyLegacyCredential(clave, {
      hasUser: true,
      userStatus: "PENDING",
      hasAnyCredential: row.credential_count > 0,
      email: email || null,
      identityConflict,
    });
    counts[classification] += 1;
    if (classification === "ELIGIBLE" && clave) {
      candidates.push({ userId: row.user_id, email, clave, externalCode: row.external_code });
    }
  }

  console.log(JSON.stringify({
    PENDING_AFFILIATE_ROWS: rows.length,
    SIE_CLAVE_MAP_SIZE: sieClaveMap.size,
    ...counts,
    DRY_RUN_CANDIDATES: candidates.length,
    mode,
    limit: Number.isFinite(limit) ? limit : null,
    batchSize,
  }, null, 2));

  if (mode === "dry-run") {
    console.log("DRY-RUN: sin escrituras.");
    return;
  }

  if (!process.argv.includes("--confirm")) {
    console.log("MODO EXECUTE requiere confirmación explícita: --execute --confirm");
    return;
  }

  const runId = `sie-legacy-activate-${randomUUID()}`;
  const work = candidates.slice(0, limit);
  let activated = 0;
  const skipped: Record<string, number> = {};

  for (let i = 0; i < work.length; i += batchSize) {
    const batch = work.slice(i, i + batchSize);
    for (const c of batch) {
      const r = await activateWithRetry(runId, c);
      if (r.status === "ACTIVATED") activated += 1;
      else skipped[r.reason] = (skipped[r.reason] ?? 0) + 1;
    }
    const active = await q<{ n: number }>(`SELECT count(*)::int AS n FROM auth_users WHERE status='ACTIVE' AND deleted_at IS NULL`);
    console.log(`LOTE acumulado: activated=${activated} active_users=${active[0].n}`);
  }

  const active = await q<{ n: number }>(`SELECT count(*)::int AS n FROM auth_users WHERE status='ACTIVE' AND deleted_at IS NULL`);
  console.log(JSON.stringify({ runId, activated, skipped, activeUsers: active[0].n }, null, 2));
}

main().catch((e) => { console.error("FATAL:", e instanceof Error ? e.message : String(e)); process.exit(1); }).finally(() => prisma.$disconnect());
