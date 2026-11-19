import { describe, expect, it } from "vitest";
import { serializeFilters } from "../Components/QuotasFilterBar";

describe("QuotasFilterBar filter serialization", () => {
  it("ignora conceptos vacíos para evitar reaplicaciones en el histórico", () => {
    expect(serializeFilters({ concept: "" })).toBe(serializeFilters({}));
    expect(serializeFilters({ concept: "", sort: "name" })).toBe(serializeFilters({ sort: "name" }));
  });

  it("no depende del orden de las claves", () => {
    expect(serializeFilters({ concept: "CUOTA", sort: "name" })).toBe(serializeFilters({ sort: "name", concept: "CUOTA" }));
  });

  it("detecta cambios reales de filtros", () => {
    expect(serializeFilters({ concept: "CUOTA" })).not.toBe(serializeFilters({ concept: "INSCRIPCION" }));
    expect(serializeFilters({ search: "671" })).not.toBe(serializeFilters({}));
  });
});
