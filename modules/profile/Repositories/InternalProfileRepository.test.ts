import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(), personContactUpdate: vi.fn(), personContactCreate: vi.fn(), userUpdate: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: mocks.findUnique },
    $transaction: async (callback: (tx: unknown) => Promise<unknown>) => callback({
      personContact: { update: mocks.personContactUpdate, create: mocks.personContactCreate },
      user: { update: mocks.userUpdate },
    }),
  },
}));

import { InternalProfileRepository } from "./InternalProfileRepository";

function profile(contacts: Array<{ id: number; phoneType: "MOBILE" | "OTHER"; phoneNumber: string; email: string | null; isPrimary: boolean }>) {
  return { id: 41, email: "interno@example.test", image: null, status: "ACTIVE", role: { name: "Legal", slug: "LEGAL" }, person: { id: 7, firstName: "Persona", paternalLastName: "Demo", maternalLastName: null, documentType: "DNI", documentNumber: "99999999", contacts } };
}

describe("InternalProfileRepository", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("actualiza el contacto telefónico móvil canónico sin alterar su correo", async () => {
    mocks.findUnique.mockResolvedValue(profile([{ id: 5, phoneType: "MOBILE", phoneNumber: "999111222", email: "interno@example.test", isPrimary: true }]));
    await new InternalProfileRepository().updateOwnProfile(41, "+51 999 222 333");
    expect(mocks.personContactUpdate).toHaveBeenCalledWith({ where: { id: 5 }, data: { phoneNumber: "+51 999 222 333" } });
    expect(mocks.personContactCreate).not.toHaveBeenCalled();
  });

  it("crea un PersonContact MOBILE cuando no existe un contacto telefónico canónico", async () => {
    mocks.findUnique.mockResolvedValue(profile([]));
    await new InternalProfileRepository().updateOwnProfile(41, "+51 999 222 333");
    expect(mocks.personContactCreate).toHaveBeenCalledWith({ data: { personId: 7, phoneType: "MOBILE", phoneNumber: "+51 999 222 333", isPrimary: true } });
  });

  it("guarda avatar solo como key estable, nunca como URL presignada", async () => {
    mocks.findUnique.mockResolvedValue(profile([]));
    await new InternalProfileRepository().updateOwnProfile(41, "+51 999 222 333", "afiliaciones/perfiles/avatar.png");
    expect(mocks.userUpdate).toHaveBeenCalledWith({ where: { id: 41 }, data: { image: "afiliaciones/perfiles/avatar.png" } });
  });
});
