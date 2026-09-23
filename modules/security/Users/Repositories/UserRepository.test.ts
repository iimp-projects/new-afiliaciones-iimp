import { beforeEach, describe, expect, it, vi } from "vitest";

const tx = vi.hoisted(() => ({
  person: { upsert: vi.fn() },
  user: { create: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
  credential: { create: vi.fn() },
  userSession: { updateMany: vi.fn() },
}));
const db = vi.hoisted(() => ({ $transaction: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: db }));

import { UserRepository } from "./UserRepository";

describe("UserRepository security invariants", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.$transaction.mockImplementation((callback: (client: typeof tx) => unknown) => callback(tx));
    tx.person.upsert.mockResolvedValue({ id: 9 });
    tx.user.create.mockResolvedValue({ id: 42, status: "PENDING" });
    tx.user.update.mockResolvedValue({ id: 42 });
    tx.userSession.updateMany.mockResolvedValue({ count: 1 });
  });

  it("persists administrative accounts as pending and without a password credential", async () => {
    await new UserRepository().createUserWithPerson({
      documentType: "DNI",
      documentNumber: "12345678",
      firstName: "Ana",
      paternalLastName: "Pérez",
      email: "ana@example.com",
      roleId: 2,
      userType: "VALIDATOR",
    } as never);

    expect(tx.user.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: "PENDING" }),
    }));
    expect(tx.user.create.mock.calls[0][0].data).not.toHaveProperty("emailVerified");
    expect(tx.credential.create).not.toHaveBeenCalled();
  });

  it("derives deactivation from persisted state and revokes every existing session atomically", async () => {
    tx.user.findUnique.mockResolvedValue({ status: "ACTIVE" });

    await new UserRepository().toggleUserStatus(42);

    expect(tx.user.update).toHaveBeenCalledWith({ where: { id: 42 }, data: { status: "INACTIVE" } });
    expect(tx.userSession.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: 42, isRevoked: false } }));
  });

  it("revokes sessions in the same transaction as soft deletion", async () => {
    await new UserRepository().softDeleteUser(42);

    expect(tx.user.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 42 }, data: expect.objectContaining({ status: "INACTIVE", deletedAt: expect.any(Date) }) }));
    expect(tx.userSession.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: 42, isRevoked: false } }));
  });
});
