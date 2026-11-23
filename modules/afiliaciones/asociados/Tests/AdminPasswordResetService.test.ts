import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = {
  person: { findUnique: vi.fn() },
  $transaction: vi.fn(),
};

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

const { AdminPasswordResetError, AdminPasswordResetService } = await import("../Services/AdminPasswordResetService");

const tx = {
  $executeRaw: vi.fn(),
  credential: { findFirst: vi.fn(), update: vi.fn(), updateMany: vi.fn(), create: vi.fn() },
  user: { update: vi.fn() },
  userSession: { deleteMany: vi.fn() },
  auditLog: { create: vi.fn() },
};

function person(overrides: Record<string, unknown> = {}) {
  return { documentType: "DNI", documentNumber: "12345678", deletedAt: null, user: { id: 9, status: "ACTIVE" }, ...overrides };
}

describe("AdminPasswordResetService", () => {
  beforeEach(() => vi.clearAllMocks());

  it("restablece la contraseña al número de documento y obliga el cambio", async () => {
    prismaMock.person.findUnique.mockResolvedValue(person());
    prismaMock.$transaction.mockImplementation(async (callback: (client: typeof tx) => unknown) => callback(tx));
    tx.credential.findFirst.mockResolvedValue({ id: "cred-1" });
    tx.auditLog.create.mockResolvedValue({ id: 1 });

    const result = await new AdminPasswordResetService().resetToDocument(2, 7);

    expect(result).toEqual({ documentType: "DNI", mustChangePassword: true });
    expect(tx.credential.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "cred-1" }, data: expect.objectContaining({ isActive: true, secret: expect.stringMatching(/^\$2/) }) }));
    expect(tx.user.update).toHaveBeenCalledWith({ where: { id: 9 }, data: { mustChangePassword: true } });
    expect(tx.userSession.deleteMany).toHaveBeenCalledWith({ where: { userId: 9 } });
    expect(JSON.stringify(tx.auditLog.create.mock.calls[0][0])).not.toContain("12345678");
  });

  it("rechaza cuentas que no están activas", async () => {
    prismaMock.person.findUnique.mockResolvedValue(person({ user: { id: 9, status: "PENDING" } }));
    await expect(new AdminPasswordResetService().resetToDocument(2, 7)).rejects.toBeInstanceOf(AdminPasswordResetError);
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("rechaza personas sin cuenta", async () => {
    prismaMock.person.findUnique.mockResolvedValue(person({ user: null }));
    await expect(new AdminPasswordResetService().resetToDocument(2, 7)).rejects.toBeInstanceOf(AdminPasswordResetError);
  });
});
