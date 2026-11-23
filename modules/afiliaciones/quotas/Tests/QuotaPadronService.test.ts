import { describe, expect, it } from "vitest";
import type { SanitizedSieAssociate } from "@/modules/afiliaciones/associates-integration/Models/SieAssociateList";
import type { QuotaPadronFetcher, QuotaPadronPage } from "../Models/QuotaPadron";
import type { IQuotaPadronRepository, PadronDocument } from "../Repositories/Interfaces/IQuotaPadronRepository";
import { QuotaPadronService } from "../Services/QuotaPadronService";

const record = (overrides: Partial<SanitizedSieAssociate> = {}): SanitizedSieAssociate => ({
  documentType: "1",
  documentNumber: "00123456",
  externalCode: "000123",
  sourceType: "A",
  sourceDescription: "Activo",
  passwordPresent: true,
  ...overrides,
});

class FakePadronRepository implements IQuotaPadronRepository {
  documents: PadronDocument[] = [];
  personIds = new Map<string, number>();
  async findPersonIdsByDocuments(documents: readonly PadronDocument[]): Promise<Map<string, number>> {
    this.documents = [...documents];
    return this.personIds;
  }
}

const page = (pagina: number, associates: SanitizedSieAssociate[], totalPaginas = 2): QuotaPadronPage => ({
  pagina,
  totalPaginas,
  totalRegistros: totalPaginas * associates.length,
  associates,
});

describe("QuotaPadronService", () => {
  it("pagina, deduplica por código y reporta vinculación", async () => {
    const fetcher: QuotaPadronFetcher = async ({ pagina }) => pagina === 1
      ? page(1, [record(), record({ documentNumber: "00123456" })])
      : page(2, [record({ externalCode: "000999", documentNumber: "00999999", sourceType: "E" })]);
    const repository = new FakePadronRepository();
    repository.personIds.set("DNI|00123456", 10);
    const result = await new QuotaPadronService(fetcher, repository).fetch();

    expect(result.report).toMatchObject({ pagesFetched: 2, totalRecords: 3, uniqueRecords: 2, duplicates: 1, validDocument: 2, linkedToPerson: 1, unlinked: 1 });
    expect(result.report.byCategory).toMatchObject({ A: 1, E: 1 });
    expect(result.report.checkpoint).toEqual({ lastPage: 2, totalPages: 2, pageSize: 500 });
    expect(result.personByDocument.get("DNI|00123456")).toBe(10);
  });

  it("limita páginas para pruebas controladas y reporta documentos inválidos", async () => {
    const fetcher: QuotaPadronFetcher = async ({ pagina }) => page(pagina, [
      record({ documentType: "RUC", documentNumber: "20000000001", externalCode: "1" }),
      record({ documentNumber: "", externalCode: "2" }),
    ]);
    const result = await new QuotaPadronService(fetcher, new FakePadronRepository()).fetch({ maxPages: 1 });
    expect(result.report.pagesFetched).toBe(1);
    expect(result.report.unsupportedDocument).toBe(1);
    expect(result.report.missingDocument).toBe(1);
  });

  it("no usa ni expone Clave", async () => {
    const fetcher: QuotaPadronFetcher = async () => page(1, [record({ passwordPresent: true })], 1);
    const result = await new QuotaPadronService(fetcher, new FakePadronRepository()).fetch();
    expect(JSON.stringify(result.report)).not.toContain("password");
    expect(result.records[0]).not.toHaveProperty("clave");
  });
});
