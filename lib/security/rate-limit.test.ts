import { describe, expect, it } from "vitest";
import { consumeRateLimit, resetRateLimitsForTests } from "./rate-limit";

describe("consumeRateLimit", () => {
  it("bloquea al superar el límite dentro de la ventana", () => {
    resetRateLimitsForTests();
    expect(consumeRateLimit("k", 2, 1000, 0).allowed).toBe(true);
    expect(consumeRateLimit("k", 2, 1000, 100).allowed).toBe(true);
    const blocked = consumeRateLimit("k", 2, 1000, 200);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("reinicia al vencer la ventana", () => {
    resetRateLimitsForTests();
    consumeRateLimit("k", 1, 1000, 0);
    expect(consumeRateLimit("k", 1, 1000, 999).allowed).toBe(false);
    expect(consumeRateLimit("k", 1, 1000, 1000).allowed).toBe(true);
  });

  it("aísla claves distintas", () => {
    resetRateLimitsForTests();
    expect(consumeRateLimit("a", 1, 1000, 0).allowed).toBe(true);
    expect(consumeRateLimit("b", 1, 1000, 0).allowed).toBe(true);
  });
});
