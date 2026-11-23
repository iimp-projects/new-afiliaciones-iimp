import { prisma } from '@/lib/prisma';
import { CredentialType } from '@prisma/client';

export class LoginRepository {
  private mustChangePasswordColumnAvailable: boolean | null = null;

  private async hasMustChangePasswordColumn(): Promise<boolean> {
    if (this.mustChangePasswordColumnAvailable !== null) {
      return this.mustChangePasswordColumnAvailable;
    }

    const rows = await prisma.$queryRawUnsafe<Array<{ exists: boolean }>>(
      `SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'auth_users'
          AND column_name = 'must_change_password'
      ) AS "exists"`,
    );
    this.mustChangePasswordColumnAvailable = rows[0]?.exists === true;
    return this.mustChangePasswordColumnAvailable;
  }

  /**
   * Obtiene el usuario y su credencial activa de tipo PASSWORD en una sola consulta.
   */
  async findUserWithPassword(email: string) {
    const select = {
      id: true,
      status: true,
      lockedUntil: true,
      credentials: {
        where: {
          type: CredentialType.PASSWORD,
          isActive: true,
        },
        take: 1,
        select: { secret: true },
      },
    };

    if (await this.hasMustChangePasswordColumn()) {
      return prisma.user.findUnique({
        where: { email },
        select: { ...select, mustChangePassword: true },
      });
    }

    return prisma.user.findUnique({
      where: { email },
      select,
    });
  }
}

export const loginRepository = new LoginRepository();
