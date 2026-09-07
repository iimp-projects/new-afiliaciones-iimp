import { VerificationError } from "@/modules/shared/Models/VerificationError";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { OTP_COOLDOWN_SECONDS, OTP_MAX_ATTEMPTS, OTP_TTL_MS, type VerificationChannel, type VerificationContext } from "@/modules/shared/Models/Verification";

// Namespace query codes because the existing enum has no APPLICATION_QUERY.
// This keeps query and recovery verification isolated without a migration.
const queryPrefix = "APPLICATION_QUERY:";
const scope = (context: VerificationContext): Prisma.VerificationCodeWhereInput => context === "APPLICATION_QUERY"
  ? { code: { startsWith: queryPrefix } } : { NOT: { code: { startsWith: queryPrefix } } };
const storedCode = (code: string, context: VerificationContext) => context === "APPLICATION_QUERY" ? `${queryPrefix}${code}` : code;

export class VerificationRepository {
  findApplication(identifier: string | number) {
    return prisma.membershipApplication.findFirst({ where: { ...(typeof identifier === "number" ? { id: identifier } : { trackingCode: identifier }), deletedAt: null } });
  }

  async reserve(applicationId: number, channel: VerificationChannel, destination: string, code: string, context: VerificationContext) {
    return prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM membership_applications WHERE id = ${applicationId} FOR UPDATE`;
      const now = new Date();
      const recent = await tx.verificationCode.findMany({ where: { applicationId, purpose: "RESUME_APPLICATION", createdAt: { gt: new Date(now.getTime() - OTP_TTL_MS) } }, orderBy: { createdAt: "desc" } });
      if (recent.some((otp) => otp.attempts >= OTP_MAX_ATTEMPTS) || recent.length >= 5) throw new VerificationError("Has realizado demasiados intentos. Intenta nuevamente más tarde.");
      if (recent[0] && now.getTime() - recent[0].createdAt.getTime() < OTP_COOLDOWN_SECONDS * 1000) throw new VerificationError(`Espera ${OTP_COOLDOWN_SECONDS} segundos antes de solicitar otro código.`);
      await tx.verificationCode.updateMany({ where: { applicationId, purpose: "RESUME_APPLICATION", verifiedAt: null, ...scope(context) }, data: { verifiedAt: now } });
      return tx.verificationCode.create({ data: { applicationId, channel, destination, code: storedCode(code, context), purpose: "RESUME_APPLICATION", expiresAt: new Date(now.getTime() + OTP_TTL_MS) } });
    });
  }

  invalidate(id: number) {
    return prisma.verificationCode.update({ where: { id }, data: { verifiedAt: new Date() } });
  }

  async consume(applicationId: number, code: string, context: VerificationContext) {
    const error = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM membership_applications WHERE id = ${applicationId} FOR UPDATE`;
      const otp = await tx.verificationCode.findFirst({ where: { applicationId, purpose: "RESUME_APPLICATION", verifiedAt: null, ...scope(context) }, orderBy: { createdAt: "desc" } });
      if (!otp) return "No hay códigos pendientes solicitados.";
      if (otp.expiresAt <= new Date()) return "El código ha expirado. Solicita uno nuevo.";
      if (otp.attempts >= OTP_MAX_ATTEMPTS) return "Has realizado demasiados intentos. Intenta nuevamente más tarde.";
      if (otp.code !== storedCode(code, context)) {
        await tx.verificationCode.update({ where: { id: otp.id }, data: { attempts: { increment: 1 } } });
        return "El código ingresado no es correcto.";
      }
      await tx.verificationCode.update({ where: { id: otp.id }, data: { verifiedAt: new Date() } });
      return { channel: otp.channel, destination: otp.destination };
    });
    if (typeof error === "string") throw new VerificationError(error);
    return error;
  }
}
