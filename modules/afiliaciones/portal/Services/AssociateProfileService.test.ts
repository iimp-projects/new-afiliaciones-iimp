import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({ user: { findUnique: vi.fn() } }));
vi.mock("@/lib/prisma", () => ({ prisma: db }));

import { AssociateProfileService } from "./AssociateProfileService";

const person = (overrides: Record<string, unknown> = {}) => ({
  id: 17,
  firstName: "Ana",
  paternalLastName: "Prueba",
  maternalLastName: null,
  documentType: "DNI",
  documentNumber: "12345678",
  birthDate: null,
  gender: null,
  nationalityId: null,
  nationality: null,
  updatedAt: new Date("2026-09-16T00:00:00.000Z"),
  contacts: [],
  addresses: [],
  applications: [],
  professionalExperiences: [],
  academicInfos: [{ university: { name: "Universidad de prueba" }, specialty: { name: "Ingeniería" }, degree: { name: "Bachiller" }, degreeTitle: null, graduationYear: 2020, professionalAssociation: null, licenseNumber: null }],
  employmentInfos: [],
  ...overrides,
});

describe("AssociateProfileService", () => {
  beforeEach(() => vi.clearAllMocks());

  it("maps canonical employment information for the authenticated user's person", async () => {
    db.user.findUnique.mockResolvedValue({
      email: "associate@example.test",
      image: null,
      lastLoginAt: null,
      person: person({ employmentInfos: [{ area: "Operaciones", workingAddress: "Dirección laboral", workPhone: "999999999", workExtension: null, workEmail: "work@example.test", company: { name: "Empresa real", taxId: "20123456789", industry: null, email: null, phone: null, address: null, sector: { name: "Minería" } }, position: { name: "Ingeniera" } }] }),
    });

    const profile = await new AssociateProfileService().getForUser(44);

    expect(db.user.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 44 } }));
    expect(profile?.professional).toMatchObject({ company: "Empresa real", position: "Ingeniera", area: "Operaciones", companySector: "Minería" });
    expect(profile?.academic).toHaveLength(1);
  });

  it("keeps the labor empty state when the canonical person has no employment information", async () => {
    db.user.findUnique.mockResolvedValue({ email: "associate@example.test", image: null, lastLoginAt: null, person: person() });

    const profile = await new AssociateProfileService().getForUser(44);

    expect(profile?.professional).toBeNull();
    expect(profile?.academic).toEqual(expect.arrayContaining([expect.objectContaining({ university: "Universidad de prueba" })]));
  });
});
