import { describe, expect, it } from "vitest";
import type { IQuotaUniverseRepository, UniversePerson, UniverseSieRecord } from "../Repositories/Interfaces/IQuotaUniverseRepository";
import { QuotaUniverseService, toSieDocumentType } from "../Services/QuotaUniverseService";

class FakeUniverseRepository implements IQuotaUniverseRepository {
  sieRecords: UniverseSieRecord[] = [];
  applications: UniversePerson[] = [];
  persons: UniversePerson[] = [];

  async listSieRecords(): Promise<UniverseSieRecord[]> {
    return this.sieRecords;
  }

  async listCompletedApplicationPersons(): Promise<UniversePerson[]> {
    return this.applications;
  }

  async findPersonsByIds(personIds: readonly number[]): Promise<UniversePerson[]> {
    return this.persons.filter((person) => personIds.includes(person.personId));
  }
}

const sieRecord = (overrides: Partial<UniverseSieRecord> = {}): UniverseSieRecord => ({
  personId: 1,
  externalCode: "000123",
  sourceDocumentType: "1",
  documentNumber: "00123456",
  sourceType: "A",
  ...overrides,
});

describe("QuotaUniverseService", () => {
  it("mapea tipos de documento SIE sin aceptar valores desconocidos", () => {
    expect(toSieDocumentType("1")).toBe("1");
    expect(toSieDocumentType("DNI")).toBe("1");
    expect(toSieDocumentType("PASSPORT")).toBe("7");
    expect(toSieDocumentType("RUC")).toBeNull();
  });

  it("preserva códigos institucionales con ceros y deduplica por documento", async () => {
    const repository = new FakeUniverseRepository();
    repository.sieRecords = [sieRecord(), sieRecord({ externalCode: "999" })];
    const result = await new QuotaUniverseService(repository).resolve();
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0]).toMatchObject({ personId: 1, institutionalCode: "000123", documentType: "1", documentNumber: "00123456" });
    expect(result.report.duplicates).toBe(1);
  });

  it("usa postulaciones COMPLETED cuando el padrón SIE local está vacío", async () => {
    const repository = new FakeUniverseRepository();
    repository.applications = [{ personId: 7, documentType: "DNI", documentNumber: "70000001" }];
    const result = await new QuotaUniverseService(repository).resolve({ limit: 10 });
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0]).toMatchObject({ personId: 7, documentType: "1", institutionalCode: null });
    expect(result.report.fromApplications).toBe(1);
  });

  it("excluye documentos no soportados y aplica límite tras deduplicar", async () => {
    const repository = new FakeUniverseRepository();
    repository.sieRecords = [
      sieRecord({ personId: 1, documentNumber: "00000001" }),
      sieRecord({ personId: 2, documentNumber: "00000002" }),
      sieRecord({ personId: 3, sourceDocumentType: "RUC", documentNumber: "20000000001" }),
    ];
    const result = await new QuotaUniverseService(repository).resolve({ limit: 1 });
    expect(result.candidates).toHaveLength(1);
    expect(result.report.unsupportedDocument).toBe(1);
  });

  it("aplica offset estable para segmentar el universo", async () => {
    const repository = new FakeUniverseRepository();
    repository.sieRecords = [
      sieRecord({ personId: 1, externalCode: "000001", documentNumber: "00000001" }),
      sieRecord({ personId: 2, externalCode: "000002", documentNumber: "00000002" }),
      sieRecord({ personId: 3, externalCode: "000003", documentNumber: "00000003" }),
    ];
    const result = await new QuotaUniverseService(repository).resolve({ offset: 1, limit: 1 });
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0].personId).toBe(2);
  });

  it("resuelve personas explícitas y conserva el código del registro SIE", async () => {
    const repository = new FakeUniverseRepository();
    repository.sieRecords = [sieRecord({ personId: 5, externalCode: "000777" })];
    repository.persons = [{ personId: 5, documentType: "DNI", documentNumber: "00123456" }];
    const result = await new QuotaUniverseService(repository).resolve({ personIds: [5] });
    expect(result.candidates[0]).toMatchObject({ personId: 5, institutionalCode: "000777", documentType: "1" });
  });
});
