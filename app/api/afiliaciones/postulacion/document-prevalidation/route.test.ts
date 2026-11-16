import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import jwt from "jsonwebtoken";

const mocks = vi.hoisted(() => ({
  execute: vi.fn(),
  getInternalApiUser: vi.fn(),
  hasPermission: vi.fn(),
}));

vi.mock("@/modules/auth/context/api-authorization", () => ({
  getInternalApiUser: mocks.getInternalApiUser,
}));
vi.mock("@/modules/auth/context/service", () => ({
  contextService: { hasPermission: mocks.hasPermission },
}));
vi.mock(
  "@/modules/afiliaciones/document-validation/Services/DocumentPrevalidationService",
  async (importOriginal) => {
    const actual = await importOriginal<typeof import("@/modules/afiliaciones/document-validation/Services/DocumentPrevalidationService")>();
    return {
      ...actual,
      DocumentPrevalidationService: class {
        public constructor(_config: unknown) {}
        public execute = mocks.execute;
      },
    };
  },
);

import { GET, POST } from "./route";
import { QUERY_COOKIE, queryAuthorization } from "@/modules/afiliaciones/consulta/Services/QueryAuthorizationService";
import { AcademicDocumentFileError } from "@/modules/afiliaciones/document-validation/Validators/AcademicDocumentFileValidator";
import { DocumentPrevalidationServiceError } from "@/modules/afiliaciones/document-validation/Services/DocumentPrevalidationService";
import { documentPrevalidationRateLimiter } from "@/modules/afiliaciones/document-validation/Services/InMemoryRateLimiter";

const AUTH_SECRET = "test-only-document-prevalidation-secret";

function request(options: { token?: string; applicationId?: string } = {}) {
  const formData = new FormData();
  formData.append("file", new File([Buffer.from("%PDF-1.7 x")], "constancia.pdf", { type: "application/pdf" }));
  if (options.applicationId !== undefined) formData.append("applicationId", options.applicationId);
  return new NextRequest("http://localhost/api/afiliaciones/postulacion/document-prevalidation", {
    method: "POST",
    body: formData,
    headers: options.token ? { cookie: `${QUERY_COOKIE}=${options.token}` } : {},
  });
}

function successResult() {
  return {
    status: "PREVALIDATED",
    message: "ok",
    result: "PREVALIDATED",
    rules: [],
    warnings: [],
    extraction: null,
    file: { url: "https://s3.example/a.pdf", name: "constancia.pdf", type: "application/pdf", sizeBytes: 10 },
    analyzedAt: "2026-11-16T12:00:00.000Z",
    durationMs: 10,
    cacheHit: false,
  };
}

describe("document prevalidation route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("AUTH_SECRET", AUTH_SECRET);
    vi.stubEnv("DOCUMENT_AI_VALIDATION_ENABLED", "true");
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    vi.stubEnv("DOCUMENT_AI_MODEL", "gemini-3.5-flash");
    documentPrevalidationRateLimiter.reset();
    mocks.execute.mockResolvedValue(successResult());
    mocks.getInternalApiUser.mockResolvedValue(null);
    mocks.hasPermission.mockResolvedValue(false);
  });

  it("expone el feature flag sin datos sensibles", async () => {
    const enabled = await GET();
    expect(await enabled.json()).toEqual({ success: true, data: { enabled: true } });
    vi.stubEnv("DOCUMENT_AI_VALIDATION_ENABLED", "false");
    const disabled = await GET();
    expect(await disabled.json()).toEqual({ success: true, data: { enabled: false } });
  });

  it("no ejecuta Gemini cuando el flag está desactivado", async () => {
    vi.stubEnv("DOCUMENT_AI_VALIDATION_ENABLED", "false");
    const response = await POST(request());
    expect(response.status).toBe(404);
    expect(mocks.execute).not.toHaveBeenCalled();
  });

  it("rechaza sin cookie ni usuario interno", async () => {
    const response = await POST(request());
    expect(response.status).toBe(401);
    expect(mocks.execute).not.toHaveBeenCalled();
  });

  it("rechaza un token expirado con código de acceso", async () => {
    const expired = jwt.sign(
      { applicationId: 7, applicationIds: [7], purpose: "QUERY_ACCESS" },
      AUTH_SECRET,
      { algorithm: "HS256", expiresIn: "-1s", audience: "iimp-consulta" },
    );
    const response = await POST(request({ token: expired }));
    expect(response.status).toBe(401);
    expect((await response.json()).code).toBe("APPLICATION_ACCESS_EXPIRED");
    expect(mocks.execute).not.toHaveBeenCalled();
  });

  it("TEST-21: ignora un applicationId de otro expediente enviado por el navegador", async () => {
    const token = queryAuthorization.createAccess([7], 7);
    const response = await POST(request({ token, applicationId: "999" }));

    expect(response.status).toBe(200);
    expect(mocks.execute).toHaveBeenCalledWith(expect.objectContaining({ applicationId: 7 }));
    const renewed = response.cookies.get(QUERY_COOKIE);
    expect(queryAuthorization.allowedIds(renewed?.value)).toEqual([7]);
  });

  it("permite a un usuario interno con permiso de escritura analizar un expediente", async () => {
    mocks.getInternalApiUser.mockResolvedValue({ id: 1 });
    mocks.hasPermission.mockImplementation(async (action: string, subject: string) => action === "update" && subject === "applications");

    const response = await POST(request({ applicationId: "42" }));
    expect(response.status).toBe(200);
    expect(mocks.execute).toHaveBeenCalledWith(expect.objectContaining({ applicationId: 42 }));
  });

  it("no permite a un usuario interno de solo lectura elegir expediente", async () => {
    mocks.getInternalApiUser.mockResolvedValue({ id: 1 });
    mocks.hasPermission.mockImplementation(async (action: string, subject: string) => action === "read" && subject === "applications");
    const response = await POST(request({ applicationId: "42" }));
    expect(response.status).toBe(401);
    expect(mocks.execute).not.toHaveBeenCalled();
  });

  it("aplica rate limiting por expediente", async () => {
    const token = queryAuthorization.createAccess([7], 7);
    for (let index = 0; index < 10; index += 1) {
      const response = await POST(request({ token }));
      expect(response.status).toBe(200);
    }
    const limited = await POST(request({ token }));
    expect(limited.status).toBe(429);
    expect(limited.headers.get("Retry-After")).toBeTruthy();
  });

  it("mapea errores de archivo a estados HTTP útiles", async () => {
    const token = queryAuthorization.createAccess([7], 7);
    mocks.execute.mockRejectedValue(new AcademicDocumentFileError("TOO_MANY_PAGES", "muchas páginas"));
    const response = await POST(request({ token }));
    expect(response.status).toBe(422);
    expect((await response.json()).code).toBe("TOO_MANY_PAGES");
  });

  it("mapea errores de dominio sin exponer detalles internos", async () => {
    const token = queryAuthorization.createAccess([7], 7);
    mocks.execute.mockRejectedValue(
      new DocumentPrevalidationServiceError("NOT_STUDENT", "La prevalidación solo aplica a Asociado Estudiante.", 409),
    );
    const response = await POST(request({ token }));
    expect(response.status).toBe(409);
    expect((await response.json()).code).toBe("NOT_STUDENT");
  });

  it("devuelve TECHNICAL_ERROR como resultado de negocio, no como error HTTP", async () => {
    const token = queryAuthorization.createAccess([7], 7);
    mocks.execute.mockResolvedValue({
      ...successResult(),
      status: "TECHNICAL_ERROR",
      result: null,
      message: "No fue posible completar la revisión automática en este momento.",
    });
    const response = await POST(request({ token }));
    expect(response.status).toBe(200);
    expect((await response.json()).data.status).toBe("TECHNICAL_ERROR");
  });
});
