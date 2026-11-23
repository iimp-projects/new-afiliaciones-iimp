import { beforeEach, describe, expect, it, vi } from "vitest";
import { ExpedienteRepository } from "./ExpedienteRepository";

const mocks = vi.hoisted(() => ({
  applicationFindUnique: vi.fn(),
  applicationCount: vi.fn(),
  applicationFindMany: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    membershipApplication: {
      findUnique: mocks.applicationFindUnique,
      count: mocks.applicationCount,
      findMany: mocks.applicationFindMany,
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

  it("incluye validations.history con evidencia y usuario selectivo", async () => {
    mocks.applicationFindUnique.mockResolvedValue({
      id: 26,
      draftData: null,
      validations: [
        {
          id: 10,
          department: { code: "LOGISTICA" },
          history: [
            {
              id: 1,
              action: "APPROVED",
              attachmentUrl: "afiliaciones/applications/26/observations/x.pdf",
              attachmentName: "x.pdf",
              mimeType: "application/pdf",
              user: { id: 1, name: "Ana", person: { firstName: "Ana", paternalLastName: "Pérez", maternalLastName: null } },
            },
          ],
        },
      ],
    });

    await new ExpedienteRepository().getById(26);

    const arg = mocks.applicationFindUnique.mock.calls[0][0];
    expect(arg.include.validations.include.history).toEqual({
      include: {
        user: {
          select: {
            id: true,
            name: true,
            person: { select: { firstName: true, paternalLastName: true, maternalLastName: true } },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });
  });
});

describe("ExpedienteRepository.getPaginated — filtros avanzados", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.applicationCount.mockResolvedValue(0);
    mocks.applicationFindMany.mockResolvedValue([]);
  });

  it("combina filtros de persona, evaluación y avales en el where", async () => {
    await new ExpedienteRepository().getPaginated({
      page: 1,
      pageSize: 10,
      gender: "FEMALE",
      countryId: 5,
      universityId: 7,
      company: "ACME SAC",
      evaluatorId: 3,
      endorsementStatus: "APPROVED",
    });

    const { where } = mocks.applicationFindMany.mock.calls[0][0];
    expect(where.person).toEqual({
      gender: "FEMALE",
      addresses: { some: { countryId: 5 } },
      academicInfos: { some: { universityId: 7 } },
    });
    expect(where.AND).toEqual([
      {
        OR: [
          { draftData: { path: ["employmentInformation", "companyName"], string_contains: "ACME SAC" } },
          { person: { employmentInfos: { some: { company: { name: { contains: "ACME SAC", mode: "insensitive" } } } } } },
        ],
      },
      {
        OR: [
          { validations: { some: { validatedById: 3 } } },
          { areaValidations: { some: { validatedById: 3 } } },
        ],
      },
      { approvals: { some: { status: "APPROVED" } } },
    ]);
  });

  it("ignora filtros avanzados cuando llegan como 'Todos' o vacíos", async () => {
    await new ExpedienteRepository().getPaginated({
      page: 1,
      pageSize: 10,
      gender: "Todos",
      endorsementStatus: "Todos",
      countryId: undefined,
    });

    const { where } = mocks.applicationFindMany.mock.calls[0][0];
    expect(where.person).toBeUndefined();
    expect(where.AND).toBeUndefined();
  });
});
