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
    });
  });
});
