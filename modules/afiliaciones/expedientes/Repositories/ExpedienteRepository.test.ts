import { beforeEach, describe, expect, it, vi } from "vitest";
import { ExpedienteRepository } from "./ExpedienteRepository";

const mocks = vi.hoisted(() => ({
  applicationFindUnique: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    membershipApplication: {
      findUnique: mocks.applicationFindUnique,
    },
  },
}));

describe("ExpedienteRepository.getById — datos de contacto del aval", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("incluye user y contacts del sponsorPerson (email/teléfono del aval)", async () => {
    mocks.applicationFindUnique.mockResolvedValue({
      id: 26,
      draftData: null,
      approvals: [{ id: 15, sponsorPerson: { id: 9, user: { email: "aval@example.com" }, contacts: [] } }],
    });

    await new ExpedienteRepository().getById(26);

    const arg = mocks.applicationFindUnique.mock.calls[0][0];
    expect(arg.include.approvals).toEqual({
      include: {
        sponsorPerson: {
          include: { user: true, contacts: true },
        },
      },
    });
  });

  it("expone sponsorPerson.user.email y sponsorPerson.contacts cuando existen", async () => {
    mocks.applicationFindUnique.mockResolvedValue({
      id: 26,
      draftData: null,
      approvals: [
        {
          id: 15,
          sponsorPerson: {
            id: 9,
            firstName: "Carmen",
            paternalLastName: "Flores",
            user: { email: "aval@example.com" },
            contacts: [{ id: 1, phoneNumber: "999999999", email: "aval@example.com" }],
          },
        },
      ],
    });

    const result = await new ExpedienteRepository().getById(26);

    expect(result).not.toBeNull();
    expect(result!.approvals[0].sponsorPerson.user!.email).toBe("aval@example.com");
    expect(result!.approvals[0].sponsorPerson.contacts).toHaveLength(1);
  });

  it("no rompe el flujo cuando sponsorPerson no tiene contacts", async () => {
    mocks.applicationFindUnique.mockResolvedValue({
      id: 26,
      draftData: null,
      approvals: [
        {
          id: 15,
          sponsorPerson: {
            id: 9,
            firstName: "Carmen",
            paternalLastName: "Flores",
            user: { email: "aval@example.com" },
            contacts: [],
          },
        },
      ],
    });

    const result = await new ExpedienteRepository().getById(26);

    expect(result).not.toBeNull();
    expect(result!.approvals[0].sponsorPerson.user!.email).toBe("aval@example.com");
    expect(result!.approvals[0].sponsorPerson.contacts).toEqual([]);
  });
});
