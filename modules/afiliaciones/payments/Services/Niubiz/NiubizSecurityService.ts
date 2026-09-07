import type { NiubizTestConfig } from "../../Config/PaymentConfig";
import type { NiubizSecurityRequest } from "../../DTOs/Niubiz/NiubizSecurity.dto";

export class NiubizSecurityHttpError extends Error {
  readonly status: number;

  constructor(status: number) {
    super(`Niubiz Security respondió HTTP ${status}.`);
    this.status = status;
  }
}

export class NiubizSecurityService {
  buildRequest(config: NiubizTestConfig): NiubizSecurityRequest {
    if (!config.securityUrl || !config.username || !config.password) {
      throw new Error("Falta la configuración requerida para Security de Niubiz TEST.");
    }

    const credentials = Buffer.from(`${config.username}:${config.password}`, "utf8").toString("base64");
    return {
      url: config.securityUrl,
      method: "GET",
      headers: { Authorization: `Basic ${credentials}` },
    };
  }

  async getAccessToken(config: NiubizTestConfig): Promise<{ accessToken: string; status: number }> {
    const request = this.buildRequest(config);
    const response = await fetch(request.url, {
      method: request.method,
      headers: request.headers,
      cache: "no-store",
    });

    if (!response.ok) throw new NiubizSecurityHttpError(response.status);

    const accessToken = (await response.text()).trim();
    if (!accessToken) throw new Error("Niubiz Security respondió sin Access Token.");

    return { accessToken, status: response.status };
  }
}
