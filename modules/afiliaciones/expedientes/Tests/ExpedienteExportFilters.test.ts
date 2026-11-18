import { describe, expect, it } from "vitest";
import { parseExpedienteExportFilters } from "../Services/ExpedienteExportFilters";

describe("parseExpedienteExportFilters", () => {
  it("conserva todos los filtros del listado para Excel y ZIP", () => {
    const filters = parseExpedienteExportFilters(
      new URLSearchParams({
        search: "perez",
        status: "OBSERVED",
        modality: "ACTIVE",
        logisticValidation: "APPROVED",
        associateValidation: "RESOLVED",
        comiteValidation: "PENDING",
        legalValidation: "OBSERVED",
        comunicacionesValidation: "APPROVED",
        paymentStatus: "PAID",
        assignedTo: "ASOCIADOS",
        orderBy: "Más antiguos",
        dateFrom: "2026-01-01",
        dateTo: "2026-01-31",
        gender: "FEMALE",
        countryId: "12",
        universityId: "34",
        company: "ACME SAC",
        evaluatorId: "78",
        endorsementStatus: "APPROVED",
      }),
    );

    expect(filters).toEqual({
      search: "perez",
      status: "OBSERVED",
      modality: "ACTIVE",
      logisticValidation: "APPROVED",
      associateValidation: "RESOLVED",
      comiteValidation: "PENDING",
      legalValidation: "OBSERVED",
      comunicacionesValidation: "APPROVED",
      paymentStatus: "PAID",
      assignedTo: "ASOCIADOS",
      orderBy: "Más antiguos",
      dateFrom: "2026-01-01",
      dateTo: "2026-01-31",
      gender: "FEMALE",
      countryId: 12,
      universityId: 34,
      company: "ACME SAC",
      evaluatorId: 78,
      endorsementStatus: "APPROVED",
    });
  });

  it("descarta identificadores numéricos inválidos", () => {
    const filters = parseExpedienteExportFilters(
      new URLSearchParams({ countryId: "abc", universityId: "0", evaluatorId: "-3" }),
    );

    expect(filters.countryId).toBeUndefined();
    expect(filters.universityId).toBeUndefined();
    expect(filters.evaluatorId).toBeUndefined();
  });
});
