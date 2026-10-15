import "dotenv/config";
import { execSync } from "child_process";
import { randomUUID } from "crypto";
import * as ExcelJS from "exceljs";
import { PrismaClient } from "@prisma/client";
import { AssociatesApiClient } from "../modules/afiliaciones/associates-integration/Clients/AssociatesApiClient";
import { getAssociatesApiConfig } from "../modules/afiliaciones/associates-integration/Config/AssociatesApiConfig";
import {
  isWeakSiePassword,
  isValidLegacyCredentialEmail,
  SieLegacyCredentialConflictError,
  SieLegacyCredentialService,
  type SieLegacyProvisionCandidate,
} from "../modules/afiliaciones/asociados/Services/SieLegacyCredentialService";

const prisma = new PrismaClient();
const service = new SieLegacyCredentialService();

const AWS_ACCOUNT = "564914947461";
const AWS_REGION = "us-east-2";
const PAGE_SIZE = 500;
const EXCEL_PATH = process.env.SIE_EXCEL_PATH ?? "C:/Users/maxic/Downloads/ASOCIADOS.xlsx";

function assertExecutionTarget(argv: string[], mode: string): void {
  const envIdx = argv.indexOf("--environment");
  const environment = envIdx !== -1 ? argv[envIdx + 1] : "local";
  if (environment === "prod" || environment === "qa") {
    if (mode !== "execute") throw new Error(`${environment.toUpperCase()} requiere --execute explícito.`);
    if (!argv.includes("--confirm")) throw new Error(`${environment.toUpperCase()} requiere --confirm explícito.`);
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

function parseArgs(argv: string[]): { mode: "dry-run" | "execute"; limit: number; batchSize: number; codes: Set<string> | null } {
  let mode: "dry-run" | "execute" = "dry-run";
  let limit = Infinity;
  let batchSize = 50;
  let codes: Set<string> | null = null;
  for (let i = 2; i < argv.length; i += 1) {
    if (argv[i] === "--execute" || argv[i] === "execute") mode = "execute";
    else if (argv[i] === "--dry-run" || argv[i] === "dry-run") mode = "dry-run";
    else if (argv[i] === "--limit") { limit = Number(argv[++i]); }
    else if (argv[i] === "--batch-size") { batchSize = Number(argv[++i]); }
    else if (argv[i] === "--codes") { codes = new Set((argv[++i] ?? "").split(",").map((s) => s.trim()).filter(Boolean)); }
  }
  if (!Number.isFinite(limit) || limit < 1) limit = Infinity;
  if (!Number.isInteger(batchSize) || batchSize < 1) batchSize = 50;
  return { mode, limit, batchSize, codes };
}

async function q<T = any>(sql: string, ...params: unknown[]): Promise<T[]> {
  return prisma.$queryRawUnsafe(sql, ...params) as Promise<T[]>;
}

interface ExcelRow { correo: string; clave: string; numDoc: string; }
async function loadExcelMap(): Promise<Map<string, ExcelRow>> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(EXCEL_PATH);
  const ws = wb.worksheets[0];
  const map = new Map<string, ExcelRow>();
  ws.eachRow((row, n) => {
    if (n === 1) return;
    const codigo = (row.getCell(3).text ?? "").trim();
    if (!codigo) return;
    map.set(codigo, {
      correo: (row.getCell(12).text ?? "").trim(),
      clave: (row.getCell(4).text ?? "").trim(),
      numDoc: (row.getCell(2).text ?? "").trim(),
    });
  });
  return map;
}

interface SieMapEntry { correo: string | null; clave: string | null; numDoc: string; sourceType: string; }
async function loadSieMap(): Promise<Map<string, SieMapEntry>> {
  const client = new AssociatesApiClient(getAssociatesApiConfig());
  const first = await client.listAssociatesWithClave({ pagina: 1, tamanioPagina: PAGE_SIZE });
  const pages = [first];
  for (let page = 2; page <= (first.totalPaginas || 1); page += 1) {
    pages.push(await client.listAssociatesWithClave({ pagina: page, tamanioPagina: PAGE_SIZE }));
  }
  const map = new Map<string, SieMapEntry>();
  for (const page of pages) {
    for (const item of page.associates) {
      const r = item.record;
      if (r.externalCode) map.set(r.externalCode, { correo: r.correo ?? null, clave: item.clave, numDoc: r.documentNumber, sourceType: r.sourceType });
    }
  }
  return map;
}

interface Row { person_id: number; external_code: string; source_type: string; document_number: string | null; }

async function loadRows(): Promise<Row[]> {
  return q<Row>(`
    SELECT DISTINCT ON (s.person_id)
      s.person_id,
      s.external_code,
      s.source_type,
      pe.document_number
    FROM sie_associate_records s
    JOIN persons pe ON pe.id = s.person_id AND pe.deleted_at IS NULL
    WHERE s.provider='SIE' AND s.link_status='LINKED' AND s.person_id IS NOT NULL
      AND s.source_type IN ('A','E')
      AND NOT EXISTS (SELECT 1 FROM auth_users u WHERE u.person_id = pe.id AND u.deleted_at IS NULL)
    ORDER BY s.person_id, s.external_code
  `);
}

async function loadEmailOwners(): Promise<Map<string, number>> {
  const rows = await q<{ user_id: number; e: string }>(`SELECT id AS user_id, lower(email) AS e FROM auth_users WHERE email IS NOT NULL AND deleted_at IS NULL`);
  const owners = new Map<string, number>();
  for (const row of rows) if (!owners.has(row.e)) owners.set(row.e, row.user_id);
  return owners;
}

async function provisionCandidate(runId: string, c: SieLegacyProvisionCandidate): Promise<{ status: "PROVISIONED"; userId: number } | { status: "SKIP"; reason: string }> {
  return prisma.$transaction(async (tx) => {
    try {
      const { userId } = await service.provisionLegacyAccount(tx, c, runId);
      return { status: "PROVISIONED", userId };
    } catch (error) {
      if (error instanceof SieLegacyCredentialConflictError) return { status: "SKIP", reason: "CONFLICT" };
      throw error;
    }
  }, { maxWait: 60000, timeout: 60000 });
}

async function provisionWithRetry(runId: string, c: SieLegacyProvisionCandidate): Promise<{ status: "PROVISIONED"; userId: number } | { status: "SKIP"; reason: string }> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await provisionCandidate(runId, c);
    } catch (error) {
      lastError = error;
      await new Promise((r) => setTimeout(r, 1500 * attempt));
    }
  }
  throw new Error(`ANOMALÍA persona ${c.personId}: ${lastError instanceof Error ? lastError.message : String(lastError)}`);
}

async function main() {
  const { mode, limit, batchSize, codes } = parseArgs(process.argv);
  assertExecutionTarget(process.argv, mode);

  const [rows, excelMap, sieMap, emailOwners] = await Promise.all([loadRows(), loadExcelMap(), loadSieMap(), loadEmailOwners()]);
  const roleActive = await prisma.role.findUnique({ where: { slug: "ASOCIADO_ACTIVO" }, select: { id: true } });
  const roleStudent = await prisma.role.findUnique({ where: { slug: "ASOCIADO_ESTUDIANTE" }, select: { id: true } });
  if (!roleActive || !roleStudent) throw new Error("Roles ASOCIADO_ACTIVO/ASOCIADO_ESTUDIANTE no existen.");

  const counts = {
    ROWS_WITHOUT_ACCOUNT: rows.length,
    ELIGIBLE: 0,
    EXCLUDED_INVALID_EMAIL: 0,
    EXCLUDED_EMPTY_CLAVE: 0,
    EXCLUDED_WEAK_PASSWORD: 0,
    EXCLUDED_EMAIL_CONFLICT: 0,
    EXCLUDED_DUPLICATE_EMAIL: 0,
    EXCLUDED_IDENTITY_MISMATCH: 0,
    EXCEL_API_DISCREPANCY: 0,
    FILTER_CODES: 0,
    PRIORITY_07761343: "NOT_FOUND",
    PRIORITY_08200623: "NOT_FOUND",
  };

  interface Candidate extends SieLegacyProvisionCandidate { documentNumber: string | null; }
  const candidates: Candidate[] = [];
  const seenEmails = new Set<string>();

  for (const row of rows) {
    const sie = sieMap.get(row.external_code);
    const excel = excelMap.get(row.external_code);
    const email = (sie?.correo ?? "").trim().toLowerCase();
    const clave = sie?.clave ?? null;
    const numDoc = sie?.numDoc ?? "";

    if (row.document_number && numDoc && row.document_number !== numDoc) {
      counts.EXCLUDED_IDENTITY_MISMATCH += 1;
      continue;
    }
    const excelEmail = (excel?.correo ?? "").trim().toLowerCase();
    const excelClave = excel?.clave ?? null;
    if (excel && (excelEmail !== email || excelClave !== clave)) {
      counts.EXCEL_API_DISCREPANCY += 1;
    }

    if (!isValidLegacyCredentialEmail(email)) { counts.EXCLUDED_INVALID_EMAIL += 1; continue; }
    if (!clave || clave.trim().length === 0) { counts.EXCLUDED_EMPTY_CLAVE += 1; continue; }
    if (isWeakSiePassword(clave)) { counts.EXCLUDED_WEAK_PASSWORD += 1; continue; }
    if (emailOwners.has(email)) { counts.EXCLUDED_EMAIL_CONFLICT += 1; continue; }
    if (seenEmails.has(email)) { counts.EXCLUDED_DUPLICATE_EMAIL += 1; continue; }
    seenEmails.add(email);

    const roleId = row.source_type === "A" ? roleActive.id : roleStudent.id;
    candidates.push({ personId: row.person_id, email, clave, externalCode: row.external_code, roleId, documentNumber: row.document_number });

    if (numDoc === "07761343") counts.PRIORITY_07761343 = "ELIGIBLE";
    if (numDoc === "08200623") counts.PRIORITY_08200623 = "ELIGIBLE";
  }

  if (codes && codes.size > 0) {
    const before = candidates.length;
    for (let i = candidates.length - 1; i >= 0; i -= 1) {
      if (!codes.has(candidates[i].externalCode)) candidates.splice(i, 1);
    }
    counts.FILTER_CODES = before - candidates.length;
  }

  counts.ELIGIBLE = candidates.length;
  console.log(JSON.stringify({ ...counts, DRY_RUN_CANDIDATES: candidates.length, mode, limit: Number.isFinite(limit) ? limit : null, batchSize }, null, 2));

  if (mode === "dry-run") {
    console.log("DRY-RUN: sin escrituras.");
    return;
  }
  if (!process.argv.includes("--confirm")) {
    console.log("MODO EXECUTE requiere confirmación explícita: --execute --confirm");
    return;
  }

  const runId = `sie-legacy-provision-${randomUUID()}`;
  const work = candidates.slice(0, limit);
  let provisioned = 0;
  const skipped: Record<string, number> = {};

  for (let i = 0; i < work.length; i += batchSize) {
    const batch = work.slice(i, i + batchSize);
    for (const c of batch) {
      const r = await provisionWithRetry(runId, c);
      if (r.status === "PROVISIONED") provisioned += 1;
      else skipped[r.reason] = (skipped[r.reason] ?? 0) + 1;
    }
    const active = await q<{ n: number }>(`SELECT count(*)::int AS n FROM auth_users WHERE status='ACTIVE' AND deleted_at IS NULL`);
    console.log(`LOTE acumulado: provisioned=${provisioned} active_users=${active[0].n}`);
  }

  const active = await q<{ n: number }>(`SELECT count(*)::int AS n FROM auth_users WHERE status='ACTIVE' AND deleted_at IS NULL`);
  console.log(JSON.stringify({ runId, provisioned, skipped, activeUsers: active[0].n }, null, 2));
}

main().catch((e) => { console.error("FATAL:", e instanceof Error ? e.message : String(e)); process.exit(1); }).finally(() => prisma.$disconnect());
