import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  hasPermission: vi.fn(),
  consume: vi.fn(),
  approvalFindFirst: vi.fn(),
  require: vi.fn(),
  execute: vi.fn(),
}));

vi.mock("@/modules/auth/context/service", () => ({
  contextService: { getCurrentUser: mocks.getCurrentUser, hasPermission: mocks.hasPermission },
}));
vi.mock("@/modules/auth/rate-limit/VerificationTokenRateLimiter", () => ({
  verificationTokenRateLimiter: { consume: mocks.consume },
}));
vi.mock("@/lib/prisma", () => ({ prisma: { membershipApproval: { findFirst: mocks.approvalFindFirst } } }));
vi.mock("@/modules/afiliaciones/postulacion/Services/ApplicationAccessService", () => ({
  ApplicationAccessService: class { require = mocks.require; },
}));
vi.mock("@/modules/afiliaciones/postulacion/Services/ValidateSponsorService", () => ({
  ValidateSponsorService: class { execute = mocks.execute; },
}));
vi.mock("@/modules/afiliaciones/consulta/Services/QueryAuthorizationService", () => ({
  QUERY_COOKIE: "iimp_application_access",
}));

import { GET } from "./route";
import { ApplicationFlowError } from "@/modules/afiliaciones/postulacion/Services/Exceptions/ApplicationFlowError";

const internalUser = { id: 1, status: "ACTIVE", type: "VALIDATOR", role: { slug: "ATENCION_ASOCIADO" }, permissions: new Set<string>() };
const affiliateActive = { id: 2, status: "ACTIVE", type: "AFFILIATE", role: { slug: "ASOCIADO_ACTIVO" }, permissions: new Set<string>() };
const affiliateStudent = { id: 3, status: "ACTIVE", type: "AFFILIATE", role: { slug: "ASOCIADO_ESTUDIANTE" }, permissions: new Set<string>() };

const request = () => new NextRequest("http://localhost/api/afiliaciones/postulacion/validate-sponsor?documentNumber=12345678&applicationId=7");

describe("validate-sponsor internal boundary (NF1)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.consume.mockResolvedValue(true);
    mocks.approvalFindFirst.mockResolvedValue(null);
    mocks.execute.mockResolvedValue({ id: 9, documentNumber: "12345678", fullName: "Aval Hábil", email: "aval@example.com", sponsorCode: "A-0009" });
  });

  it("anónimo sin cookie → 401", async () => {
    mocks.getCurrentUser.mockResolvedValue(null);
    mocks.require.mockImplementation(() => { throw new ApplicationFlowError("VERIFICATION_REQUIRED", "verifica", 401); });
    const response = await GET(request());
    expect(response.status).toBe(401);
  });

  it("ASOCIADO_ACTIVO → 403 (no usa read:memberships)", async () => {
    mocks.getCurrentUser.mockResolvedValue(affiliateActive);
    mocks.hasPermission.mockResolvedValue(true);
    const response = await GET(request());
    expect(response.status).toBe(403);
    expect(mocks.require).not.toHaveBeenCalled();
    expect(mocks.execute).not.toHaveBeenCalled();
  });

  it("ASOCIADO_ESTUDIANTE → 403", async () => {
    mocks.getCurrentUser.mockResolvedValue(affiliateStudent);
    mocks.hasPermission.mockResolvedValue(true);
    const response = await GET(request());
    expect(response.status).toBe(403);
    expect(mocks.require).not.toHaveBeenCalled();
  });

  it("interno sin permiso → 403", async () => {
    mocks.getCurrentUser.mockResolvedValue(internalUser);
    mocks.hasPermission.mockResolvedValue(false);
    const response = await GET(request());
    expect(response.status).toBe(403);
    expect(mocks.execute).not.toHaveBeenCalled();
  });

  it("interno con read:memberships → devuelve los datos de visualización del aval", async () => {
    mocks.getCurrentUser.mockResolvedValue(internalUser);
    mocks.hasPermission.mockResolvedValue(true);
    const response = await GET(request());
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ success: true, data: { eligible: true, sponsorFullName: "Aval Hábil", sponsorEmail: "aval@example.com", sponsorCode: "A-0009", sponsorPersonId: 9 } });
  });

  it("no filtra el DNI ni otros datos sensibles del aval", async () => {
    mocks.getCurrentUser.mockResolvedValue(internalUser);
    mocks.hasPermission.mockResolvedValue(true);
    const response = await GET(request());
    const serialized = JSON.stringify(await response.json());
    expect(serialized).not.toContain("12345678");
    expect(serialized).not.toContain("phone");
    expect(serialized).not.toContain("address");
    expect(serialized).not.toContain("password");
  });

  it("postulante con cookie válida sigue permitido y recibe el aval", async () => {
    mocks.getCurrentUser.mockResolvedValue(null);
    mocks.require.mockImplementation(() => undefined);
    const response = await GET(request());
    expect(response.status).toBe(200);
    expect(mocks.require).toHaveBeenCalled();
    const body = await response.json();
    expect(body.data.sponsorFullName).toBe("Aval Hábil");
  });

  it("DNI inexistente o no asociado → 404 controlado", async () => {
    mocks.getCurrentUser.mockResolvedValue(null);
    mocks.require.mockImplementation(() => undefined);
    mocks.execute.mockResolvedValue(null);
    const response = await GET(request());
    expect(response.status).toBe(404);
  });
});
