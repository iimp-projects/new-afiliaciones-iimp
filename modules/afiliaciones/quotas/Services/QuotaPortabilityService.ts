import { createHash } from "node:crypto";
import type { AssociateQuotaRecord } from "../Models/QuotaModels";
import type { PortableQuotaRecord, QuotaExportFile, QuotaImportPlan } from "../Models/QuotaPortability";

export type QuotaPortabilityValidation = {
  ok: boolean;
  recordCount: number;
  errors: string[];
};

export type QuotaImportPlanInput = {
  existing: ReadonlyMap<string, AssociateQuotaRecord>;
  file: QuotaExportFile;
  force?: boolean;
};

export function checksumRecords(records: readonly PortableQuotaRecord[]): string {
  return createHash("sha256").update(JSON.stringify(records), "utf8").digest("hex");
}

export class QuotaPortabilityService {
  buildExport(records: readonly AssociateQuotaRecord[], meta: { sourceDatabase: string; generatedAt?: Date }): QuotaExportFile {
    const portable = records
      .map((record): PortableQuotaRecord => ({
        sourceKey: record.sourceKey,
        institutionalCode: record.institutionalCode,
        provider: record.provider,
        documentType: record.documentType,
        documentNumberHash: record.documentNumberHash,
        concept: record.concept,
        quotaNumber: record.quotaNumber,
        year: record.year,
        currency: record.currency,
        amount: record.amount,
        accountingStatus: record.accountingStatus,
        membershipType: record.membershipType,
        paidAt: record.paidAt,
        periodStart: record.periodStart,
        periodEnd: record.periodEnd,
        receiptSerie: record.receiptSerie,
        receiptNumber: record.receiptNumber,
        isPresentInLastSuccessfulSync: record.isPresentInLastSuccessfulSync,
        sourcePayloadHash: record.sourcePayloadHash,
        firstSeenAt: record.firstSeenAt.toISOString(),
        lastSeenAt: record.lastSeenAt.toISOString(),
      }))
      .sort((a, b) => a.sourceKey.localeCompare(b.sourceKey));

    return {
      formatVersion: 1,
      generatedAt: (meta.generatedAt ?? new Date()).toISOString(),
      sourceDatabase: meta.sourceDatabase,
      recordCount: portable.length,
      checksum: checksumRecords(portable),
      records: portable,
    };
  }

  validate(value: unknown): QuotaPortabilityValidation {
    const errors: string[] = [];
    if (!isRecord(value)) return { ok: false, recordCount: 0, errors: ["El archivo no contiene un objeto JSON válido."] };
    if (value.formatVersion !== 1) errors.push("formatVersion no soportado.");
    if (typeof value.sourceDatabase !== "string") errors.push("sourceDatabase inválido.");
    if (!Array.isArray(value.records)) {
      return { ok: false, recordCount: 0, errors: [...errors, "records no es un arreglo."] };
    }
    const records = value.records.filter(isPortableQuota);
    if (records.length !== value.records.length) errors.push("Existen registros con estructura inválida.");
    if (value.recordCount !== records.length) errors.push("recordCount no coincide con la cantidad de registros.");
    const keys = new Set<string>();
    for (const record of records) {
      if (keys.has(record.sourceKey)) errors.push("Existen sourceKey duplicados.");
      keys.add(record.sourceKey);
    }
    const checksum = checksumRecords(records);
    if (value.checksum !== checksum) errors.push("Checksum inválido.");
    return { ok: errors.length === 0, recordCount: records.length, errors };
  }

  planImport(input: QuotaImportPlanInput): QuotaImportPlan {
    const plan: QuotaImportPlan = { inserted: 0, updated: 0, unchanged: 0, skippedNewer: 0, errors: 0 };
    for (const record of input.file.records) {
      const existing = input.existing.get(record.sourceKey);
      if (!existing) { plan.inserted += 1; continue; }
      if (!input.force && existing.lastSeenAt.getTime() > new Date(record.lastSeenAt).getTime()) {
        plan.skippedNewer += 1;
        continue;
      }
      if (existing.sourcePayloadHash === record.sourcePayloadHash) {
        plan.unchanged += 1;
        continue;
      }
      plan.updated += 1;
    }
    return plan;
  }
}

function isPortableQuota(value: unknown): value is PortableQuotaRecord {
  if (!isRecord(value)) return false;
  return typeof value.sourceKey === "string"
    && typeof value.provider === "string"
    && typeof value.documentType === "string"
    && typeof value.documentNumberHash === "string"
    && (value.concept === "INSCRIPCION" || value.concept === "CUOTA")
    && typeof value.year === "number"
    && typeof value.currency === "string"
    && typeof value.amount === "string"
    && (value.accountingStatus === "FACTURADO" || value.accountingStatus === "PENDIENTE")
    && typeof value.membershipType === "string"
    && typeof value.sourcePayloadHash === "string"
    && typeof value.firstSeenAt === "string"
    && typeof value.lastSeenAt === "string";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
