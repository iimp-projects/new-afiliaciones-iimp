import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import jwt from "jsonwebtoken";

const mocks = vi.hoisted(() => ({
  uploadFile: vi.fn(),
  getInternalApiUser: vi.fn(),
  hasPermission: vi.fn(),
}));

vi.mock("@/modules/shared/Services/S3StorageService", () => ({
  S3StorageService: class { uploadFile = mocks.uploadFile; },
}));
vi.mock("@/modules/auth/context/api-authorization", () => ({
  getInternalApiUser: mocks.getInternalApiUser,
}));
vi.mock("@/modules/auth/context/service", () => ({
  contextService: { hasPermission: mocks.hasPermission },
}));

import { POST } from "./route";
import { QUERY_COOKIE, queryAuthorization } from "@/modules/afiliaciones/consulta/Services/QueryAuthorizationService";

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);

function uploadRequest(options: { token?: string; folder?: string; applicationId?: string } = {}) {
  const formData = new FormData();
  formData.append("file", new File([PNG], "foto.png", { type: "image/png" }));
  formData.append("folder", options.folder ?? "afiliaciones/fotos");
  if (options.applicationId !== undefined) formData.append("applicationId", options.applicationId);
  return new NextRequest("http://localhost/api/afiliaciones/postulacion/upload", {
    method: "POST",
    body: formData,
    headers: options.token ? { cookie: `${QUERY_COOKIE}=${options.token}` } : {},
  });
}

describe("POST /api/afiliaciones/postulacion/upload authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("AUTH_SECRET", "test-only-upload-secret");
    mocks.uploadFile.mockResolvedValue("https://s3.example/object");
    mocks.getInternalApiUser.mockResolvedValue(null);
    mocks.hasPermission.mockResolvedValue(false);
  });

  it("rechaza 401 sin cookie ni usuario interno y no invoca S3", async () => {
    const response = await POST(uploadRequest());
    expect(response.status).toBe(401);
    expect((await response.json()).message).toBe("Verifica tu identidad para subir archivos.");
    expect(mocks.uploadFile).not.toHaveBeenCalled();
  });

  it("rechaza 401 con token inválido y no invoca S3", async () => {
    const response = await POST(uploadRequest({ token: "no-es-un-jwt" }));
    expect(response.status).toBe(401);
    expect(mocks.uploadFile).not.toHaveBeenCalled();
  });

  it("rechaza 401 con token expirado y no invoca S3", async () => {
    const expired = jwt.sign(
      { applicationId: 7, applicationIds: [7], purpose: "QUERY_ACCESS" },
      "test-only-upload-secret",
      { algorithm: "HS256", expiresIn: "-1s", audience: "iimp-consulta" },
    );
    const response = await POST(uploadRequest({ token: expired }));
    expect(response.status).toBe(401);
    expect(mocks.uploadFile).not.toHaveBeenCalled();
  });

  it("rechaza 401 un challenge de verificación (no es token de acceso)", async () => {
    const challenge = queryAuthorization.create(7, "QUERY_CHALLENGE");
    const response = await POST(uploadRequest({ token: challenge }));
    expect(response.status).toBe(401);
    expect(mocks.uploadFile).not.toHaveBeenCalled();
  });

  it("autoriza al postulante con cookie válida y guarda bajo su applicationId", async () => {
    const token = queryAuthorization.createAccess([7], 7);
    const response = await POST(uploadRequest({ token }));
    expect(response.status).toBe(200);
    expect(mocks.uploadFile).toHaveBeenCalledTimes(1);
    expect(mocks.uploadFile).toHaveBeenCalledWith(PNG, "foto.png", "image/png", "afiliaciones/applications/7/photos");
  });

  it("rechaza 400 un destino no permitido sin invocar S3", async () => {
    const token = queryAuthorization.createAccess([7], 7);
    const response = await POST(uploadRequest({ token, folder: "afiliaciones/temporal" }));
    expect(response.status).toBe(400);
    expect(mocks.uploadFile).not.toHaveBeenCalled();
  });

  it("rechaza 415 cuando el contenido no coincide con el tipo declarado", async () => {
    const token = queryAuthorization.createAccess([7], 7);
    const formData = new FormData();
    formData.append("file", new File([Buffer.from("no soy un png")], "foto.png", { type: "image/png" }));
    formData.append("folder", "afiliaciones/fotos");
    const response = await POST(new NextRequest("http://localhost/api/afiliaciones/postulacion/upload", {
      method: "POST",
      body: formData,
      headers: { cookie: `${QUERY_COOKIE}=${token}` },
    }));
    expect(response.status).toBe(415);
    expect(mocks.uploadFile).not.toHaveBeenCalled();
  });

  it("permite a un usuario interno autorizado usar el applicationId solicitado", async () => {
    mocks.getInternalApiUser.mockResolvedValue({ id: 1 });
    mocks.hasPermission.mockImplementation(async (action: string, subject: string) => action === "update" && subject === "memberships");
    const response = await POST(uploadRequest({ applicationId: "42" }));
    expect(response.status).toBe(200);
    expect(mocks.uploadFile).toHaveBeenCalledWith(PNG, "foto.png", "image/png", "afiliaciones/applications/42/photos");
  });

  it("ignora el applicationId del navegador para un postulante anónimo", async () => {
    const response = await POST(uploadRequest({ applicationId: "42" }));
    expect(response.status).toBe(401);
    expect(mocks.uploadFile).not.toHaveBeenCalled();
  });

  it("exige permiso de usuarios para la carpeta de avatares", async () => {
    const response = await POST(uploadRequest({ folder: "users/avatars" }));
    expect(response.status).toBe(403);
    expect(mocks.uploadFile).not.toHaveBeenCalled();
  });
});
