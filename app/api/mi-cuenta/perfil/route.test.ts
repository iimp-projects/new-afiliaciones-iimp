import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAffiliate: vi.fn(),
  getForUser: vi.fn(),
}));

vi.mock("@/modules/auth/context/service", () => ({
  contextService: { requireAffiliate: mocks.requireAffiliate },
}));

vi.mock("@/modules/afiliaciones/portal/Services/AssociateProfileService", () => ({
  AssociateProfileService: class {
    getForUser = mocks.getForUser;
  },
}));

import { GET } from "./route";

const rawPrivateKey = "afiliaciones/applications/7/foto.jpg";
const presignedImage = "https://bucket.s3.us-east-2.amazonaws.com/afiliaciones/applications/7/foto.jpg?X-Amz-Signature=presigned";

const profileWith = (identityImage: string | null) => ({
  identity: {
    fullName: "Gabriela Aguilar",
    firstName: "Gabriela",
    paternalLastName: "Aguilar",
    maternalLastName: null,
    image: identityImage,
    documentType: "DNI",
    documentNumber: "12345678",
    birthDate: null,
    gender: null,
    nationality: null,
    nationalityId: null,
  },
  contact: { primaryPhone: null, primaryEmail: null, secondaryEmail: null },
  address: { street: null, reference: null, country: null, countryId: null, department: null, departmentId: null, province: null, provinceId: null, district: null, districtId: null },
  professional: null,
  academic: [],
  membership: { type: null, code: null, status: "ACTIVE", memberSince: null, updatedAt: null },
  account: { email: "associate@example.test", lastLoginAt: null },
});

describe("GET /api/mi-cuenta/perfil", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reuses the authenticated context's presigned image for the profile card", async () => {
    mocks.requireAffiliate.mockResolvedValue({ id: 42, image: presignedImage });
    mocks.getForUser.mockResolvedValue(profileWith(rawPrivateKey));

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.identity.image).toBe(presignedImage);
  });

  it("falls back to null (initials) when the authenticated context has no photo", async () => {
    mocks.requireAffiliate.mockResolvedValue({ id: 42, image: null });
    mocks.getForUser.mockResolvedValue(profileWith(rawPrivateKey));

    const response = await GET();
    const body = await response.json();

    expect(body.data.identity.image).toBeNull();
  });

  it("does not leak the raw private document key as the profile image", async () => {
    mocks.requireAffiliate.mockResolvedValue({ id: 42, image: presignedImage });
    mocks.getForUser.mockResolvedValue(profileWith(rawPrivateKey));

    const response = await GET();
    const body = await response.json();

    expect(body.data.identity.image).not.toBe(rawPrivateKey);
    expect(body.data.identity.image).toContain("X-Amz-Signature");
  });
});
