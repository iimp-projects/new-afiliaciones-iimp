import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  consume: vi.fn(),
  consumeAndResetPassword: vi.fn(),
}));

vi.mock("@/modules/auth/rate-limit/VerificationTokenRateLimiter", () => ({
  verificationTokenRateLimiter: { consume: mocks.consume },
}));

vi.mock("./repository", () => ({
  ResetPasswordRepository: {
    consumeAndResetPassword: mocks.consumeAndResetPassword,
  },
}));

import { ResetPasswordService } from "./service";

describe("ResetPasswordService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("detiene la validación cuando se supera el límite persistente", async () => {
    mocks.consume.mockResolvedValueOnce(true).mockResolvedValueOnce(false);

    await expect(
      ResetPasswordService.executeReset("user@example.com", "123456", "SafePassword!123", "192.0.2.10"),
    ).rejects.toThrow("RATE_LIMIT_EXCEEDED");
    expect(mocks.consumeAndResetPassword).not.toHaveBeenCalled();
  });

  it("delega consumo, cambio y revocación a una única operación atómica", async () => {
    mocks.consume.mockResolvedValue(true);

    await ResetPasswordService.executeReset(" USER@Example.com ", "123456", "SafePassword!123", "192.0.2.10");

    expect(mocks.consumeAndResetPassword).toHaveBeenCalledOnce();
    expect(mocks.consumeAndResetPassword).toHaveBeenCalledWith(
      "user@example.com",
      expect.arrayContaining([expect.stringMatching(/^[a-f0-9]{64}$/)]),
      "SafePassword!123",
    );
  });
});
