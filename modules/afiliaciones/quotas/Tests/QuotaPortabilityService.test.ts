import { describe, expect, it } from "vitest";
import type { AssociateQuotaRecord } from "../Models/QuotaModels";
import { QuotaPortabilityService } from "../Services/QuotaPortabilityService";

const record = (sourceKey: string, overrides: Partial<AssociateQuotaRecord> = {}): AssociateQuotaRecord => ({
  id: 1,
  personId: 1,
  institutionalCode: "000123",
  provider: "SIE",
  documentType: "DNI",
  documentNumberHash: "doc-hash",
  sourceKey,
  sourcePayloadHash: "payload-hash",
  concept: "CUOTA",
  quotaNumber: 1,
  year: 2026,
  currency: "S/",
  amount: "150.00",
  accountingStatus: "FACTURADO",
  membershipType: "Activo",
  paidAt: "2026-01-05",
  periodStart: "2026-01-05",
  periodEnd: "2027-01-04",
  receiptSerie: "F009",
  receiptNumber: "3298",
  isPresentInLastSuccessfulSync: true,
  firstSeenAt: new Date("2026-01-01T00:00:00.000Z"),
  lastSeenAt: new Date("2026-01-02T00:00:00.000Z"),
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-02T00:00:00.000Z"),
  ...overrides,
});

describe("QuotaPortabilityService", () => {
  it("genera un export ordenado con checksum verificable", () => {
    const service = new QuotaPortabilityService();
    const file = service.buildExport([record("B"), record("A")], { sourceDatabase: "local", generatedAt: new Date("2026-11-18T00:00:00.000Z") });
    expect(file.recordCount).toBe(2);
    expect(file.records.map((item) => item.sourceKey)).toEqual(["A", "B"]);
    expect(service.validate(file)).toMatchObject({ ok: true, recordCount: 2 });
  });

  it("detecta checksum inválido y sourceKey duplicado", () => {
    const service = new QuotaPortabilityService();
    const file = service.buildExport([record("A")], { sourceDatabase: "local" });
    expect(service.validate({ ...file, checksum: "bad" }).ok).toBe(false);
    expect(service.validate({ ...file, records: [file.records[0], file.records[0]], recordCount: 2 }).ok).toBe(false);
  });

  it("planifica importación protegiendo datos más recientes", () => {
    const service = new QuotaPortabilityService();
    const file = service.buildExport([record("A"), record("B"), record("C")], { sourceDatabase: "local" });
    const existing = new Map<string, AssociateQuotaRecord>([
      ["A", record("A")],
      ["B", record("B", { lastSeenAt: new Date("2027-01-01T00:00:00.000Z") })],
      ["C", record("C", { sourcePayloadHash: "different" })],
    ]);
    const plan = service.planImport({ existing, file });
    expect(plan).toEqual({ inserted: 0, updated: 1, unchanged: 1, skippedNewer: 1, errors: 0 });
    expect(service.planImport({ existing, file, force: true })).toMatchObject({ updated: 1, unchanged: 2 });
  });
});
