import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  hasPermission: vi.fn(),
  consume: vi.fn(),
  findFirst: vi.fn(),
}));

vi.mock("@/modules/auth/context/service", () => ({
  contextService: { getCurrentUser: mocks.getCurrentUser, hasPermission: mocks.hasPermission },
}));
vi.mock("@/modules/auth/rate-limit/VerificationTokenRateLimiter", () => ({
  verificationTokenRateLimiter: { consume: mocks.consume },
}));
vi.mock("@/lib/prisma", () => ({ prisma: { person: { findFirst: mocks.findFirst } } }));

import { GET } from "./route";

const internalUser = { id: 1, status: "ACTIVE", type: "VALIDATOR", role: { slug: "ATENCION_ASOCIADO" }, permissions: new Set<string>() };
const affiliateActive = { id: 2, status: "ACTIVE", type: "AFFILIATE", role: { slug: "ASOCIADO_ACTIVO" }, permissions: new Set<string>() };
const affiliateStudent = { id: 3, status: "ACTIVE", type: "AFFILIATE", role: { slug: "ASOCIADO_ESTUDIANTE" }, permissions: new Set<string>() };

const request = () => new NextRequest("http://localhost/api/asociados/consulta-habil?dni=12345678");

describe("consulta-habil internal boundary (NF1)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.consume.mockResolvedValue(true);
    mocks.findFirst.mockResolvedValue(null);
  });

  it("anónimo → 401", async () => {
    mocks.getCurrentUser.mockResolvedValue(null);
    const response = await GET(request());
    expect(response.status).toBe(401);
    expect(mocks.findFirst).not.toHaveBeenCalled();
  });

  it("ASOCIADO_ACTIVO → 403", async () => {
    mocks.getCurrentUser.mockResolvedValue(affiliateActive);
    mocks.hasPermission.mockResolvedValue(true);
    const response = await GET(request());
    expect(response.status).toBe(403);
    expect(mocks.findFirst).not.toHaveBeenCalled();
  });

  it("ASOCIADO_ESTUDIANTE → 403", async () => {
    mocks.getCurrentUser.mockResolvedValue(affiliateStudent);
    mocks.hasPermission.mockResolvedValue(true);
    const response = await GET(request());
    expect(response.status).toBe(403);
    expect(mocks.findFirst).not.toHaveBeenCalled();
  });

  it("interno sin permiso → 403", async () => {
    mocks.getCurrentUser.mockResolvedValue(internalUser);
    mocks.hasPermission.mockResolvedValue(false);
    const response = await GET(request());
    expect(response.status).toBe(403);
    expect(mocks.findFirst).not.toHaveBeenCalled();
  });

  it("interno con read:memberships → permitido y sin PII", async () => {
    mocks.getCurrentUser.mockResolvedValue(internalUser);
    mocks.hasPermission.mockResolvedValue(true);
    mocks.findFirst.mockResolvedValue({
      id: 9,
      documentNumber: "12345678",
      firstName: "Ana",
      paternalLastName: "Pérez",
      maternalLastName: null,
      user: { status: "ACTIVE", type: "AFFILIATE" },
      contacts: [],
      endorsementsGiven: [],
    });

    const response = await GET(request());
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ eligible: true });
    const serialized = JSON.stringify(body);
    expect(serialized).not.toContain("Ana");
    expect(serialized).not.toContain("Pérez");
    expect(serialized).not.toContain("12345678");
  });
});
