import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AssociatesApiConfigurationError } from "@/modules/afiliaciones/associates-integration/Config/AssociatesApiConfig";
import { AssociatesApiError } from "@/modules/afiliaciones/associates-integration/Clients/AssociatesApiError";

const mocks = vi.hoisted(() => {
  class ApiAuthorizationError extends Error {
    constructor(message: string, readonly status: 401 | 403) { super(message); }
  }
  class AssociateSieProfileError extends Error {
    constructor(message: string, readonly status: 404 | 422) { super(message); }
  }
  return { requireApiPermission: vi.fn(), getByApplicationId: vi.fn(), ApiAuthorizationError, AssociateSieProfileError };
});

vi.mock("@/modules/auth/context/api-authorization", () => ({ ApiAuthorizationError: mocks.ApiAuthorizationError, requireApiPermission: mocks.requireApiPermission }));
vi.mock("@/modules/afiliaciones/asociados/Services/AssociateSieProfileService", () => ({
  AssociateSieProfileError: mocks.AssociateSieProfileError,
  associateSieProfileService: { getByApplicationId: mocks.getByApplicationId },
}));

import { GET } from "./route";

const request = () => new Request("http://localhost/api/afiliaciones/asociados/12/sie");
const params = { params: Promise.resolve({ id: "12" }) };

describe("associate SIE state route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    mocks.requireApiPermission.mockResolvedValue(undefined);
    mocks.getByApplicationId.mockResolvedValue({ registered: false, checkedAt: "2026-02-01T10:00:00.000Z" });
  });
  afterEach(() => vi.restoreAllMocks());

  it("uses JSON authorization and returns the successful not-registered SIE response", async () => {
    const response = await GET(request(), params);
    expect(response.status).toBe(200);
    expect(mocks.requireApiPermission).toHaveBeenCalledWith("read", "memberships");
    expect(mocks.getByApplicationId).toHaveBeenCalledWith(12);
    await expect(response.json()).resolves.toEqual({ success: true, data: { registered: false, checkedAt: "2026-02-01T10:00:00.000Z" } });
  });

  it.each([[401, "UNAUTHENTICATED", "Sesión expirada."], [403, "FORBIDDEN_INTERNAL", "Sin permiso para consultar SIE."]] as const)("returns JSON %i for typed internal authorization", async (status, code, message) => {
    mocks.requireApiPermission.mockRejectedValue(new mocks.ApiAuthorizationError("ignored", status));
    const response = await GET(request(), params);
    expect(response.status).toBe(status);
    await expect(response.json()).resolves.toEqual({ success: false, code, message });
    expect(mocks.getByApplicationId).not.toHaveBeenCalled();
  });

  it("returns a safe 503 when SIE private configuration is unavailable", async () => {
    mocks.getByApplicationId.mockRejectedValue(new AssociatesApiConfigurationError("missing private variables"));
    const response = await GET(request(), params);
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ success: false, code: "SIE_CONFIGURATION_UNAVAILABLE", message: "La consulta SIE no está disponible en este momento." });
  });

  it.each([
    [401, "HTTP_401", 502],
    [403, "HTTP_403", 502],
    [undefined, "TIMEOUT", 503],
    [500, "HTTP_5XX", 503],
  ] as const)("maps SIE %s/%s without exposing upstream details", async (httpStatus, kind, expectedStatus) => {
    mocks.getByApplicationId.mockRejectedValue(new AssociatesApiError("upstream secret detail", { httpStatus, kind, retryable: true, operation: "GET_ASSOCIATE_STATE" }));
    const response = await GET(request(), params);
    expect(response.status).toBe(expectedStatus);
    const body = await response.json();
    expect(body).toMatchObject({ success: false, code: kind });
    expect(JSON.stringify(body)).not.toContain("upstream secret detail");
  });

  it("returns a safe 500 for unexpected application errors", async () => {
    mocks.getByApplicationId.mockRejectedValue(new Error("database internals"));
    const response = await GET(request(), params);
    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ success: false, code: "INTERNAL_ERROR", message: "No fue posible consultar SIE en este momento." });
  });
});
