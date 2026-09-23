import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findUserWithPassword: vi.fn(),
  isAccountLocked: vi.fn(),
  consume: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ signIn: vi.fn() }));
vi.mock("next-auth", () => ({ AuthError: class AuthError extends Error {} }));
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-forwarded-for": "203.0.113.9" }),
}));
vi.mock("./repository", () => ({ loginRepository: { findUserWithPassword: mocks.findUserWithPassword } }));
vi.mock("../security/service", () => ({ securityService: { isAccountLocked: mocks.isAccountLocked } }));
vi.mock("../rate-limit/VerificationTokenRateLimiter", () => ({
  verificationTokenRateLimiter: { consume: mocks.consume },
}));

import { checkLockStatus } from "./action";

describe("checkLockStatus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.consume.mockResolvedValue(true);
    mocks.findUserWithPassword.mockResolvedValue({ lockedUntil: new Date(Date.now() + 60_000) });
    mocks.isAccountLocked.mockReturnValue(true);
  });

  it("informa el bloqueo de una cuenta existente", async () => {
    await expect(checkLockStatus("ana@example.com")).resolves.toMatchObject({ locked: true });
  });

  it("informa que la cuenta no está bloqueada", async () => {
    mocks.isAccountLocked.mockReturnValue(false);
    await expect(checkLockStatus("ana@example.com")).resolves.toEqual({ locked: false });
  });

  it("aplica el rate limit antes de consultar la cuenta", async () => {
    mocks.consume.mockResolvedValue(false);

    await expect(checkLockStatus("ana@example.com")).resolves.toEqual({ locked: false });
    expect(mocks.findUserWithPassword).not.toHaveBeenCalled();
  });

  it("no propaga errores al cliente", async () => {
    mocks.findUserWithPassword.mockRejectedValue(new Error("db down"));
    await expect(checkLockStatus("ana@example.com")).resolves.toEqual({ locked: false });
  });
});
