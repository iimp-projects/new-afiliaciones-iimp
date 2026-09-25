import { beforeEach, describe, expect, it, vi } from "vitest";

const tx = vi.hoisted(() => ({
  person: { upsert: vi.fn(), update: vi.fn() },
  user: { create: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
  credential: { create: vi.fn(), updateMany: vi.fn() },
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
    tx.person.update.mockResolvedValue({ id: 9 });
    tx.user.create.mockResolvedValue({ id: 42, status: "ACTIVE" });
    tx.credential.create.mockResolvedValue({});
    tx.credential.updateMany.mockResolvedValue({ count: 1 });
    tx.user.update.mockResolvedValue({ id: 42 });
    tx.userSession.updateMany.mockResolvedValue({ count: 1 });
  });

  it("persists administrative accounts as active with a hashed password credential, atomically", async () => {
    await new UserRepository().createUserWithPerson(
      {
        documentType: "DNI",
        documentNumber: "12345678",
        firstName: "Ana",
        paternalLastName: "Pérez",
        email: "ana@example.com",
        roleId: 2,
        userType: "VALIDATOR",
      } as never,
      undefined,
      "hashed-secret",
    );

    expect(tx.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "ACTIVE", emailVerified: expect.any(Date) }),
      }),
    );
    expect(tx.credential.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 42,
          type: "PASSWORD",
          secret: "hashed-secret",
          isActive: true,
        }),
      }),
    );
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

  it("reactivates a soft-deleted user reusing its person and resetting the password credential", async () => {
    tx.user.findUnique.mockResolvedValue({ personId: 9 });

    await new UserRepository().reactivateUser(
      5,
      {
        documentType: "DNI",
        documentNumber: "12345678",
        firstName: "Ana",
        paternalLastName: "Pérez",
        email: "ana@example.com",
        roleId: 2,
        userType: "VALIDATOR",
      } as never,
      undefined,
      "hashed-secret",
    );

    expect(tx.person.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 9 } }));
    expect(tx.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 5 },
        data: expect.objectContaining({ status: "ACTIVE", deletedAt: null, email: "ana@example.com", roleId: 2 }),
      }),
    );
    expect(tx.credential.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 5, type: "PASSWORD" },
        data: expect.objectContaining({ secret: "hashed-secret", isActive: true }),
      }),
    );
  });

  it("creates a password credential when the reactivated user has none", async () => {
    tx.user.findUnique.mockResolvedValue({ personId: 9 });
    tx.credential.updateMany.mockResolvedValue({ count: 0 });

    await new UserRepository().reactivateUser(
      5,
      {
        documentType: "DNI",
        documentNumber: "12345678",
        firstName: "Ana",
        paternalLastName: "Pérez",
        email: "ana@example.com",
        roleId: 2,
        userType: "VALIDATOR",
      } as never,
      undefined,
      "hashed-secret",
    );

    expect(tx.credential.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ userId: 5, secret: "hashed-secret" }) }),
    );
  });
});
