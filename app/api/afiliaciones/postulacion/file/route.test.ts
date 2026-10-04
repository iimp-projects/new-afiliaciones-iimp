import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getObjectKey: vi.fn(),
  getPresignedApplicationDocumentUrl: vi.fn(),
  getInternalApiUser: vi.fn(),
  hasPermission: vi.fn(),
  findFirst: vi.fn(),
}));

vi.mock("@/modules/shared/Services/S3StorageService", () => ({
  S3StorageService: class {
    getObjectKey = mocks.getObjectKey;
    getPresignedApplicationDocumentUrl = mocks.getPresignedApplicationDocumentUrl;
  },
}));
vi.mock("@/modules/auth/context/api-authorization", () => ({
  getInternalApiUser: mocks.getInternalApiUser,
}));
vi.mock("@/modules/auth/context/service", () => ({
  contextService: { hasPermission: mocks.hasPermission },
}));
vi.mock("@/lib/prisma", () => ({
  prisma: { applicationDocument: { findFirst: mocks.findFirst } },
}));

import { GET } from "./route";
import { QUERY_COOKIE, queryAuthorization } from "@/modules/afiliaciones/consulta/Services/QueryAuthorizationService";
import { APPLICATION_KEY_PREFIX, LEGACY_DOCUMENT_KEY_PREFIX } from "@/modules/afiliaciones/postulacion/Services/ApplicationDocumentAccess";

const LEGACY_URL = "https://bucket.s3.us-east-2.amazonaws.com/afiliaciones/legacy/documents/photo.jpg";
const LEGACY_KEY = "afiliaciones/legacy/documents/photo.jpg";

function fileRequest(options: { url?: string; token?: string } = {}) {
  const url = options.url ?? LEGACY_URL;
  return new NextRequest(`http://localhost/api/afiliaciones/postulacion/file?url=${encodeURIComponent(url)}`, {
    method: "GET",
    headers: options.token ? { cookie: `${QUERY_COOKIE}=${options.token}` } : {},
  });
}

describe("GET /api/afiliaciones/postulacion/file authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("AUTH_SECRET", "test-only-file-secret");
    mocks.getObjectKey.mockReturnValue(LEGACY_KEY);
    mocks.getPresignedApplicationDocumentUrl.mockResolvedValue("https://presigned.example/object");
    mocks.getInternalApiUser.mockResolvedValue(null);
    mocks.hasPermission.mockResolvedValue(false);
    mocks.findFirst.mockResolvedValue(null);
  });

  it("rechaza 401 anónimo (sin usuario ni cookie) y no firma", async () => {
    const response = await GET(fileRequest());
    expect(response.status).toBe(401);
    expect((await response.json()).message).toBe("No autenticado.");
    expect(mocks.getPresignedApplicationDocumentUrl).not.toHaveBeenCalled();
  });

  it("autoriza al comité evaluador con alcance interno completo", async () => {
    mocks.getInternalApiUser.mockResolvedValue({ id: 1, type: "VALIDATOR" });
    mocks.hasPermission.mockImplementation(async (action: string, subject: string) => action === "read" && subject === "documents");
    const response = await GET(fileRequest());
    expect(response.status).toBe(200);
    expect(mocks.getPresignedApplicationDocumentUrl).toHaveBeenCalledWith(
      LEGACY_URL,
      [APPLICATION_KEY_PREFIX, LEGACY_DOCUMENT_KEY_PREFIX],
      [],
    );
  });

  it("autoriza al super admin con alcance interno completo", async () => {
    mocks.getInternalApiUser.mockResolvedValue({ id: 2, type: "SYSTEM_ADMIN" });
    mocks.hasPermission.mockResolvedValue(true);
    const response = await GET(fileRequest());
    expect(response.status).toBe(200);
    expect(mocks.getPresignedApplicationDocumentUrl).toHaveBeenCalledWith(
      LEGACY_URL,
      [APPLICATION_KEY_PREFIX, LEGACY_DOCUMENT_KEY_PREFIX],
      [],
    );
  });

  it("rechaza 401 a un interno sin permiso read:documents", async () => {
    mocks.getInternalApiUser.mockResolvedValue({ id: 3, type: "VALIDATOR" });
    mocks.hasPermission.mockResolvedValue(false);
    const response = await GET(fileRequest());
    expect(response.status).toBe(401);
    expect(mocks.getPresignedApplicationDocumentUrl).not.toHaveBeenCalled();
  });

  it("rechaza 401 a un postulante (APPLICANT) aunque tenga read:documents", async () => {
    mocks.getInternalApiUser.mockResolvedValue({ id: 4, type: "APPLICANT" });
    mocks.hasPermission.mockResolvedValue(true);
    const response = await GET(fileRequest());
    expect(response.status).toBe(401);
    expect(mocks.getPresignedApplicationDocumentUrl).not.toHaveBeenCalled();
  });

  it("autoriza al postulante con cookie válida solo dentro de su applicationId", async () => {
    const token = queryAuthorization.createAccess([7], 7);
    mocks.getInternalApiUser.mockResolvedValue({ id: 4, type: "APPLICANT" });
    mocks.hasPermission.mockResolvedValue(true);
    const response = await GET(fileRequest({ token }));
    expect(response.status).toBe(200);
    expect(mocks.getPresignedApplicationDocumentUrl).toHaveBeenCalledWith(
      LEGACY_URL,
      ["afiliaciones/applications/7"],
      [],
    );
  });
});
