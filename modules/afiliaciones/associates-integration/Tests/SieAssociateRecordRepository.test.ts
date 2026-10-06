import { describe, expect, it } from "vitest";
import type { ISieAssociateRecordRepository, SieAssociateRecordInput, SieAssociateRecordView } from "../Repositories/Interfaces/ISieAssociateRecordRepository";

class MemoryRepository implements ISieAssociateRecordRepository {
  private records = new Map<number, SieAssociateRecordView>();
  private nextId = 1;

  async findByProviderAndExternalCode(provider: string, externalCode: string) {
    return [...this.records.values()].find((record) => record.provider === provider && record.externalCode === externalCode) ?? null;
  }

  async findByPersonId(personId: number) {
    return [...this.records.values()].filter((record) => record.personId === personId);
  }

  async upsertExternalRecord(input: SieAssociateRecordInput) {
    const existing = [...this.records.values()].find((record) => record.provider === input.provider && record.externalCode === input.externalCode);
    if (existing) {
      const updated: SieAssociateRecordView = {
        ...existing,
        sourceDocumentType: input.sourceDocumentType ?? null,
        documentNumber: input.documentNumber ?? null,
        sourceType: input.sourceType,
        sourceDescription: input.sourceDescription ?? null,
        categoryId: input.categoryId ?? null,
        personId: input.personId ?? null,
        linkStatus: input.linkStatus ?? existing.linkStatus,
        lastSyncedAt: new Date(),
      };
      this.records.set(existing.id, updated);
      return updated;
    }
    const record: SieAssociateRecordView = {
      id: this.nextId++,
      provider: input.provider,
      externalCode: input.externalCode,
      sourceDocumentType: input.sourceDocumentType ?? null,
      documentNumber: input.documentNumber ?? null,
      sourceType: input.sourceType,
      sourceDescription: input.sourceDescription ?? null,
      categoryId: input.categoryId ?? null,
      personId: input.personId ?? null,
      linkStatus: input.linkStatus ?? "UNLINKED",
      lastSyncedAt: null,
    };
    this.records.set(record.id, record);
    return record;
  }

  async linkToPerson(recordId: number, personId: number) {
    const record = this.records.get(recordId)!;
    const updated: SieAssociateRecordView = { ...record, personId, linkStatus: "LINKED" };
    this.records.set(recordId, updated);
    return updated;
  }

  async markConflict(recordId: number) {
    const record = this.records.get(recordId)!;
    const updated: SieAssociateRecordView = { ...record, linkStatus: "CONFLICT" };
    this.records.set(recordId, updated);
    return updated;
  }

  async listUnlinked() {
    return [...this.records.values()].filter((record) => record.linkStatus === "UNLINKED");
  }
}

describe("SieAssociateRecordRepository (contrato)", () => {
  it("externalCode conserva ceros iniciales", async () => {
    const repo = new MemoryRepository();
    await repo.upsertExternalRecord({ provider: "SIE", externalCode: "00012", sourceType: "A" });
    const found = await repo.findByProviderAndExternalCode("SIE", "00012");
    expect(found?.externalCode).toBe("00012");
  });

  it("es idempotente por provider + externalCode", async () => {
    const repo = new MemoryRepository();
    const first = await repo.upsertExternalRecord({ provider: "SIE", externalCode: "00012", sourceType: "A" });
    const second = await repo.upsertExternalRecord({ provider: "SIE", externalCode: "00012", sourceType: "A" });
    expect(second.id).toBe(first.id);
  });

  it("una Person puede tener múltiples códigos SIE", async () => {
    const repo = new MemoryRepository();
    await repo.upsertExternalRecord({ provider: "SIE", externalCode: "00001", sourceType: "A", personId: 1, linkStatus: "LINKED" });
    await repo.upsertExternalRecord({ provider: "SIE", externalCode: "00002", sourceType: "A", personId: 1, linkStatus: "LINKED" });
    await repo.upsertExternalRecord({ provider: "SIE", externalCode: "00003", sourceType: "A", personId: 1, linkStatus: "LINKED" });
    expect((await repo.findByPersonId(1)).length).toBe(3);
  });

  it("un registro SIE puede existir con personId null", async () => {
    const repo = new MemoryRepository();
    const record = await repo.upsertExternalRecord({ provider: "SIE", externalCode: "00004", sourceType: "X" });
    expect(record.personId).toBeNull();
    expect(record.linkStatus).toBe("UNLINKED");
  });

  it("un registro UNLINKED puede vincularse posteriormente sin duplicarse", async () => {
    const repo = new MemoryRepository();
    const record = await repo.upsertExternalRecord({ provider: "SIE", externalCode: "00005", sourceType: "E" });
    const linked = await repo.linkToPerson(record.id, 42);
    expect(linked.personId).toBe(42);
    expect(linked.linkStatus).toBe("LINKED");
    expect(linked.id).toBe(record.id);
  });

  it("documentNumber permanece String con ceros iniciales", async () => {
    const repo = new MemoryRepository();
    const record = await repo.upsertExternalRecord({ provider: "SIE", externalCode: "00006", sourceType: "A", documentNumber: "07123456" });
    expect(record.documentNumber).toBe("07123456");
  });

  it("un tipo documental desconocido se almacena sin crear Person", async () => {
    const repo = new MemoryRepository();
    const record = await repo.upsertExternalRecord({ provider: "SIE", externalCode: "00007", sourceType: "A", sourceDocumentType: "0", documentNumber: "12345678" });
    expect(record.sourceDocumentType).toBe("0");
    expect(record.personId).toBeNull();
  });

  it("markConflict deja el registro en CONFLICT", async () => {
    const repo = new MemoryRepository();
    const record = await repo.upsertExternalRecord({ provider: "SIE", externalCode: "00008", sourceType: "A" });
    const conflicted = await repo.markConflict(record.id);
    expect(conflicted.linkStatus).toBe("CONFLICT");
  });
});
