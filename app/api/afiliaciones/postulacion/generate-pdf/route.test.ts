import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import jwt from "jsonwebtoken";

const mocks = vi.hoisted(() => ({
  getInternalApiUser: vi.fn(),
  hasPermission: vi.fn(),
  consume: vi.fn(),
  retryAfterSeconds: vi.fn(),
  generate: vi.fn(),
}));

vi.mock("@/modules/auth/context/api-authorization", () => ({
  getInternalApiUser: mocks.getInternalApiUser,
}));
vi.mock("@/modules/auth/context/service", () => ({
  contextService: { hasPermission: mocks.hasPermission },
}));
vi.mock("@/modules/auth/rate-limit/VerificationTokenRateLimiter", () => ({
  verificationTokenRateLimiter: { consume: mocks.consume, retryAfterSeconds: mocks.retryAfterSeconds },
}));
vi.mock("@/modules/afiliaciones/postulacion/Services/DeclarationPdfService", () => ({
  DeclarationPdfService: class { generate = mocks.generate; },
}));

import { POST } from "./route";
import { QUERY_COOKIE, queryAuthorization } from "@/modules/afiliaciones/consulta/Services/QueryAuthorizationService";

function pdfRequest(options: { token?: string; body?: Record<string, unknown> } = {}) {
  return new NextRequest("http://localhost/api/afiliaciones/postulacion/generate-pdf", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(options.token ? { cookie: `${QUERY_COOKIE}=${options.token}` } : {}),
    },
    body: JSON.stringify(options.body ?? { draft: { membershipType: "ACTIVE" } }),
  });
}

describe("POST /api/afiliaciones/postulacion/generate-pdf authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("AUTH_SECRET", "test-only-pdf-secret");
    mocks.getInternalApiUser.mockResolvedValue(null);
    mocks.hasPermission.mockResolvedValue(false);
    mocks.consume.mockResolvedValue(true);
    mocks.retryAfterSeconds.mockResolvedValue(null);
    mocks.generate.mockResolvedValue(new Uint8Array([1, 2, 3]));
  });

  it("autoriza al postulante con QUERY_COOKIE válido (caso 1)", async () => {
    const token = queryAuthorization.createAccess([7], 7);
    const response = await POST(pdfRequest({ token }));

    expect(response.status).toBe(200);
    expect(mocks.generate).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ allowedApplicationIds: [7] }),
    );
  });

  it("permite a un usuario interno autorizado generar con applicationId (caso 2)", async () => {
    mocks.getInternalApiUser.mockResolvedValue({ id: 1 });
    mocks.hasPermission.mockImplementation(async (action: string, subject: string) => action === "read" && subject === "memberships");

    const response = await POST(pdfRequest({ body: { draft: { membershipType: "ACTIVE" }, applicationId: 42 } }));

    expect(response.status).toBe(200);
    expect(mocks.generate).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ allowedApplicationIds: [42] }),
    );
  });

  it("no produce allowedApplicationIds vacío para interno sin body.applicationId (caso 3)", async () => {
    mocks.getInternalApiUser.mockResolvedValue({ id: 1 });
    mocks.hasPermission.mockImplementation(async (action: string, subject: string) => action === "read" && subject === "memberships");
    const token = queryAuthorization.createAccess([7], 7);

    const response = await POST(pdfRequest({ token, body: { draft: { membershipType: "ACTIVE" } } }));

    expect(response.status).toBe(200);
    expect(mocks.generate).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ allowedApplicationIds: [7] }),
    );
  });

  it("ignora un applicationId manipulado enviado por un postulante (caso 4)", async () => {
    const token = queryAuthorization.createAccess([7], 7);

    const response = await POST(pdfRequest({ token, body: { draft: { membershipType: "ACTIVE" }, applicationId: 999 } }));

    expect(response.status).toBe(200);
    expect(mocks.generate).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ allowedApplicationIds: [7] }),
    );
  });

  it("deniega sin QUERY_COOKIE válido ni autorización interna (caso 5)", async () => {
    const response = await POST(pdfRequest());

    expect(response.status).toBe(401);
    expect(mocks.generate).not.toHaveBeenCalled();
  });

  it("deniega con QUERY_COOKIE inválido", async () => {
    const response = await POST(pdfRequest({ token: "no-es-un-jwt" }));

    expect(response.status).toBe(401);
    expect(mocks.generate).not.toHaveBeenCalled();
  });

  it("rechaza 401 APPLICATION_ACCESS_EXPIRED sin llegar al motor PDF", async () => {
    const expired = jwt.sign(
      { applicationId: 7, applicationIds: [7], purpose: "QUERY_ACCESS" },
      "test-only-pdf-secret",
      { algorithm: "HS256", expiresIn: -60, audience: "iimp-consulta" },
    );
    const response = await POST(pdfRequest({ token: expired }));

    expect(response.status).toBe(401);
    expect((await response.json()).code).toBe("APPLICATION_ACCESS_EXPIRED");
    expect(mocks.generate).not.toHaveBeenCalled();
  });

  it("devuelve 429 con Retry-After cuando el rate limit se supera", async () => {
    mocks.consume.mockResolvedValue(false);
    mocks.retryAfterSeconds.mockResolvedValue(65);
    const token = queryAuthorization.createAccess([7], 7);

    const response = await POST(pdfRequest({ token }));

    expect(response.status).toBe(429);
    expect((await response.json()).code).toBe("PDF_GENERATION_RATE_LIMITED");
    expect(response.headers.get("Retry-After")).toBe("65");
    expect(mocks.generate).not.toHaveBeenCalled();
  });

  it("renueva la cookie de acceso tras una generación autorizada", async () => {
    const token = queryAuthorization.createAccess([7], 7);
    const response = await POST(pdfRequest({ token }));

    expect(response.status).toBe(200);
    const renewed = response.cookies.get(QUERY_COOKIE);
    expect(renewed?.value).toBeTruthy();
    expect(queryAuthorization.allowedIds(renewed?.value)).toEqual([7]);
  });
});
