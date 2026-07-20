import { prisma } from "@/modules/shared/database/prisma.client";

export const ForgotPasswordRepository = {
  async findUserByEmail(email: string) {
    return await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, isActive: true },
    });
  },

  async deleteExistingTokens(email: string) {
    await prisma.passwordResetToken.deleteMany({
      where: { email },
    });
  },

  async saveTokenHash(email: string, tokenHash: string, expiresAt: Date) {
    await prisma.passwordResetToken.create({
      data: { email, tokenHash, expiresAt },
    });
  },

  async checkRateLimit(key: string, limit: number, windowMinutes: number): Promise<boolean> {
    const now = new Date();
    await prisma.authRateLimit.deleteMany({ where: { expiresAt: { lt: now } } });

    const record = await prisma.authRateLimit.findUnique({ where: { key } });

    if (!record) {
      await prisma.authRateLimit.create({
        data: {
          key,
          points: 1,
          expiresAt: new Date(now.getTime() + windowMinutes * 60 * 1000),
        },
      });
      return true;
    }

    if (record.points >= limit) return false;

    await prisma.authRateLimit.update({
      where: { key },
      data: { points: record.points + 1 },
    });

    return true;
  },
};