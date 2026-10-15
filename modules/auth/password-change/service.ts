import { prisma } from "@/lib/prisma";
import { sieLegacyCredentialService } from "@/modules/afiliaciones/asociados/Services/SieLegacyCredentialService";

export class PasswordChangeService {
  /**
   * Ejecuta el cambio obligatorio de contraseña del primer ingreso:
   * actualiza la credencial (bcrypt) y limpia mustChangePassword dentro de una
   * transacción, revocando las demás sesiones (la actual se conserva).
   */
  async execute(userId: number, newPassword: string, currentSessionId?: string): Promise<void> {
    await prisma.$transaction(async (tx) => {
      await sieLegacyCredentialService.completeFirstLoginPasswordChange(tx, userId, newPassword);
      if (currentSessionId) {
        await tx.userSession.updateMany({
          where: { userId, isRevoked: false, id: { not: currentSessionId } },
          data: { isRevoked: true, revokedAt: new Date(), revokeReason: "Contraseña actualizada." },
        });
      }
    });
  }
}

export const passwordChangeService = new PasswordChangeService();
