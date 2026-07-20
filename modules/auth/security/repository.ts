import { prisma } from '@/lib/prisma';
import type { CreateSecurityEventInput } from './types';




class SecurityRepository {

  async createEvent(data: CreateSecurityEventInput) {
    const metadataRecord: Record<string, any> = data.metadata ? { ...data.metadata } : {};
    if (data.os) metadataRecord.os = data.os;
    if (data.browser) metadataRecord.browser = data.browser;

    const event = await prisma.securityEvent.create({
      data: {
        userId: data.userId || null,
        type: data.type,
        ipAddress: data.ipAddress || null,
        userAgent: data.userAgent || null,
        metadata: Object.keys(metadataRecord).length > 0 ? metadataRecord : undefined,
      },
    });
    return event;
  }

  async incrementFailedAttempts(userId: number): Promise<number> {
    const user = await prisma.user.update({
      where: { id: userId },
      data: { failedLoginAttempts: { increment: 1 } },
      select: { failedLoginAttempts: true },
    });
    return user.failedLoginAttempts;
  }

  async lockAccount(userId: number, lockedUntil: Date): Promise<void> {
    await prisma.user.update({
      where: { id: userId },
      data: { lockedUntil },
    });
  }

  async unlockAccount(userId: number): Promise<void> {
    await prisma.user.update({
      where: { id: userId },
      data: { lockedUntil: null, failedLoginAttempts: 0 },
    });
  }

  async resetFailedAttemptsAndUpdateLogin(userId: number): Promise<void> {
    await prisma.user.update({
      where: { id: userId },
      data: { 
        failedLoginAttempts: 0, 
        lockedUntil: null, 
        lastLoginAt: new Date() 
      },
    });
  }
}

// Singleton de uso exclusivamente interno
export const securityRepository = new SecurityRepository();