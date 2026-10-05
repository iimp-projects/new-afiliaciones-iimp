import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ findFirst: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { person: { findFirst: mocks.findFirst } } }));

import { ValidateSponsorService } from "./ValidateSponsorService";
import { sponsorEligibilityWhere } from "./SponsorEligibility";

describe("ValidateSponsorService — elegibilidad sin exigir auth_user", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("consulta con la regla unificada (COMPLETED + ACTIVO + PAGADO)", async () => {
    mocks.findFirst.mockResolvedValue({
      id: 9,
      documentNumber: "12345678",
      firstName: "Ana",
      paternalLastName: "Perez",
      maternalLastName: "Lopez",
      user: null,
      contacts: [{ isPrimary: true, email: "ana@example.com" }],
    });

    await new ValidateSponsorService().execute("12345678");

    expect(mocks.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: sponsorEligibilityWhere("12345678") }),
    );
  });

  it("devuelve null si la persona no es elegible (DNI inexistente / no ACTIVO+PAGADO)", async () => {
    mocks.findFirst.mockResolvedValue(null);
    await expect(new ValidateSponsorService().execute("99999999")).resolves.toBeNull();
  });

  it("obtiene email del contacto primario cuando no existe user", async () => {
    mocks.findFirst.mockResolvedValue({
      id: 9,
      documentNumber: "12345678",
      firstName: "Ana",
      paternalLastName: "Perez",
      maternalLastName: "Lopez",
      user: null,
      contacts: [{ isPrimary: true, email: "ana@example.com" }],
    });

    const result = await new ValidateSponsorService().execute("12345678");

    expect(result).toMatchObject({
      id: 9,
      documentNumber: "12345678",
      fullName: "Ana Perez Lopez",
      email: "ana@example.com",
      sponsorCode: "A-0009",
    });
  });

  it("prefiere email de user si existe", async () => {
    mocks.findFirst.mockResolvedValue({
      id: 9,
      documentNumber: "12345678",
      firstName: "Ana",
      paternalLastName: "Perez",
      maternalLastName: null,
      user: { email: "user@example.com" },
      contacts: [],
    });

    const result = await new ValidateSponsorService().execute("12345678");

    expect(result?.email).toBe("user@example.com");
  });

  it("usa 'Sin correo' cuando no hay user ni contacto con email", async () => {
    mocks.findFirst.mockResolvedValue({
      id: 9,
      documentNumber: "12345678",
      firstName: "Ana",
      paternalLastName: "Perez",
      maternalLastName: null,
      user: null,
      contacts: [{ isPrimary: false, email: null }],
    });

    const result = await new ValidateSponsorService().execute("12345678");

    expect(result?.email).toBe("Sin correo");
  });
});
