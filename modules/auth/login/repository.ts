import { prisma } from '@/lib/prisma';
import { CredentialType } from '@prisma/client';

export class LoginRepository {
  /**
   * Obtiene el usuario y su credencial activa de tipo PASSWORD en una sola consulta.
   */
  async findUserWithPassword(email: string) {
    return prisma.user.findUnique({
      where: { email },
      include: {
        credentials: {
          where: {
            type: CredentialType.PASSWORD,
            isActive: true,
          },
          take: 1,
        },
      },
    });
  }
}

export const loginRepository = new LoginRepository();