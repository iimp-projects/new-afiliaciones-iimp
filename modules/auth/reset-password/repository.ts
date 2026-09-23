import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export const ResetPasswordRepository = {
  async consumeAndResetPassword(email: string, tokenHashes: readonly string[], passwordPlain: string) {
    const hashedPassword = await bcrypt.hash(passwordPlain, 12);
    await prisma.$transaction(async (tx) => {
      const consumed = await tx.verificationToken.deleteMany({
        where: { identifier: email, token: { in: [...tokenHashes] }, expires: { gt: new Date() } },
      });
      if (consumed.count !== 1) throw new Error("INVALID_TOKEN");

      const user = await tx.user.findUnique({
        where: { email },
        select: { id: true, status: true, deletedAt: true },
      });
      if (!user || user.status !== "ACTIVE" || user.deletedAt) throw new Error("INVALID_TOKEN");

      const credentials = await tx.credential.updateMany({
        where: { userId: user.id, type: "PASSWORD", isActive: true },
        data: { secret: hashedPassword },
      });
      if (credentials.count < 1) throw new Error("INVALID_TOKEN");

      await tx.verificationToken.deleteMany({ where: { identifier: email } });

      const revokedAt = new Date();
      await tx.userSession.updateMany({
        where: { userId: user.id, isRevoked: false },
        data: { isRevoked: true, revokedAt, revokeReason: "Contraseña restablecida." },
      });
    });
  },
};
