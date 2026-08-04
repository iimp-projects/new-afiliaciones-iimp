import type { SmartCaseCardData } from "@/modules/shared/Components/SmartCaseCard/types";

export interface PaginatedExpedientesResponse {
  success: boolean;
  items: SmartCaseCardData[];
  meta: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
}

export class ExpedientesApi {
  async getWorkspaceCases(queryString: string): Promise<PaginatedExpedientesResponse> {
    const response = await fetch(`/api/afiliaciones/expedientes?${queryString}`, {
      method: "GET",
      cache: "no-store", // Evitamos caché para traer la data en tiempo real
    });

    if (!response.ok) throw new Error("Error al obtener expedientes");
    return response.json();
  }
}

export const expedientesApi = new ExpedientesApi();