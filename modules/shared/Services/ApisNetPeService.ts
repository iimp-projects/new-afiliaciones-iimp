interface ReniecResponse {
  nombres: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  numeroDocumento: string;
}

interface SunatResponse {
  razonSocial: string;
  numeroDocumento: string;
  estado: string;
  condicion: string;
  direccion: string;
  departamento: string;
  provincia: string;
  distrito: string;
}

export class ApisNetPeService {
  private readonly baseUrl = 'https://api.apis.net.pe/v2';
  // Coloca tu token aquí o idealmente en las variables de entorno (.env)
  private readonly token = process.env.APIS_NET_PE_TOKEN || 'apis-token-13383.Aph50ddFaV03b9sZaRprJo5ZBpMz0yC4';

  public async getDni(dni: string): Promise<ReniecResponse | null> {
    try {
      const response = await fetch(`${this.baseUrl}/reniec/dni?numero=${dni}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Accept': 'application/json',
        },
        next: { revalidate: 3600 } // Cache opcional de Next.js
      });

      if (!response.ok) return null;

      const data = await response.json();
      return data.numeroDocumento ? data : null;
    } catch (error) {
      console.error("[ApisNetPeService] Error buscando DNI:", error);
      return null;
    }
  }

  public async getRuc(ruc: string): Promise<SunatResponse | null> {
    try {
      const response = await fetch(`${this.baseUrl}/sunat/ruc/full?numero=${ruc}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Accept': 'application/json',
        },
        next: { revalidate: 3600 }
      });

      if (!response.ok) return null;

      const data = await response.json();
      return data.numeroDocumento ? data : null;
    } catch (error) {
      console.error("[ApisNetPeService] Error buscando RUC:", error);
      return null;
    }
  }
}