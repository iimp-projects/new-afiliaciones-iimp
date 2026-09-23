import { beforeEach, describe, expect, it, vi } from "vitest";

const tx = vi.hoisted(() => ({
  $executeRaw: vi.fn(),
  verificationToken: { deleteMany: vi.fn(), create: vi.fn() },
}));
const mocks = vi.hoisted(() => ({ transaction: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { $transaction: mocks.transaction } }));

import { ForgotPasswordRepository } from "./repository";

describe("forgot-password token replacement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.transaction.mockImplementation((callback: (client: typeof tx) => unknown) => callback(tx));
  });

  it("serializes replacement and leaves only the newest reset token", async () => {
    const expiresAt = new Date(Date.now() + 60_000);

    await ForgotPasswordRepository.replaceTokenHash("user@example.com", "token-hash", expiresAt);

    expect(tx.$executeRaw).toHaveBeenCalledOnce();
    expect(tx.verificationToken.deleteMany).toHaveBeenCalledWith({ where: { identifier: "user@example.com" } });
    expect(tx.verificationToken.create).toHaveBeenCalledWith({ data: { identifier: "user@example.com", token: "token-hash", expires: expiresAt } });
  });
});
