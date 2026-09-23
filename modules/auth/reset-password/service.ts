import { verificationTokenRateLimiter } from "@/modules/auth/rate-limit/VerificationTokenRateLimiter";
import { verificationCodeCandidates } from "@/modules/auth/verification/codeHash";
import { ResetPasswordRepository } from "./repository";

export const ResetPasswordService = {
  async executeReset(email: string, code: string, newPasswordPlain: string, ipAddress: string): Promise<void> {
    const normalizedEmail = email.trim().toLowerCase();
    const [ipAllowed, emailAllowed] = await Promise.all([
      verificationTokenRateLimiter.consume("reset-password:ip", ipAddress, 5, 15),
      verificationTokenRateLimiter.consume("reset-password:email", normalizedEmail, 5, 15),
    ]);
    if (!ipAllowed || !emailAllowed) throw new Error("RATE_LIMIT_EXCEEDED");

    const tokenHashes = verificationCodeCandidates(code);
    await ResetPasswordRepository.consumeAndResetPassword(normalizedEmail, tokenHashes, newPasswordPlain);
  },
};
