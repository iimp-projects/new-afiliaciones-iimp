import { prisma } from "@/modules/shared/database/prisma.client";
import bcrypt from "bcryptjs";

export const ResetPasswordRepository = {
  async findValidToken(email: string, tokenHash: string) {
    return await prisma.passwordResetToken.findFirst({
      where: {
        email,
        tokenHash,
        expiresAt: { gt: new Date() },
      },
    });
  },

  async updatePassword(email: string, passwordPlain: string) {
    const hashedPassword = await bcrypt.hash(passwordPlain, 12);
    await prisma.user.update({
      where: { email },
      data: { password: hashedPassword },
    });
  },

  async deleteTokenById(tokenId: string) {
    await prisma.passwordResetToken.delete({
      where: { id: tokenId },
    });
  },
  
  async checkRateLimit(key: string, limit: number, windowMinutes: number): Promise<boolean> {
    const now = new Date();
    await prisma.authRateLimit.deleteMany({ where: { expiresAt: { lt: now } } });
    const record = await prisma.authRateLimit.findUnique({ where: { key } });
    if (!record) {
      await prisma.authRateLimit.create({
        data: { key, points: 1, expiresAt: new Date(now.getTime() + windowMinutes * 60 * 1000) },
      });
      return true;
    }
    if (record.points >= limit) return false;
    await prisma.authRateLimit.update({ where: { key }, data: { points: record.points + 1 } });
    return true;
  },
};