import type { SieAssociateState, SieAssociateStateRequest } from "@/modules/afiliaciones/associates-integration/Models/AssociateIntegration";
import { AssociatesApiError } from "@/modules/afiliaciones/associates-integration/Clients/AssociatesApiError";

export type QuotaStateSource = {
  getAssociateState(input: SieAssociateStateRequest): Promise<SieAssociateState>;
  getAssociateStateForQuotas?(input: SieAssociateStateRequest): Promise<SieAssociateState>;
};

export type QuotaSieErrorCode =
  | "SIE_AUTHENTICATION"
  | "SIE_FORBIDDEN"
  | "SIE_BAD_REQUEST"
  | "SIE_RATE_LIMITED"
  | "SIE_SERVER_ERROR"
  | "SIE_TIMEOUT"
  | "SIE_TRANSPORT"
  | "SIE_INVALID_RESPONSE"
  | "SIE_CIRCUIT_OPEN"
  | "SIE_UNKNOWN";

export type QuotaSieError = {
  code: QuotaSieErrorCode;
  httpStatus?: number;
  attempts: number;
  retryAfterMs?: number;
};

export type QuotaSieQueryResult =
  | { kind: "STATE"; state: SieAssociateState; attempts: number; retries: number }
  | { kind: "NOT_FOUND"; message: string; attempts: number; retries: number }
  | { kind: "FAILED"; error: QuotaSieError; attempts: number; retries: number };

export type QuotaSieClientOptions = {
  maxAttempts?: number;
  baseDelayMs?: number;
  random?: () => number;
  sleep?: (ms: number) => Promise<void>;
  circuitBreakerThreshold?: number;
  circuitBreakerCooldownMs?: number;
  clock?: () => number;
};

const MAX_RETRY_DELAY_MS = 60_000;

/**
 * Adaptador de solo lectura para cuotas. No modifica el flujo de afiliaciones:
 * envuelve GET /asociados/estado con reintentos acotados y errores sanitizados.
 */
export class QuotaSieClient {
  private readonly maxAttempts: number;
  private readonly baseDelayMs: number;
  private readonly random: () => number;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly circuitBreakerThreshold: number;
  private readonly circuitBreakerCooldownMs: number;
  private readonly clock: () => number;
  private consecutiveTransientFailures = 0;
  private circuitOpenUntil = 0;

  constructor(
    private readonly source: QuotaStateSource,
    options: QuotaSieClientOptions = {},
  ) {
    this.maxAttempts = Math.max(1, options.maxAttempts ?? 3);
    this.baseDelayMs = Math.max(0, options.baseDelayMs ?? 500);
    this.random = options.random ?? Math.random;
    this.sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
    this.circuitBreakerThreshold = Math.max(1, options.circuitBreakerThreshold ?? 5);
    this.circuitBreakerCooldownMs = Math.max(0, options.circuitBreakerCooldownMs ?? 30_000);
    this.clock = options.clock ?? Date.now;
  }

  async query(input: SieAssociateStateRequest): Promise<QuotaSieQueryResult> {
    if (this.clock() < this.circuitOpenUntil) {
      return { kind: "FAILED", error: { code: "SIE_CIRCUIT_OPEN", attempts: 0 }, attempts: 0, retries: 0 };
    }

    let lastError: QuotaSieError | null = null;

    for (let attempt = 1; attempt <= this.maxAttempts; attempt += 1) {
      try {
        const state = this.source.getAssociateStateForQuotas
          ? await this.source.getAssociateStateForQuotas(input)
          : await this.source.getAssociateState(input);
        assertValidState(state);
        this.consecutiveTransientFailures = 0;
        this.circuitOpenUntil = 0;
        if (state.status === false) {
          return { kind: "NOT_FOUND", message: state.message, attempts: attempt, retries: attempt - 1 };
        }
        return { kind: "STATE", state, attempts: attempt, retries: attempt - 1 };
      } catch (error) {
        if (!(error instanceof AssociatesApiError)) {
          lastError = { code: "SIE_UNKNOWN", attempts: attempt };
          break;
        }
        const classified = classify(error, attempt);
        lastError = classified;
        if (!isRetryable(error)) break;
        this.consecutiveTransientFailures += 1;
        if (this.consecutiveTransientFailures >= this.circuitBreakerThreshold) {
          this.circuitOpenUntil = this.clock() + this.circuitBreakerCooldownMs;
          lastError = { ...classified, code: "SIE_CIRCUIT_OPEN" };
          break;
        }
        if (attempt >= this.maxAttempts) break;
        const backoff = this.backoffMs(attempt, error.retryAfterMs);
        await this.sleep(backoff);
      }
    }

    const attempts = lastError?.attempts ?? this.maxAttempts;
    return {
      kind: "FAILED",
      error: lastError ?? { code: "SIE_UNKNOWN", attempts },
      attempts,
      retries: Math.max(0, attempts - 1),
    };
  }

  private backoffMs(attempt: number, retryAfterMs?: number): number {
    const exponential = this.baseDelayMs * 2 ** (attempt - 1);
    const jitter = exponential * (0.5 + this.random() * 0.5);
    return Math.min(MAX_RETRY_DELAY_MS, Math.max(jitter, retryAfterMs ?? 0));
  }
}

function isRetryable(error: AssociatesApiError): boolean {
  if (error.httpStatus === 429) return true;
  if (typeof error.httpStatus === "number" && error.httpStatus >= 500) return true;
  return error.kind === "TIMEOUT" || error.kind === "TRANSPORT_ERROR";
}

function classify(error: AssociatesApiError, attempt: number): QuotaSieError {
  const base = { httpStatus: error.httpStatus, attempts: attempt, retryAfterMs: error.retryAfterMs };
  if (error.httpStatus === 401) return { ...base, code: "SIE_AUTHENTICATION" };
  if (error.httpStatus === 403) return { ...base, code: "SIE_FORBIDDEN" };
  if (error.httpStatus === 400) return { ...base, code: "SIE_BAD_REQUEST" };
  if (error.httpStatus === 429) return { ...base, code: "SIE_RATE_LIMITED" };
  if (typeof error.httpStatus === "number" && error.httpStatus >= 500) return { ...base, code: "SIE_SERVER_ERROR" };
  if (error.kind === "TIMEOUT") return { ...base, code: "SIE_TIMEOUT" };
  if (error.kind === "INVALID_RESPONSE") return { ...base, code: "SIE_INVALID_RESPONSE" };
  if (error.kind === "TRANSPORT_ERROR") return { ...base, code: "SIE_TRANSPORT" };
  return { ...base, code: "SIE_UNKNOWN" };
}

function assertValidState(state: SieAssociateState): void {
  if (!state || typeof state.status !== "boolean") {
    throw new AssociatesApiError("Respuesta SIE inválida.", { retryable: false, operation: "GET_ASSOCIATE_STATE", kind: "INVALID_RESPONSE" });
  }
  if (state.status === true && !Array.isArray(state.cuotas)) {
    throw new AssociatesApiError("Respuesta SIE inválida.", { retryable: false, operation: "GET_ASSOCIATE_STATE", kind: "INVALID_RESPONSE" });
  }
  if (state.status === false && typeof state.message !== "string") {
    throw new AssociatesApiError("Respuesta SIE inválida.", { retryable: false, operation: "GET_ASSOCIATE_STATE", kind: "INVALID_RESPONSE" });
  }
}
