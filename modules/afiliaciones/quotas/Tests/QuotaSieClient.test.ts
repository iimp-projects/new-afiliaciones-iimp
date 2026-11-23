import { describe, expect, it, vi } from "vitest";
import { AssociatesApiError } from "@/modules/afiliaciones/associates-integration/Clients/AssociatesApiError";
import type { SieAssociateState } from "@/modules/afiliaciones/associates-integration/Models/AssociateIntegration";
import { QuotaSieClient } from "../Services/QuotaSieClient";
import { quotaFixture } from "./quotaFixtures";

const request = { tipoDocumento: "1" as const, numDocumento: "00123456" };
const state: SieAssociateState = { status: true, cuotas: [quotaFixture()] };

describe("QuotaSieClient", () => {
  it("devuelve el estado validado", async () => {
    const source = { getAssociateState: vi.fn().mockResolvedValue(state) };
    const result = await new QuotaSieClient(source, { sleep: vi.fn() }).query(request);
    expect(result).toMatchObject({ kind: "STATE", state, attempts: 1, retries: 0 });
  });

  it("distingue NOT_FOUND de un fallo HTTP", async () => {
    const source = { getAssociateState: vi.fn().mockResolvedValue({ status: false, message: "No es asociado" }) };
    await expect(new QuotaSieClient(source).query(request)).resolves.toMatchObject({ kind: "NOT_FOUND", retries: 0 });
  });

  it("respeta Retry-After y reintenta 429", async () => {
    const source = {
      getAssociateState: vi.fn()
        .mockRejectedValueOnce(new AssociatesApiError("rate", { httpStatus: 429, retryable: false, operation: "GET_ASSOCIATE_STATE", retryAfterMs: 2_000 }))
        .mockResolvedValueOnce(state),
    };
    const sleep = vi.fn().mockResolvedValue(undefined);
    const result = await new QuotaSieClient(source, { sleep }).query(request);
    expect(result).toMatchObject({ kind: "STATE", attempts: 2, retries: 1 });
    expect(sleep).toHaveBeenCalledWith(2_000);
  });

  it("reintenta 5xx con backoff y luego falla sanitizado", async () => {
    const source = {
      getAssociateState: vi.fn().mockRejectedValue(new AssociatesApiError("boom", { httpStatus: 503, retryable: true, operation: "GET_ASSOCIATE_STATE" })),
    };
    const sleep = vi.fn().mockResolvedValue(undefined);
    const result = await new QuotaSieClient(source, { maxAttempts: 3, sleep, random: () => 0 }).query(request);
    expect(result).toMatchObject({ kind: "FAILED", error: { code: "SIE_SERVER_ERROR", attempts: 3 }, retries: 2 });
    expect(sleep).toHaveBeenCalledTimes(2);
  });

  it("no reintenta 401 porque el cliente ya reloguea una vez", async () => {
    const source = { getAssociateState: vi.fn().mockRejectedValue(new AssociatesApiError("auth", { httpStatus: 401, retryable: false, operation: "GET_ASSOCIATE_STATE" })) };
    const sleep = vi.fn();
    const result = await new QuotaSieClient(source, { sleep }).query(request);
    expect(result).toMatchObject({ kind: "FAILED", error: { code: "SIE_AUTHENTICATION" } });
    expect(sleep).not.toHaveBeenCalled();
  });

  it("abre el circuit breaker tras fallos transitorios consecutivos", async () => {
    let now = 0;
    const source = {
      getAssociateState: vi.fn()
        .mockRejectedValueOnce(new AssociatesApiError("boom", { httpStatus: 503, retryable: true, operation: "GET_ASSOCIATE_STATE" }))
        .mockRejectedValueOnce(new AssociatesApiError("boom", { httpStatus: 503, retryable: true, operation: "GET_ASSOCIATE_STATE" }))
        .mockResolvedValueOnce(state),
    };
    const client = new QuotaSieClient(source, {
      maxAttempts: 3,
      sleep: vi.fn().mockResolvedValue(undefined),
      circuitBreakerThreshold: 2,
      circuitBreakerCooldownMs: 30_000,
      clock: () => now,
    });
    await expect(client.query(request)).resolves.toMatchObject({ kind: "FAILED", error: { code: "SIE_CIRCUIT_OPEN" } });
    await expect(client.query(request)).resolves.toMatchObject({ kind: "FAILED", error: { code: "SIE_CIRCUIT_OPEN" }, attempts: 0 });
    expect(source.getAssociateState).toHaveBeenCalledTimes(2);
    now = 30_001;
    await expect(client.query(request)).resolves.toMatchObject({ kind: "STATE" });
  });

  it("clasifica timeout y respuesta inválida", async () => {
    const timeout = { getAssociateState: vi.fn().mockRejectedValue(new AssociatesApiError("timeout", { retryable: true, operation: "GET_ASSOCIATE_STATE", kind: "TIMEOUT" })) };
    await expect(new QuotaSieClient(timeout, { maxAttempts: 1 }).query(request)).resolves.toMatchObject({ kind: "FAILED", error: { code: "SIE_TIMEOUT" } });

    const invalid = { getAssociateState: vi.fn().mockResolvedValue({ status: true }) };
    await expect(new QuotaSieClient(invalid).query(request)).resolves.toMatchObject({ kind: "FAILED", error: { code: "SIE_INVALID_RESPONSE" } });
  });
});
