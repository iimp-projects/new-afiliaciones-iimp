import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AssociatesApiConfigurationError } from "@/modules/afiliaciones/associates-integration/Config/AssociatesApiConfig";
import { AssociatesApiError } from "@/modules/afiliaciones/associates-integration/Clients/AssociatesApiError";

const TOKEN = "test-token-0123456789abcdef-0123456789abcdef";

const mocks = vi.hoisted(() => ({
  getIntegrationsV1AssociatesToken: vi.fn(() => TOKEN),
  consume: vi.fn(),
  retryAfterSeconds: vi.fn(),
  verify: vi.fn(),
}));

vi.mock("@/lib/config/env", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/config/env")>();
  return { ...actual, getIntegrationsV1AssociatesToken: mocks.getIntegrationsV1AssociatesToken };
});

vi.mock("@/modules/auth/rate-limit/VerificationTokenRateLimiter", () => ({
  verificationTokenRateLimiter: { consume: mocks.consume, retryAfterSeconds: mocks.retryAfterSeconds },
}));

vi.mock("@/modules/afiliaciones/institutional-verification/Services/AssociatesVerificationService", () => ({
  associatesVerificationService: { verify: mocks.verify },
}));

import { POST } from "./route";

function request(body: unknown, token?: string) {
  return new Request("http://localhost/api/integrations/v1/associates/verify", {
    method: "POST",
    headers: token ? { authorization: `Bearer ${token}`, "content-type": "application/json" } : { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

const validBody = { documentType: "DNI", documentNumber: "12345678" };

describe("POST /api/integrations/v1/associates/verify", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    mocks.getIntegrationsV1AssociatesToken.mockReturnValue(TOKEN);
    mocks.consume.mockResolvedValue(true);
    mocks.retryAfterSeconds.mockResolvedValue(null);
    mocks.verify.mockResolvedValue({
      verifiedAt: "2026-06-15T12:00:00.000Z",
      status: "ELIGIBLE",
      associate: true,
      membershipType: "ACTIVE",
      eligible: true,
      vigencia: "VIGENTE",
    });
  });
  afterEach(() => vi.restoreAllMocks());

  it("verifica un asociado vigente elegible con token válido", async () => {
    const response = await POST(request(validBody, TOKEN));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: {
        verifiedAt: "2026-06-15T12:00:00.000Z",
        status: "ELIGIBLE",
        associate: true,
        membershipType: "ACTIVE",
        eligible: true,
        vigencia: "VIGENTE",
      },
    });
    expect(mocks.verify).toHaveBeenCalledWith({ documentType: "DNI", documentNumber: "12345678" });
  });

  it("10. rechaza la ausencia de token con 401", async () => {
    const response = await POST(request(validBody));
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ success: false, code: "UNAUTHORIZED" });
    expect(mocks.verify).not.toHaveBeenCalled();
  });

  it("10. rechaza un token incorrecto con 401 sin filtrar el token", async () => {
    const response = await POST(request(validBody, "wrong-token"));
    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body).toMatchObject({ success: false, code: "UNAUTHORIZED" });
    expect(JSON.stringify(body)).not.toContain("wrong-token");
    expect(mocks.verify).not.toHaveBeenCalled();
  });

  it("11. devuelve 429 cuando se excede el rate limit", async () => {
    mocks.consume.mockResolvedValue(false);
    mocks.retryAfterSeconds.mockResolvedValue(42);
    const response = await POST(request(validBody, TOKEN));
    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("42");
    await expect(response.json()).resolves.toMatchObject({ success: false, code: "RATE_LIMIT_EXCEEDED" });
    expect(mocks.verify).not.toHaveBeenCalled();
  });

  it("12. rechaza un documento DNI malformado con 400", async () => {
    const response = await POST(request({ documentType: "DNI", documentNumber: "123" }, TOKEN));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ success: false, code: "INVALID_REQUEST" });
  });

  it("12. rechaza un tipo de documento no soportado con 400", async () => {
    const response = await POST(request({ documentType: "RUC", documentNumber: "20123456789" }, TOKEN));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ success: false, code: "INVALID_REQUEST" });
  });

  it("12. rechaza claves desconocidas (payload estricto) con 400", async () => {
    const response = await POST(request({ ...validBody, extra: "no permitido" }, TOKEN));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ success: false, code: "INVALID_REQUEST" });
  });

  it("12. rechaza un JSON inválido con 400", async () => {
    const response = await POST(request("{no-json", TOKEN));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ success: false, code: "INVALID_REQUEST" });
  });

  it("13. no filtra detalles internos de SIE en la respuesta de error", async () => {
    mocks.verify.mockRejectedValue(new AssociatesApiError("upstream secret detail", { httpStatus: 500, kind: "HTTP_5XX", retryable: true, operation: "GET_ASSOCIATE_STATE" }));
    const response = await POST(request(validBody, TOKEN));
    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body).toMatchObject({ success: false, code: "SIE_UNAVAILABLE" });
    expect(JSON.stringify(body)).not.toContain("upstream secret detail");
  });

  it("13. no registra el token completo en la respuesta de autenticación", async () => {
    const response = await POST(request(validBody, "another-wrong-token-abcdefghijklmnopqrstuvwxyz"));
    expect(response.status).toBe(401);
    const body = await response.json();
    expect(JSON.stringify(body)).not.toContain("another-wrong-token");
  });

  it("devuelve 503 cuando SIE no está configurada", async () => {
    mocks.verify.mockRejectedValue(new AssociatesApiConfigurationError("missing private variables"));
    const response = await POST(request(validBody, TOKEN));
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({ success: false, code: "SIE_UNAVAILABLE" });
  });

  it("devuelve 500 ante errores inesperados sin filtrar detalles", async () => {
    mocks.verify.mockRejectedValue(new Error("database internals"));
    const response = await POST(request(validBody, TOKEN));
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body).toMatchObject({ success: false, code: "INTERNAL_ERROR" });
    expect(JSON.stringify(body)).not.toContain("database internals");
  });
});
