import type { NiubizTestConfig } from "../../Config/PaymentConfig";
import type {
  NiubizDataMap,
  NiubizSessionRequest,
  NiubizSessionResponse,
} from "../../DTOs/Niubiz/NiubizSession.dto";
import {
  captureSessionFailure,
  captureSessionRequest,
  captureSessionResponse,
  generateSessionCorrelationId,
} from "./NiubizSessionDiagnostics";

export interface BuildNiubizSessionInput {
  merchantId: string;
  securityToken: string;
  amount: number;
  clientIp?: string;
  merchantDefineData?: NiubizDataMap;
  dataMap?: NiubizDataMap;
}

export class NiubizSessionHttpError extends Error {
  readonly status: number;

  constructor(status: number) {
    super(`Niubiz Session respondió HTTP ${status}.`);
    this.status = status;
  }
}

export class NiubizSessionService {
  buildRequest(
    config: NiubizTestConfig,
    input: BuildNiubizSessionInput,
  ): NiubizSessionRequest {
    if (!config.sessionUrl) throw new Error("Falta NIUBIZ_SESSION_URL.");

    return {
      url: `${config.sessionUrl.replace(/\/$/, "")}/${encodeURIComponent(input.merchantId)}`,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: input.securityToken,
      },
      body: {
        amount: input.amount,
        channel: "web",
        antifraud: {
          ...(input.clientIp ? { clientIp: input.clientIp } : {}),
          ...(input.merchantDefineData
            ? { merchantDefineData: input.merchantDefineData }
            : {}),
        },
        ...(input.dataMap ? { dataMap: input.dataMap } : {}),
      },
    };
  }

  mapResponse(response: unknown): NiubizSessionResponse {
    if (
      !this.isRecord(response) ||
      typeof response.sessionKey !== "string" ||
      !response.sessionKey
    ) {
      throw new Error("La respuesta de sesión Niubiz no contiene sessionKey.");
    }

    return { sessionKey: response.sessionKey };
  }

  async createSession(
    config: NiubizTestConfig,
    input: BuildNiubizSessionInput,
  ): Promise<{
    session: NiubizSessionResponse;
    status: number;
    request: NiubizSessionRequest;
    responseBody: unknown;
    correlationId: string;
  }> {
    const request = this.buildRequest(config, input);
    const correlationId = generateSessionCorrelationId();
    captureSessionRequest(config, request, correlationId);

    const response = await fetch(request.url, {
      method: request.method,
      headers: request.headers,
      body: JSON.stringify(request.body),
      cache: "no-store",
    });

    if (!response.ok) {
      captureSessionFailure(config, correlationId, response.status);
      throw new NiubizSessionHttpError(response.status);
    }

    const body = await response.json();
    captureSessionResponse(config, correlationId, response.status, body);
    return {
      session: this.mapResponse(body),
      status: response.status,
      request,
      responseBody: body,
      correlationId,
    };
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
  }
}

