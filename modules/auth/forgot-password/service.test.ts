import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  consume: vi.fn(),
  findUserByEmail: vi.fn(),
  replaceTokenHash: vi.fn(),
}));

vi.mock("@/modules/auth/rate-limit/VerificationTokenRateLimiter", () => ({
  verificationTokenRateLimiter: { consume: mocks.consume },
}));

vi.mock("./repository", () => ({
  ForgotPasswordRepository: {
    findUserByEmail: mocks.findUserByEmail,
    replaceTokenHash: mocks.replaceTokenHash,
  },
}));

vi.mock("@/modules/shared/Services/MailService", () => ({
  MailService: class { sendMail = vi.fn(); },
}));

import { ForgotPasswordService } from "./service";

describe("ForgotPasswordService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("AUTH_SECRET", "test-auth-secret");
  });

  it("detiene el flujo cuando se supera el límite persistente", async () => {
    mocks.consume.mockResolvedValueOnce(false).mockResolvedValueOnce(true);

    await expect(
      ForgotPasswordService.processRecoveryRequest("user@example.com", "192.0.2.10"),
    ).rejects.toThrow("RATE_LIMIT_EXCEEDED");
    expect(mocks.findUserByEmail).not.toHaveBeenCalled();
  });

  it("reemplaza cualquier código anterior mediante una única operación del repositorio", async () => {
    mocks.consume.mockResolvedValue(true);
    mocks.findUserByEmail.mockResolvedValue({ id: 7, email: "user@example.com", status: "ACTIVE" });

    await ForgotPasswordService.processRecoveryRequest(" USER@example.com ", "192.0.2.10");

    expect(mocks.replaceTokenHash).toHaveBeenCalledWith(
      "user@example.com",
      expect.stringMatching(/^[a-f0-9]{64}$/),
      expect.any(Date),
    );
  });
});
