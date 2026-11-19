import "dotenv/config";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { PrismaClient, SieLinkStatus } from "@prisma/client";
import { AssociatesApiClient } from "../modules/afiliaciones/associates-integration/Clients/AssociatesApiClient";
import { getAssociatesApiConfig } from "../modules/afiliaciones/associates-integration/Config/AssociatesApiConfig";
import { mapSieDocumentType } from "../modules/afiliaciones/associates-integration/Mappers/SieAssociateListMapper";
import type { QuotaPadronCheckpoint } from "../modules/afiliaciones/quotas/Models/QuotaPadron";
import { PrismaQuotaPadronRepository } from "../modules/afiliaciones/quotas/Repositories/PrismaQuotaPadronRepository";
import { QuotaPadronService } from "../modules/afiliaciones/quotas/Services/QuotaPadronService";
import { assertExecutionTarget } from "./sie-execution-guard";

type Args = {
  execute: boolean;
  confirm: boolean;
  help: boolean;
  resume: boolean;
  pageSize: number;
  maxPages?: number;
  startPage: number;
};

const CHECKPOINT_PATH = resolve(process.cwd(), ".tmp/quota-padron-checkpoint.json");

function parseArgs(argv: string[]): Args {
  const args: Args = { execute: false, confirm: false, help: false, resume: false, pageSize: 500, startPage: 1 };
  for (const raw of argv) {
    if (raw === "--execute") args.execute = true;
    else if (raw === "--confirm") args.confirm = true;
    else if (raw === "--resume") args.resume = true;
    else if (raw === "--help" || raw === "-h") args.help = true;
    else if (raw === "--dry-run") continue;
    else if (raw.startsWith("--page-size=")) args.pageSize = positiveInt(raw, "--page-size");
    else if (raw.startsWith("--max-pages=")) args.maxPages = positiveInt(raw, "--max-pages");
    else if (raw.startsWith("--start-page=")) args.startPage = positiveInt(raw, "--start-page");
    else throw new Error(`Argumento no reconocido: ${raw.split("=")[0]}`);
  }
  if (args.pageSize > 500) throw new Error("--page-size máximo permitido: 500.");
  return args;
}

function positiveInt(raw: string, flag: string): number {
  const value = Number(raw.slice(flag.length + 1));
  if (!Number.isSafeInteger(value) || value < 1) throw new Error(`${flag} requiere un entero positivo.`);
  return value;
}

function usage(): string {
  return [
    "Uso: npm run quotas:padron -- [opciones]",
    "  --dry-run           Solo reporte (predeterminado).",
    "  --execute --confirm Persiste identidad SIE en sie_associate_records.",
    "  --page-size=N       Tamaño de página (máximo 500).",
    "  --max-pages=N       Limita páginas para pruebas controladas.",
    "  --start-page=N      Página inicial.",
    "  --resume            Continúa desde .tmp/quota-padron-checkpoint.json.",
  ].join("\n");
}

async function readCheckpoint(): Promise<QuotaPadronCheckpoint | null> {
  try {
    return JSON.parse(await readFile(CHECKPOINT_PATH, "utf8")) as QuotaPadronCheckpoint;
  } catch {
    return null;
  }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(usage());
    return;
  }
  assertExecutionTarget(process.argv);
  if (args.execute && !args.confirm) {
    console.log(JSON.stringify({ status: "BLOCKED", reason: "PADRON_EXECUTE_REQUIRES_CONFIRM" }, null, 2));
    process.exitCode = 2;
    return;
  }

  const checkpoint = args.resume ? await readCheckpoint() : null;
  const startPage = checkpoint ? checkpoint.lastPage + 1 : args.startPage;
  const prisma = new PrismaClient();
  try {
    const api = new AssociatesApiClient(getAssociatesApiConfig());
    const repository = new PrismaQuotaPadronRepository(prisma);
    const service = new QuotaPadronService((input) => api.listAssociates(input), repository);
    const selection = await service.fetch({ pageSize: args.pageSize, maxPages: args.maxPages, startPage });

    let applied = 0;
    if (args.execute) {
      const now = new Date();
      for (const record of selection.records) {
        const externalCode = record.externalCode?.trim() ?? "";
        if (!externalCode) continue;
        const localType = mapSieDocumentType(record.documentType);
        const documentNumber = record.documentNumber?.trim() ?? "";
        const personId = localType && documentNumber ? selection.personByDocument.get(`${localType}|${documentNumber}`) ?? null : null;
        await prisma.sieAssociateRecord.upsert({
          where: { provider_externalCode: { provider: "SIE", externalCode } },
          create: {
            provider: "SIE",
            externalCode,
            sourceDocumentType: record.documentType || null,
            documentNumber: documentNumber || null,
            sourceType: record.sourceType,
            sourceDescription: record.sourceDescription ?? null,
            personId,
            linkStatus: personId ? SieLinkStatus.LINKED : SieLinkStatus.UNLINKED,
            lastSyncedAt: now,
          },
          update: {
            sourceDocumentType: record.documentType || null,
            documentNumber: documentNumber || null,
            sourceType: record.sourceType,
            sourceDescription: record.sourceDescription ?? null,
            ...(personId ? { personId, linkStatus: SieLinkStatus.LINKED } : {}),
            lastSyncedAt: now,
          },
        });
        applied += 1;
      }
    }

    await mkdir(dirname(CHECKPOINT_PATH), { recursive: true });
    await writeFile(CHECKPOINT_PATH, JSON.stringify(selection.report.checkpoint, null, 2), "utf8");
    console.log(JSON.stringify({
      target: { environment: "local" },
      mode: args.execute ? "execute" : "dry-run",
      applied,
      report: selection.report,
    }, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.log(JSON.stringify({ status: "FAILED", code: "PADRON_SYNC_COMMAND_FAILED", message: error instanceof Error ? error.message : "Error desconocido" }, null, 2));
  process.exitCode = 1;
});
