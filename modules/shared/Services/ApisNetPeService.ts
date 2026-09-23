import { getApisNetPeToken } from "@/lib/config/env";

interface ReniecResponse { nombres: string; apellidoPaterno: string; apellidoMaterno: string; numeroDocumento: string; }

export interface SunatResponse { razonSocial: string; numeroDocumento: string; estado: string; condicion: string; direccion: string; departamento: string; provincia: string; distrito: string; }

export type RucLookupResult =
  | { status: "VERIFIED"; data: SunatResponse }
  | { status: "NOT_FOUND" }
  | { status: "SERVICE_ERROR" };

export class ApisNetPeService {
  private readonly baseUrl = "https://api.apis.net.pe/v2";

  public async getDni(dni: string): Promise<ReniecResponse | null> {
    const token = this.getToken();

    try {
      const response = await fetch(`${this.baseUrl}/reniec/dni?numero=${dni}`, { method: "GET", headers: { Authorization: `Bearer ${token}`, Accept: "application/json" }, next: { revalidate: 3600 } });
      if (!response.ok) return null;
      const data = await response.json();
      return data.numeroDocumento ? data : null;
    } catch (error) {
      console.error("[ApisNetPeService] Error buscando DNI:", error);
      return null;
    }
  }

  public async getRuc(ruc: string): Promise<RucLookupResult> {
    const token = this.getToken();

    try {
      const response = await fetch(`${this.baseUrl}/sunat/ruc/full?numero=${ruc}`, { method: "GET", headers: { Authorization: `Bearer ${token}`, Accept: "application/json" }, next: { revalidate: 3600 } });
      if (response.status === 404) return { status: "NOT_FOUND" };
      if (!response.ok) return { status: "SERVICE_ERROR" };
      const data = await response.json();
      return data.numeroDocumento ? { status: "VERIFIED", data } : { status: "NOT_FOUND" };
    } catch (error) {
      console.error("[ApisNetPeService] Error buscando RUC:", error);
      return { status: "SERVICE_ERROR" };
    }
  }

  private getToken(): string {
    try {
      return getApisNetPeToken();
    } catch {
      throw new Error("Falta configurar APIS_NET_PE_TOKEN.");
    }
  }
}
