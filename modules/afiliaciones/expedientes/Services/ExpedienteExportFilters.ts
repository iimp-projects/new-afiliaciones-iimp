import type { ExpedienteFilters } from "../Repositories/ExpedienteRepository";

export type ExpedienteExportFilters = Omit<ExpedienteFilters, "page" | "pageSize">;

/**
 * Normaliza los filtros de la bandeja de expedientes para cualquier exportación
 * (Excel o ZIP de documentos). Listado, Excel y ZIP comparten así el mismo
 * contrato de filtros.
 */
export function parseExpedienteExportFilters(
  searchParams: URLSearchParams,
): ExpedienteExportFilters {
  const read = (key: string) => searchParams.get(key) || undefined;

  return {
    search: read("search"),
    status: read("status"),
    modality: read("modality"),
    logisticValidation: read("logisticValidation"),
    associateValidation: read("associateValidation"),
    comiteValidation: read("comiteValidation"),
    legalValidation: read("legalValidation"),
    comunicacionesValidation: read("comunicacionesValidation"),
    paymentStatus: read("paymentStatus"),
    assignedTo: read("assignedTo"),
    orderBy: read("orderBy"),
    dateFrom: read("dateFrom"),
    dateTo: read("dateTo"),
  };
}
