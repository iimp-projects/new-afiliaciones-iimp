import { describe, expect, it } from "vitest";
import type { SieAssociateState } from "@/modules/afiliaciones/associates-integration/Models/AssociateIntegration";
import type { AssociateQuotaRecord, NormalizedQuota, QuotaSyncItemRecord, QuotaSyncWriteResult } from "../Models/QuotaModels";
import type { ApplySuccessfulSyncInput, IQuotaRepository } from "../Repositories/Interfaces/IQuotaRepository";
import type { IQuotaSyncItemRepository } from "../Repositories/Interfaces/IQuotaSyncItemRepository";
import { QuotaIngestionService } from "../Services/QuotaIngestionService";
import { QuotaNormalizer } from "../Services/QuotaNormalizer";
import { quotaFixture } from "./quotaFixtures";

class FakeQuotaRepository implements IQuotaRepository {
  readonly records = new Map<string, AssociateQuotaRecord>();
  knownPersons: Set<number> | null = null;
  private nextId = 1;

  async applySuccessfulSync(input: ApplySuccessfulSyncInput): Promise<QuotaSyncWriteResult> {
    if (input.personId != null && this.knownPersons && !this.knownPersons.has(input.personId)) {
      throw new Error("foreign key violation");
    }
    let inserted = 0;
    let updated = 0;
    let unchanged = 0;
    const seen = new Set<string>();
    for (const quota of input.quotas) {
      const existing = this.records.get(quota.sourceKey);
      if (!existing) {
        this.records.set(quota.sourceKey, this.toRecord(quota, input, this.nextId++));
        inserted += 1;
      } else if (existing.personId != null && input.personId != null && existing.personId !== input.personId) {
        throw new Error("person mismatch");
      } else {
        const action = existing.sourcePayloadHash === quota.sourcePayloadHash ? "UNCHANGED" : "UPDATED";
        this.records.set(quota.sourceKey, this.toRecord(quota, input, existing.id, existing.firstSeenAt));
        if (action === "UPDATED") updated += 1;
        else unchanged += 1;
      }
      seen.add(quota.sourceKey);
    }
    let markedNotPresent = 0;
    if (input.personId != null) {
      for (const record of this.records.values()) {
        if (record.personId === input.personId && !seen.has(record.sourceKey) && record.isPresentInLastSuccessfulSync) {
          record.isPresentInLastSuccessfulSync = false;
          markedNotPresent += 1;
        }
      }
    }
    return { inserted, updated, unchanged, markedNotPresent };
  }

  async findBySourceKey(sourceKey: string): Promise<AssociateQuotaRecord | null> {
    return this.records.get(sourceKey) ?? null;
  }

  async listByPersonId(personId: number): Promise<AssociateQuotaRecord[]> {
    return [...this.records.values()].filter((record) => record.personId === personId);
  }

  private toRecord(quota: NormalizedQuota, input: ApplySuccessfulSyncInput, id: number, firstSeenAt = input.syncedAt): AssociateQuotaRecord {
    return {
      id,
      personId: input.personId,
      institutionalCode: quota.institutionalCode ?? input.institutionalCode,
      provider: quota.provider,
      documentType: quota.documentType,
      documentNumberHash: quota.documentNumberHash,
      sourceKey: quota.sourceKey,
      sourcePayloadHash: quota.sourcePayloadHash,
      concept: quota.concept,
      quotaNumber: quota.quotaNumber,
      year: quota.year,
      currency: quota.currency,
      amount: quota.amount,
      accountingStatus: quota.accountingStatus,
      membershipType: quota.membershipType,
      paidAt: quota.paidAt,
      periodStart: quota.periodStart,
      periodEnd: quota.periodEnd,
      receiptSerie: quota.receiptSerie,
      receiptNumber: quota.receiptNumber,
      isPresentInLastSuccessfulSync: true,
      firstSeenAt,
      lastSeenAt: input.syncedAt,
      createdAt: firstSeenAt,
      updatedAt: input.syncedAt,
    };
  }
}

class FakeQuotaSyncItemRepository implements IQuotaSyncItemRepository {
  readonly items = new Map<string, QuotaSyncItemRecord>();
  private nextId = 1;

  async createOrGet(input: { syncRunId: number; personId: number | null; institutionalCode: string | null; identityHash: string }): Promise<QuotaSyncItemRecord> {
    const key = `${input.syncRunId}:${input.identityHash}`;
    const existing = this.items.get(key);
    if (existing) return existing;
    const now = new Date("2026-11-18T12:00:00.000Z");
    const record: QuotaSyncItemRecord = {
      id: this.nextId++,
      syncRunId: input.syncRunId,
      personId: input.personId,
      institutionalCode: input.institutionalCode,
      identityHash: input.identityHash,
      status: "PENDING",
      attempts: 0,
      quotasRecovered: 0,
      recordsCreated: 0,
      recordsUpdated: 0,
      errorCode: null,
      startedAt: now,
      finishedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    this.items.set(key, record);
    return record;
  }

  async markRunning(id: number, startedAt: Date): Promise<QuotaSyncItemRecord> {
    const record = this.byId(id);
    record.status = "RUNNING";
    record.startedAt = startedAt;
    record.attempts += 1;
    return record;
  }

  async finish(id: number, completion: { status: QuotaSyncItemRecord["status"]; quotasRecovered: number; recordsCreated: number; recordsUpdated: number; errorCode?: string | null; finishedAt: Date }): Promise<QuotaSyncItemRecord> {
    const record = this.byId(id);
    record.status = completion.status;
    record.quotasRecovered = completion.quotasRecovered;
    record.recordsCreated = completion.recordsCreated;
    record.recordsUpdated = completion.recordsUpdated;
    record.errorCode = completion.errorCode ?? null;
    record.finishedAt = completion.finishedAt;
    return record;
  }

  async listByRun(syncRunId: number): Promise<QuotaSyncItemRecord[]> {
    return [...this.items.values()].filter((item) => item.syncRunId === syncRunId);
  }

  private byId(id: number): QuotaSyncItemRecord {
    const record = [...this.items.values()].find((item) => item.id === id);
    if (!record) throw new Error("item not found");
    return record;
  }
}

const identity = { syncRunId: 1, personId: 1, documentType: "DNI", documentNumber: "00123456", institutionalCode: "000123" };

function setup() {
  let now = new Date("2026-11-18T12:00:00.000Z");
  const clock = () => now;
  const advance = () => { now = new Date(now.getTime() + 1000); };
  const quotas = new FakeQuotaRepository();
  const items = new FakeQuotaSyncItemRepository();
  const service = new QuotaIngestionService(quotas, items, undefined, new QuotaNormalizer(), clock);
  return { service, quotas, items, advance };
}

const successState = (overrides: Parameters<typeof quotaFixture>[0] = {}): SieAssociateState => ({
  status: true,
  cuotas: [
    quotaFixture({ concepto: "INSCRIPCION", numero: null, anno: 2023, ...overrides }),
    quotaFixture(overrides),
  ],
});

describe("QuotaIngestionService", () => {
  it("inserta y es idempotente ante la misma respuesta", async () => {
    const { service, quotas, items } = setup();
    const first = await service.ingest({ ...identity, state: successState() });
    expect(first).toMatchObject({ status: "SUCCEEDED", quotasRecovered: 2, inserted: 2, updated: 0 });
    expect(quotas.records.size).toBe(2);

    const second = await service.ingest({ ...identity, state: successState() });
    expect(second).toMatchObject({ status: "SUCCEEDED", inserted: 0, updated: 0, unchanged: 2 });
    expect(quotas.records.size).toBe(2);
    expect(items.items.size).toBe(1);
    expect([...items.items.values()][0].attempts).toBe(2);
  });

  it("actualiza el monto sin duplicar la cuota", async () => {
    const { service, quotas } = setup();
    await service.ingest({ ...identity, state: successState() });
    const result = await service.ingest({ ...identity, state: { status: true, cuotas: [quotaFixture({ monto: 200 })] } });
    expect(result).toMatchObject({ status: "SUCCEEDED", inserted: 0, updated: 1, unchanged: 0 });
    expect(quotas.records.size).toBe(2);
    expect([...quotas.records.values()].find((record) => record.concept === "CUOTA")?.amount).toBe("200.00");
  });

  it("conserva cuotas históricas y solo marca ausencia en la última sincronización", async () => {
    const { service, quotas } = setup();
    await service.ingest({ ...identity, state: successState() });
    await service.ingest({ ...identity, state: { status: true, cuotas: [quotaFixture()] } });
    expect(quotas.records.size).toBe(2);
    const inscription = [...quotas.records.values()].find((record) => record.concept === "INSCRIPCION");
    expect(inscription?.isPresentInLastSuccessfulSync).toBe(false);
  });

  it("actualiza estado contable y fecha de pago reportada", async () => {
    const { service, quotas } = setup();
    await service.ingest({ ...identity, state: successState() });
    const result = await service.ingest({ ...identity, state: { status: true, cuotas: [quotaFixture({ estadoContable: "Pendiente", fechaPago: "" })] } });
    expect(result).toMatchObject({ status: "SUCCEEDED", updated: 1 });
    const quota = [...quotas.records.values()].find((record) => record.concept === "CUOTA");
    expect(quota?.accountingStatus).toBe("PENDIENTE");
    expect(quota?.paidAt).toBeNull();
  });

  it("preserva códigos con ceros iniciales y los separa de otro documento", async () => {
    const { service, quotas } = setup();
    await service.ingest({ ...identity, state: { status: true, cuotas: [quotaFixture()] } });
    await service.ingest({ ...identity, personId: 2, documentNumber: "123456", state: { status: true, cuotas: [quotaFixture()] } });
    expect(quotas.records.size).toBe(2);
    expect(new Set([...quotas.records.keys()]).size).toBe(2);
  });

  it("mantiene separadas las monedas", async () => {
    const { service, quotas } = setup();
    await service.ingest({ ...identity, state: { status: true, cuotas: [quotaFixture({ moneda: "S/", monto: 150 })] } });
    await service.ingest({ ...identity, personId: 2, documentNumber: "123456", state: { status: true, cuotas: [quotaFixture({ moneda: "US$", monto: 50 })] } });
    const currencies = [...quotas.records.values()].map((record) => `${record.currency}:${record.amount}`).sort();
    expect(currencies).toEqual(["S/:150.00", "US$:50.00"]);
  });

  it("acepta importe cero sin inferir exoneración", async () => {
    const { service, quotas } = setup();
    const result = await service.ingest({ ...identity, state: { status: true, cuotas: [quotaFixture({ monto: 0 })] } });
    expect(result).toMatchObject({ status: "SUCCEEDED", inserted: 1 });
    expect([...quotas.records.values()][0].amount).toBe("0.00");
    expect([...quotas.records.values()][0]).not.toHaveProperty("exoneration");
  });

  it("distingue respuesta vacía exitosa de consulta fallida", async () => {
    const { service, quotas, items } = setup();
    await service.ingest({ ...identity, state: { status: true, cuotas: [quotaFixture()] } });
    const empty = await service.ingest({ ...identity, state: { status: true, cuotas: [] } });
    expect(empty.status).toBe("NO_DATA");
    expect([...quotas.records.values()][0].isPresentInLastSuccessfulSync).toBe(true);

    const failed = await service.fail(identity, "SIE_ERROR WITH SPACES");
    expect(failed.status).toBe("FAILED");
    expect(failed.item.errorCode).toBe("QUOTA_SYNC_FAILED");
    expect(items.items.size).toBe(1);
  });

  it("marca NOT_FOUND cuando el SIE no reconoce al asociado", async () => {
    const { service, quotas } = setup();
    const result = await service.ingest({ ...identity, state: { status: false, message: "No es asociado" } });
    expect(result.status).toBe("NOT_FOUND");
    expect(quotas.records.size).toBe(0);
  });

  it("falla cerrado ante identidades ambiguas y no escribe cuotas", async () => {
    const { service, quotas } = setup();
    const result = await service.ingest({ ...identity, state: { status: true, cuotas: [quotaFixture(), quotaFixture()] } });
    expect(result.status).toBe("FAILED");
    expect(result.item.errorCode).toBe("AMBIGUOUS_QUOTA_IDENTITY");
    expect(quotas.records.size).toBe(0);
  });

  it("preserva un código de error sanitizado y no expone mensajes del proveedor", async () => {
    const { service } = setup();
    const result = await service.fail(identity, "SIE_TIMEOUT");
    expect(result.item.errorCode).toBe("SIE_TIMEOUT");
    expect(result.item.errorCode).not.toContain("SIE_ERROR WITH SPACES");
  });

  it("reporta fallo de persistencia sin marcar el item como exitoso", async () => {
    const { service, quotas } = setup();
    quotas.knownPersons = new Set([1]);
    const result = await service.ingest({ ...identity, personId: 2, documentNumber: "123456", state: { status: true, cuotas: [quotaFixture()] } });
    expect(result.status).toBe("FAILED");
    expect(result.item.errorCode).toBe("QUOTA_PERSISTENCE_FAILED");
    expect(quotas.records.size).toBe(0);
  });
});
