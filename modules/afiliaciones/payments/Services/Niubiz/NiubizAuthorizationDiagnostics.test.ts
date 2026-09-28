import { describe, expect, it, vi } from "vitest";
import { classifyNiubizYapeId, describeNiubizAuthorizationResponse, logNiubizAuthorizationStructure } from "./NiubizAuthorizationDiagnostics";
import { NiubizAuthorizationService } from "./NiubizAuthorizationService";

const response = {
  transactionToken: "transaction-token-secret",
  sessionToken: "session-token-secret",
  CARD: "4111111111111111",
  order: { amount: 300, purchaseNumber: "p-1", tokenId: "order-token-secret" },
  data: { BRAND: "visa", CARD: "4111111111111111", walletHint: "candidate-value" },
  dataMap: { CARD_TYPE: "D", authorization: "authorization-secret" },
  additionalData: { wallet: "yape", qr: true, nestedToken: "nested-token-secret" },
  arrayData: ["not-inspected"],
  nullable: null,
};

describe("Niubiz authorization structure diagnostic", () => {
  it("returns only field names and types, including unknown objects", () => {
    const result = describeNiubizAuthorizationResponse(response);

    expect(result).toEqual({
      topLevel: {
        CARD: "string", additionalData: "object", arrayData: "array", data: "object", dataMap: "object",
        nullable: "null", order: "object", sessionToken: "string", transactionToken: "string",
      },
      order: { amount: "number", purchaseNumber: "string", tokenId: "string" },
      data: { BRAND: "string", CARD: "string", walletHint: "string" },
      dataMap: { CARD_TYPE: "string", authorization: "string" },
      additionalObjects: { additionalData: { nestedToken: "string", qr: "boolean", wallet: "string" } },
    });
  });

  it("logs no values and is disabled outside PAYMENT_ENVIRONMENT=TEST", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);

    logNiubizAuthorizationStructure(response, "PRODUCTION");
    expect(info).not.toHaveBeenCalled();

    logNiubizAuthorizationStructure({ ...response, dataMap: { ...response.dataMap, YAPE_ID: "private-yape-id" } }, "TEST");
    expect(info).toHaveBeenCalledTimes(2);
    const serialized = JSON.stringify(info.mock.calls.map(([, diagnostic]) => diagnostic));
    for (const sensitiveValue of ["transaction-token-secret", "session-token-secret", "4111111111111111", "order-token-secret", "authorization-secret", "nested-token-secret", "candidate-value", "yape", "private-yape-id"]) {
      expect(serialized).not.toContain(sensitiveValue);
    }
    expect(serialized).not.toContain("not-inspected");
    info.mockRestore();
  });

  it.each([
    [{}, "ABSENT"],
    [{ dataMap: {} }, "ABSENT"],
    [{ dataMap: { YAPE_ID: null } }, "EMPTY"],
    [{ dataMap: { YAPE_ID: "   " } }, "EMPTY"],
    [{ dataMap: { YAPE_ID: "private-yape-id" } }, "PRESENT"],
  ] as const)("classifies YAPE_ID safely as %s", (authorization, expected) => {
    expect(classifyNiubizYapeId(authorization)).toBe(expected);
  });

  it("observes a valid Authorization response without changing it", async () => {
    vi.stubEnv("PAYMENT_ENVIRONMENT", "TEST");
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => response });
    vi.stubGlobal("fetch", fetchMock);

    const result = await new NiubizAuthorizationService().authorize({ authorizationUrl: "https://sandbox.example/authorization" }, {
      merchantId: "merchant", securityToken: "security-token", amount: 300, currency: "PEN", purchaseNumber: "1", tokenId: "checkout-token",
    });

    expect(result).toEqual({ response, status: 200 });
    const diagnostic = info.mock.calls.find(([event]) => event === "[NIUBIZ_AUTHORIZATION_STRUCTURE]");
    expect(diagnostic?.[1]).toEqual(describeNiubizAuthorizationResponse(response));
    const yapeDiagnostic = info.mock.calls.find(([event]) => event === "[NIUBIZ_YAPE_DIAGNOSTIC]");
    expect(yapeDiagnostic?.[1]).toEqual({ YAPE_ID_STATE: "ABSENT" });
    expect(JSON.stringify(diagnostic?.[1])).not.toContain("transaction-token-secret");

    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    info.mockRestore();
  });
});
