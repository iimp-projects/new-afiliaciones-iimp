import type { NiubizTestConfig } from "../../Config/PaymentConfig";
import type { NiubizAuthorizationRequest, NiubizAuthorizationResponse } from "../../DTOs/Niubiz/NiubizAuthorization.dto";
import type { NiubizDataMap } from "../../DTOs/Niubiz/NiubizSession.dto";

export interface BuildNiubizAuthorizationInput {
  merchantId: string;
  securityToken: string;
  amount: number;
  currency: "PEN";
  purchaseNumber: string;
  tokenId: string;
  captureType?: string;
  countable?: boolean;
  dataMap?: NiubizDataMap;
}

export class NiubizAuthorizationService {
  buildRequest(config: NiubizTestConfig, input: BuildNiubizAuthorizationInput): NiubizAuthorizationRequest {
    if (!config.authorizationUrl) throw new Error("Falta NIUBIZ_AUTHORIZATION_URL.");

    return {
      url: `${config.authorizationUrl.replace(/\/$/, "")}/${encodeURIComponent(input.merchantId)}`,
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: input.securityToken },
      body: {
        ...(input.captureType ? { captureType: input.captureType } : {}),
        channel: "web",
        ...(input.countable === undefined ? {} : { countable: input.countable }),
        order: {
          amount: input.amount,
          tokenId: input.tokenId,
          purchaseNumber: input.purchaseNumber,
          currency: input.currency,
        },
        ...(input.dataMap ? { dataMap: input.dataMap } : {}),
      },
    };
  }

  async authorize(config: NiubizTestConfig, input: BuildNiubizAuthorizationInput): Promise<{ response: NiubizAuthorizationResponse; status: number }> {
    const request = this.buildRequest(config, input);
    console.info("[NIUBIZ_AUTHORIZATION] Solicitud preparada.", {
      merchantId: input.merchantId,
      purchaseNumber: input.purchaseNumber,
      amount: input.amount,
      currency: input.currency,
      tokenIdPresent: Boolean(input.tokenId),
      tokenIdLength: input.tokenId.length,
    });
    let response: Response;

    try {
      response = await fetch(request.url, {
        method: request.method,
        headers: request.headers,
        body: JSON.stringify(request.body),
        cache: "no-store",
        signal: AbortSignal.timeout(20_000),
      });
    } catch (error) {
      throw new NiubizAuthorizationNetworkError(error instanceof Error ? error.message : "No se pudo contactar Authorization de Niubiz.");
    }

    const body = await response.json().catch(() => null);
    if (!this.isRecord(body)) throw new NiubizAuthorizationHttpError(response.status);
    if (!response.ok) throw new NiubizAuthorizationHttpError(response.status, body as NiubizAuthorizationResponse);

    return { response: body as NiubizAuthorizationResponse, status: response.status };
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
  }
}

export class NiubizAuthorizationHttpError extends Error {
  constructor(readonly status: number, readonly response?: NiubizAuthorizationResponse) {
    super(`Niubiz Authorization respondiÃ³ HTTP ${status}.`);
  }
}

export class NiubizAuthorizationNetworkError extends Error {}
