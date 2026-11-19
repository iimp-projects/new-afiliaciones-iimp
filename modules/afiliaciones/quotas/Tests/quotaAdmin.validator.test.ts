import { describe, expect, it } from "vitest";
import { parseQuotaQuery, quotaExportQuerySchema, quotaListQuerySchema } from "../Validators/quotaAdmin.validator";

describe("quota admin validators", () => {
  it("aplica defaults seguros y separa el concepto", () => {
    const query = parseQuotaQuery(quotaListQuerySchema, new URLSearchParams());
    expect(query).toMatchObject({ page: 1, pageSize: 10, concept: "CUOTA", sort: "name", direction: "asc" });
  });

  it("interpreta booleanos false correctamente", () => {
    const query = parseQuotaQuery(quotaListQuerySchema, new URLSearchParams({ hasIncidences: "false" }));
    expect(query.hasIncidences).toBe(false);
    const enabled = parseQuotaQuery(quotaListQuerySchema, new URLSearchParams({ hasIncidences: "true" }));
    expect(enabled.hasIncidences).toBe(true);
  });

  it("rechaza paginación fuera de rango y rangos de años invertidos", () => {
    expect(() => parseQuotaQuery(quotaListQuerySchema, new URLSearchParams({ pageSize: "101" }))).toThrow();
    expect(() => parseQuotaQuery(quotaListQuerySchema, new URLSearchParams({ yearFrom: "2026", yearTo: "2020" }))).toThrow();
  });

  it("valida el tipo de exportación y sus filtros", () => {
    expect(parseQuotaQuery(quotaExportQuerySchema, new URLSearchParams())).toMatchObject({ type: "associates", concept: "CUOTA" });
    expect(() => parseQuotaQuery(quotaExportQuerySchema, new URLSearchParams({ type: "unknown" }))).toThrow();
    expect(parseQuotaQuery(quotaExportQuerySchema, new URLSearchParams({ type: "incidences", code: "INVALID_YEAR", status: "FAILED" }))).toMatchObject({
      type: "incidences",
      code: "INVALID_YEAR",
      status: "FAILED",
    });
  });
});
