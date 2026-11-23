import "dotenv/config";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { PrismaClient } from "@prisma/client";
import { PrismaQuotaPortabilityRepository } from "../modules/afiliaciones/quotas/Repositories/PrismaQuotaPortabilityRepository";
import { QuotaPortabilityService } from "../modules/afiliaciones/quotas/Services/QuotaPortabilityService";
import type { QuotaExportFile } from "../modules/afiliaciones/quotas/Models/QuotaPortability";
import { assertExecutionTarget } from "./sie-execution-guard";

type Args = { file?: string; execute: boolean; confirm: boolean; force: boolean; help: boolean };

function parseArgs(argv: string[]): Args {
  const args: Args = { execute: false, confirm: false, force: false, help: false };
  for (const raw of argv) {
    if (raw === "--execute") args.execute = true;
    else if (raw === "--confirm") args.confirm = true;
    else if (raw === "--force") args.force = true;
    else if (raw === "--dry-run") continue;
    else if (raw === "--help" || raw === "-h") args.help = true;
    else if (raw.startsWith("--file=")) args.file = resolve(raw.slice("--file=".length));
    else throw new Error(`Argumento no reconocido: ${raw.split("=")[0]}`);
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log([
      "Uso: npx tsx scripts/quotas-import.ts --file=archivo.json [--dry-run|--execute --confirm] [--force]",
      "  --dry-run  Valida y planifica sin escribir (predeterminado).",
      "  --execute --confirm  Importa cuotas en LOCAL.",
      "  --force    Sobrescribe aunque el destino tenga lastSeenAt más reciente.",
    ].join("\n"));
    return;
  }
  if (!args.file) throw new Error("Falta --file.");
  assertExecutionTarget(process.argv.slice(2));
  if (args.execute && !args.confirm) {
    console.log(JSON.stringify({ status: "BLOCKED", reason: "IMPORT_REQUIRES_CONFIRM" }, null, 1));
    process.exitCode = 2;
    return;
  }

  const payload = JSON.parse(await readFile(args.file, "utf8")) as unknown;
  const service = new QuotaPortabilityService();
  const validation = service.validate(payload);
  if (!validation.ok) {
    console.log(JSON.stringify({ status: "BLOCKED", reason: "INVALID_EXPORT", validation }, null, 1));
    process.exitCode = 2;
    return;
  }
  const file = payload as QuotaExportFile;

  const prisma = new PrismaClient();
  try {
    const repository = new PrismaQuotaPortabilityRepository(prisma);
    const existing = new Map((await repository.listAll()).map((record) => [record.sourceKey, record]));
    const plan = service.planImport({ existing, file, force: args.force });

    const result = { inserted: 0, updated: 0, unchanged: 0, skippedNewer: 0 };
    if (args.execute) {
      const codes = file.records.map((record) => record.institutionalCode).filter((code): code is string => Boolean(code));
      const personByCode = await repository.findPersonIdsByInstitutionalCodes(codes);
      for (const record of file.records) {
        const personId = record.institutionalCode ? personByCode.get(record.institutionalCode) ?? null : null;
        const outcome = await repository.upsertPortable(record, personId, args.force);
        if (outcome === "INSERTED") result.inserted += 1;
        else if (outcome === "UPDATED") result.updated += 1;
        else if (outcome === "UNCHANGED") result.unchanged += 1;
        else result.skippedNewer += 1;
      }
    }

    console.log(JSON.stringify({
      status: args.execute ? "OK" : "DRY_RUN",
      target: databaseLabel(process.env.DATABASE_URL),
      validation,
      plan,
      result: args.execute ? result : null,
      force: args.force,
    }, null, 1));
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
  console.log(JSON.stringify({ status: "FAILED", code: "QUOTAS_IMPORT_FAILED", message: error instanceof Error ? error.message : "Error desconocido" }, null, 1));
  process.exitCode = 1;
});
