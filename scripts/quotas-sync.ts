import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { AssociatesApiClient } from "../modules/afiliaciones/associates-integration/Clients/AssociatesApiClient";
import { getAssociatesApiConfig } from "../modules/afiliaciones/associates-integration/Config/AssociatesApiConfig";
import { PrismaQuotaRepository } from "../modules/afiliaciones/quotas/Repositories/PrismaQuotaRepository";
import { PrismaQuotaSyncItemRepository } from "../modules/afiliaciones/quotas/Repositories/PrismaQuotaSyncItemRepository";
import { PrismaQuotaSyncRepository } from "../modules/afiliaciones/quotas/Repositories/PrismaQuotaSyncRepository";
import { PrismaQuotaUniverseRepository } from "../modules/afiliaciones/quotas/Repositories/PrismaQuotaUniverseRepository";
import { QuotaIngestionService } from "../modules/afiliaciones/quotas/Services/QuotaIngestionService";
import { QuotaSieClient } from "../modules/afiliaciones/quotas/Services/QuotaSieClient";
import { QuotaSyncLockedError } from "../modules/afiliaciones/quotas/Services/QuotaSyncLock";
import { PostgresQuotaSyncLock } from "../modules/afiliaciones/quotas/Services/PostgresQuotaSyncLock";
import { QuotaSyncService } from "../modules/afiliaciones/quotas/Services/QuotaSyncService";
import { QuotaUniverseService } from "../modules/afiliaciones/quotas/Services/QuotaUniverseService";
import { assertExecutionTarget } from "./sie-execution-guard";

type Args = {
  execute: boolean;
  full: boolean;
  confirmFull: boolean;
  help: boolean;
  personId?: number;
  limit?: number;
  offset?: number;
  resume?: number;
  retryFailed?: number;
  errorCodes?: string[];
  concurrency: number;
  actorUserId: number | null;
  maxAttempts: number;
};

const MAX_EXECUTE_LIMIT = 500;

function parseArgs(argv: string[]): Args {
  const args: Args = { execute: false, full: false, confirmFull: false, help: false, concurrency: 2, actorUserId: null, maxAttempts: 3 };
  for (const raw of argv) {
    if (raw === "--execute") args.execute = true;
    else if (raw === "--full") args.full = true;
    else if (raw === "--confirm-full") args.confirmFull = true;
    else if (raw === "--help" || raw === "-h") args.help = true;
    else if (raw.startsWith("--person-id=")) args.personId = positiveInt(raw, "--person-id");
    else if (raw.startsWith("--limit=")) args.limit = positiveInt(raw, "--limit");
    else if (raw.startsWith("--offset=")) { const value = Number(raw.slice("--offset=".length)); if (!Number.isSafeInteger(value) || value < 0) throw new Error("--offset requiere un entero no negativo."); args.offset = value; }
    else if (raw.startsWith("--resume=")) args.resume = positiveInt(raw, "--resume");
    else if (raw.startsWith("--retry-failed=")) args.retryFailed = positiveInt(raw, "--retry-failed");
    else if (raw.startsWith("--error-code=")) args.errorCodes = raw.slice("--error-code=".length).split(",").map((code) => code.trim()).filter(Boolean);
    else if (raw.startsWith("--concurrency=")) args.concurrency = positiveInt(raw, "--concurrency");
    else if (raw.startsWith("--actor-user-id=")) args.actorUserId = positiveInt(raw, "--actor-user-id");
    else if (raw.startsWith("--max-attempts=")) args.maxAttempts = positiveInt(raw, "--max-attempts");
    else if (raw === "--dry-run") continue;
    else throw new Error(`Argumento no reconocido: ${raw.split("=")[0]}`);
  }
  if (args.resume && args.retryFailed) throw new Error("Usa --resume o --retry-failed, no ambos.");
  if (args.full && args.personId) throw new Error("--full no acepta --person-id.");
  if (args.limit != null && args.limit > MAX_EXECUTE_LIMIT) throw new Error(`--limit máximo permitido: ${MAX_EXECUTE_LIMIT}.`);
  if (args.execute && !args.personId && !args.limit && !args.full && !args.resume && !args.retryFailed) {
    throw new Error("Una ejecución real requiere --person-id, --limit, --resume, --retry-failed o --full --confirm-full.");
  }
  return args;
}

function positiveInt(raw: string, flag: string): number {
  const value = Number(raw.slice(flag.length + 1));
  if (!Number.isSafeInteger(value) || value < 1) throw new Error(`${flag} requiere un entero positivo.`);
  return value;
}

function usage(): string {
  return [
    "Uso: npm run quotas:sync -- [opciones]",
    "  --person-id=ID      Sincroniza un asociado local.",
    "  --limit=N           Limita el lote (máximo 500).",
    "  --offset=N          Desplaza el universo para segmentar (0-based).",
    "  --full              Selecciona todo el universo (requiere --confirm-full para ejecutar).",
    "  --execute           Persiste cuotas. Sin este flag es dry-run.",
    "  --resume=RUN_ID     Reanuda items PENDING/RUNNING de una ejecución.",
    "  --retry-failed=RUN_ID  Reintenta items FAILED de una ejecución.",
    "  --error-code=CODE[,CODE]  Filtra el retry por código de error (solo recuperables).",
    "  --concurrency=N     Concurrencia (1-10, default 2).",
    "  --actor-user-id=ID  Usuario responsable (auditoría).",
    "  --max-attempts=N    Intentos por consulta SIE (default 3).",
  ].join("\n");
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(usage());
    return;
  }
  assertExecutionTarget(process.argv);

  if (args.full && args.execute && !args.confirmFull) {
    console.log(JSON.stringify({ status: "BLOCKED", reason: "FULL_EXECUTE_REQUIRES_CONFIRM_FULL" }, null, 2));
    process.exitCode = 2;
    return;
  }

  const prisma = new PrismaClient();
  try {
    const api = new AssociatesApiClient(getAssociatesApiConfig());
    const quotaRepository = new PrismaQuotaRepository(prisma);
    const runRepository = new PrismaQuotaSyncRepository(prisma);
    const itemRepository = new PrismaQuotaSyncItemRepository(prisma);
    const universe = new QuotaUniverseService(new PrismaQuotaUniverseRepository(prisma));
    const sie = new QuotaSieClient(api, { maxAttempts: args.maxAttempts });
    const ingestion = new QuotaIngestionService(quotaRepository, itemRepository);
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) throw new Error("DATABASE_URL no configurada.");
    const lock = new PostgresQuotaSyncLock(databaseUrl);
    const service = new QuotaSyncService(universe, sie, ingestion, quotaRepository, runRepository, itemRepository, lock);

    const mode = args.full ? "FULL" : args.personId ? "PERSON" : "BATCH";
    const result = await service.run({
      mode,
      personIds: args.personId ? [args.personId] : undefined,
      limit: args.limit,
      offset: args.offset,
      full: args.full,
      dryRun: !args.execute && !args.resume && !args.retryFailed,
      resumeRunId: args.resume,
      retryFailedRunId: args.retryFailed,
      errorCodes: args.errorCodes,
      concurrency: args.concurrency,
      actorUserId: args.actorUserId,
    });

    console.log(JSON.stringify({
      target: { environment: "local", database: databaseLabel(process.env.DATABASE_URL) },
      command: { mode, dryRun: result.report.dryRun, resume: args.resume ?? null, retryFailed: args.retryFailed ?? null },
      report: result.report,
      universe: result.universe,
    }, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

function databaseLabel(url: string | undefined): string {
  if (!url) return "unknown";
  try {
    const parsed = new URL(url);
    return `${parsed.hostname}:${parsed.port || "5432"}${parsed.pathname}`;
  } catch {
    return "unknown";
  }
}

main().catch((error) => {
  const code = error instanceof QuotaSyncLockedError ? error.code : "QUOTA_SYNC_COMMAND_FAILED";
  console.log(JSON.stringify({ status: "FAILED", code, message: error instanceof Error ? error.message : "Error desconocido" }, null, 2));
  process.exitCode = 1;
});
