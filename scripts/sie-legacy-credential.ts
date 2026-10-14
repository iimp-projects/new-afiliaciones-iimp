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
import {
  parsePilotSelectionArgs,
  requireExplicitSelectionForExecute,
  resolveSelection,
} from "../modules/afiliaciones/asociados/Services/SiePilotSelection";

const prisma = new PrismaClient();
const service = new SieLegacyCredentialService();

const QA_AWS_ACCOUNT = "564914947461";
const QA_AWS_REGION = "us-east-2";
const PAGE_SIZE = 500;

/**
 * Guarda de ejecución compartida con el resto de scripts SIE.
 * LOCAL exige localhost. QA exige `--environment qa` + `--execute` + `--confirm`
 * y verifica identidad AWS (cuenta/región). PROD queda rechazado.
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

async function resolveUserIdById(userId: number): Promise<number[]> {
  const rows = await q<{ id: number }>(`SELECT id FROM auth_users WHERE id = $1 AND deleted_at IS NULL`, userId);
  return rows.map((r) => r.id);
}

async function resolveUserIdsByExternalCode(externalCode: string): Promise<number[]> {
  const rows = await q<{ id: number }>(`
    SELECT DISTINCT u.id
    FROM sie_associate_records s
    JOIN persons p ON p.id = s.person_id AND p.deleted_at IS NULL
    JOIN auth_users u ON u.person_id = p.id AND u.deleted_at IS NULL
    WHERE s.provider = 'SIE' AND s.external_code = $1
  `, externalCode);
  return rows.map((r) => r.id);
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

async function importCandidate(runId: string, userId: number, email: string, clave: string, externalCode: string): Promise<{ status: "IMPORTED" } | { status: "SKIP"; reason: string }> {
  return prisma.$transaction(async (tx) => {
    try {
      await service.importCredential(tx, { userId, email, clave, externalCode }, runId);
      return { status: "IMPORTED" };
    } catch (error) {
      if (error instanceof SieLegacyCredentialConflictError) return { status: "SKIP", reason: "CREDENTIAL_EXISTS" };
      throw error;
    }
  });
}

async function main() {
  const { mode, limit, batchSize } = parseArgs(process.argv);
  const selection = parsePilotSelectionArgs(process.argv);
  assertExecutionTarget(process.argv, mode);

  // Guarda: cualquier ejecución real exige selección explícita de UNA cuenta.
  if (mode === "execute") {
    const guardError = requireExplicitSelectionForExecute(mode, selection);
    if (guardError) {
      console.log(guardError);
      return;
    }
  }

  // Resolución de la selección explícita (si existe).
  let targetUserId: number | null = null;
  if (selection.userId !== null || selection.externalCode !== null) {
    const [byId, byCode] = await Promise.all([
      selection.userId !== null ? resolveUserIdById(selection.userId) : Promise.resolve([] as number[]),
      selection.externalCode !== null ? resolveUserIdsByExternalCode(selection.externalCode) : Promise.resolve([] as number[]),
    ]);
    const resolution = resolveSelection(selection, byId, byCode);
    if (!resolution.ok) {
      console.log(`SELECCIÓN RECHAZADA: ${resolution.reason}`);
      return;
    }
    targetUserId = resolution.userId;
  }

  const [rows, emailOwners, sieClaveMap] = await Promise.all([loadCandidateRows(), loadEmailOwners(), fetchSieClaveMap()]);

  const scopedRows = targetUserId !== null ? rows.filter((r) => r.user_id === targetUserId) : rows;
  if (targetUserId !== null && scopedRows.length === 0) {
    console.log(`SELECCIÓN RECHAZADA: el usuario ${targetUserId} no es candidato PENDING AFFILIATE vinculado a SIE.`);
    return;
  }

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

  for (const row of scopedRows) {
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

  const before = await q<{ n: number }>(`SELECT count(*)::int AS n FROM auth_credentials WHERE type='PASSWORD' AND is_active`);

  console.log(JSON.stringify({
    SELECTION: targetUserId !== null ? { userId: targetUserId } : null,
    PENDING_AFFILIATE_ROWS: scopedRows.length,
    SIE_CLAVE_MAP_SIZE: sieClaveMap.size,
    ...counts,
    DRY_RUN_CANDIDATES: candidates.length,
    mode,
    batchSize,
  }, null, 2));

  if (mode === "dry-run") {
    console.log("DRY-RUN: sin escrituras. DRY_RUN_WRITES=0. (no se importa ninguna Clave)");
    return;
  }

  if (!process.argv.includes("--confirm")) {
    console.log("MODO EXECUTE requiere confirmación explícita: --execute --confirm");
    return;
  }

  const runId = `sie-legacy-credential-${randomUUID()}`;
  const work = candidates.slice(0, limit);
  let imported = 0;
  const skipped: Record<string, number> = {};

  for (let i = 0; i < work.length; i += batchSize) {
    const batch = work.slice(i, i + batchSize);
    for (const c of batch) {
      try {
        const r = await importCandidate(runId, c.userId, c.email, c.clave, c.externalCode);
        if (r.status === "IMPORTED") imported += 1;
        else skipped[r.reason] = (skipped[r.reason] ?? 0) + 1;
      } catch (error) {
        throw new Error(`ANOMALÍA candidato ${c.externalCode}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    const after = await q<{ n: number }>(`SELECT count(*)::int AS n FROM auth_credentials WHERE type='PASSWORD' AND is_active`);
    console.log(`LOTE acumulado: imported=${imported} active_credentials=${after[0].n}`);
  }

  const after = await q<{ n: number }>(`SELECT count(*)::int AS n FROM auth_credentials WHERE type='PASSWORD' AND is_active`);
  console.log(JSON.stringify({ runId, imported, skipped, credentialsBefore: before[0].n, credentialsAfter: after[0].n }, null, 2));
}

main().catch((e) => { console.error("FATAL:", e instanceof Error ? e.message : String(e)); process.exit(1); }).finally(() => prisma.$disconnect());
