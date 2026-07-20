import { prisma } from '@/lib/prisma';
import type { SessionDTO, CreateSessionInput } from './types';
import type { UserSession } from '@prisma/client';

// Mapper interno para aislar Prisma de la capa superior
const mapToDTO = (record: UserSession): SessionDTO => ({
  id: record.id,
  userId: record.userId,
  ipAddress: record.ipAddress,
  userAgent: record.userAgent,
  os: record.os,
  browser: record.browser,
  expiresAt: record.expiresAt,
  lastActivityAt: record.lastActivityAt,
  isRevoked: record.isRevoked,
  revokedAt: record.revokedAt,
  revokeReason: record.revokeReason,
  createdAt: record.createdAt,
  updatedAt: record.updatedAt,
});

class SessionRepository {
  async create(token: string, data: CreateSessionInput): Promise<SessionDTO> {
    const session = await prisma.userSession.create({
      data: {
        id: token, // Sobrescribimos el uuid() por el token seguro generado
        userId: data.userId,
        expiresAt: data.expiresAt,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
        os: data.os,
        browser: data.browser,
      },
    });
    return mapToDTO(session);
  }

  async findById(id: string): Promise<SessionDTO | null> {
    const session = await prisma.userSession.findUnique({
      where: { id },
    });
    return session ? mapToDTO(session) : null;
  }

  async findActiveByUserId(userId: number): Promise<SessionDTO[]> {
    const sessions = await prisma.userSession.findMany({
      where: {
        userId,
        isRevoked: false,
        expiresAt: { gt: new Date() },
      },
      orderBy: { lastActivityAt: 'desc' },
    });
    return sessions.map(mapToDTO);
  }

  async updateActivity(id: string, date: Date): Promise<SessionDTO> {
    const session = await prisma.userSession.update({
      where: { id },
      data: { lastActivityAt: date },
    });
    return mapToDTO(session);
  }

  async updateExpiration(id: string, date: Date): Promise<SessionDTO> {
    const session = await prisma.userSession.update({
      where: { id },
      data: { expiresAt: date },
    });
    return mapToDTO(session);
  }

  async revoke(id: string, reason?: string): Promise<SessionDTO> {
    const session = await prisma.userSession.update({
      where: { id },
      data: {
        isRevoked: true,
        revokedAt: new Date(),
        revokeReason: reason,
      },
    });
    return mapToDTO(session);
  }

  async revokeAllByUserId(userId: number, reason?: string, excludeSessionId?: string): Promise<number> {
    const result = await prisma.userSession.updateMany({
      where: {
        userId,
        isRevoked: false,
        id: excludeSessionId ? { not: excludeSessionId } : undefined,
      },
      data: {
        isRevoked: true,
        revokedAt: new Date(),
        revokeReason: reason,
      },
    });
    return result.count;
  }

  async deleteExpired(date: Date): Promise<number> {
    const result = await prisma.userSession.deleteMany({
      where: { expiresAt: { lt: date } },
    });
    return result.count;
  }
}

// Singleton de uso exclusivamente interno
export const sessionRepository = new SessionRepository();