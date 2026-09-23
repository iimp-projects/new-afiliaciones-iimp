import { beforeEach, describe, expect, it, vi } from "vitest";

const tx = vi.hoisted(() => ({
  verificationToken: { deleteMany: vi.fn() },
  user: { findUnique: vi.fn() },
  credential: { updateMany: vi.fn() },
  userSession: { updateMany: vi.fn() },
}));
const mocks = vi.hoisted(() => ({ transaction: vi.fn(), hash: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { $transaction: mocks.transaction } }));
vi.mock("bcryptjs", () => ({ default: { hash: mocks.hash } }));

import { ResetPasswordRepository } from "./repository";

describe("atomic password reset", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.hash.mockResolvedValue("hashed-password");
    mocks.transaction.mockImplementation((callback: (client: typeof tx) => unknown) => callback(tx));
    tx.verificationToken.deleteMany.mockResolvedValue({ count: 1 });
    tx.user.findUnique.mockResolvedValue({ id: 7, status: "ACTIVE", deletedAt: null });
    tx.credential.updateMany.mockResolvedValue({ count: 1 });
    tx.userSession.updateMany.mockResolvedValue({ count: 2 });
  });

  it("consumes a live token, changes the password and revokes sessions in one transaction", async () => {
    await ResetPasswordRepository.consumeAndResetPassword("user@example.com", ["token-hash"], "SafePassword!123");

    expect(tx.verificationToken.deleteMany).toHaveBeenCalledWith({ where: { identifier: "user@example.com", token: { in: ["token-hash"] }, expires: { gt: expect.any(Date) } } });
    expect(tx.credential.updateMany).toHaveBeenCalledWith({ where: { userId: 7, type: "PASSWORD", isActive: true }, data: { secret: "hashed-password" } });
    expect(tx.verificationToken.deleteMany).toHaveBeenLastCalledWith({ where: { identifier: "user@example.com" } });
    expect(tx.userSession.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: 7, isRevoked: false } }));
  });

  it("rejects an already consumed or expired token before changing credentials", async () => {
    tx.verificationToken.deleteMany.mockResolvedValue({ count: 0 });

    await expect(ResetPasswordRepository.consumeAndResetPassword("user@example.com", ["token-hash"], "SafePassword!123")).rejects.toThrow("INVALID_TOKEN");
    expect(tx.credential.updateMany).not.toHaveBeenCalled();
    expect(tx.userSession.updateMany).not.toHaveBeenCalled();
  });
});
