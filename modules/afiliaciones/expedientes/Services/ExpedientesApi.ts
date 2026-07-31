import type { ExpedienteDTO } from "../Entities/ExpedienteDTO";

export class ExpedientesApi {
    async getSubmittedApplications(): Promise<ExpedienteDTO[]> {
        const response = await fetch("/api/afiliaciones/expedientes", {
            method: "GET",
            headers: { "Content-Type": "application/json" },
            cache: "no-store",
        });

        const result = await response.json();
        
        if (!response.ok || !result.success) {
            throw new Error(result.message || "Error al cargar expedientes.");
        }

        return result.data;
    }
}

export const expedientesApi = new ExpedientesApi();