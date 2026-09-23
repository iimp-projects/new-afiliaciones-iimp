import { prisma } from "@/lib/prisma";

export const ForgotPasswordRepository = {
  async findUserByEmail(email: string) {
    return prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, status: true },
    });
  },

  async replaceTokenHash(email: string, tokenHash: string, expiresAt: Date) {
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`password-reset:${email}`}))`;
      await tx.verificationToken.deleteMany({ where: { identifier: email } });
      await tx.verificationToken.create({
        data: { identifier: email, token: tokenHash, expires: expiresAt },
      });
    });
  },
};
