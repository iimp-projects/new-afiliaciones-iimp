import "dotenv/config";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { PrismaClient } from "@prisma/client";
import { PrismaQuotaPortabilityRepository } from "../modules/afiliaciones/quotas/Repositories/PrismaQuotaPortabilityRepository";
import { QuotaPortabilityService } from "../modules/afiliaciones/quotas/Services/QuotaPortabilityService";
import { assertExecutionTarget } from "./sie-execution-guard";

async function main() {
  assertExecutionTarget(process.argv.slice(2));
  const outputArg = process.argv.slice(2).find((arg) => arg.startsWith("--output="));
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const output = outputArg ? resolve(outputArg.slice("--output=".length)) : resolve(`.tmp/quotas-export-${stamp}.json`);
  const prisma = new PrismaClient();
  try {
    const service = new QuotaPortabilityService();
    const repository = new PrismaQuotaPortabilityRepository(prisma);
    const records = await repository.listAll();
    const file = service.buildExport(records, { sourceDatabase: databaseLabel(process.env.DATABASE_URL) });
    await mkdir(dirname(output), { recursive: true });
    await writeFile(output, JSON.stringify(file, null, 2), "utf8");
    console.log(JSON.stringify({
      status: "OK",
      output,
      formatVersion: file.formatVersion,
      recordCount: file.recordCount,
      checksum: file.checksum,
      generatedAt: file.generatedAt,
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
  console.log(JSON.stringify({ status: "FAILED", code: "QUOTAS_EXPORT_FAILED", message: error instanceof Error ? error.message : "Error desconocido" }, null, 1));
  process.exitCode = 1;
});
