import { randomBytes } from 'crypto';
import { SessionError } from '../errors';
import { sessionRepository } from './repository';
import type { CreateSessionInput, SessionDTO } from './types';

export class SessionService {
  /**
   * Genera un Opaque Token de 256 bits (32 bytes) codificado en hexadecimal (64 chars).
   * Es computacionalmente inviable de predecir o colisionar.
   */
  private generateSecureSessionToken(): string {
    return randomBytes(32).toString('hex');
  }

  async createSession(data: CreateSessionInput): Promise<SessionDTO> {
    if (data.expiresAt <= new Date()) {
      throw new SessionError('La fecha de expiración de la sesión debe ser futura.');
    }

    const sessionToken = this.generateSecureSessionToken();
    return sessionRepository.create(sessionToken, data);
  }

  async getSessionById(sessionId: string): Promise<SessionDTO | null> {
    return sessionRepository.findById(sessionId);
  }

  isSessionValid(session: SessionDTO | null): boolean {
    if (!session) return false;
    if (session.isRevoked) return false;
    if (session.expiresAt <= new Date()) return false;
    return true;
  }

  async touchSession(sessionId: string): Promise<SessionDTO | null> {
    const session = await this.getSessionById(sessionId);
    if (!this.isSessionValid(session)) return null;

    const NOW = new Date();
    const FIVE_MINUTES_MS = 5 * 60 * 1000;
    
    if (NOW.getTime() - session!.lastActivityAt.getTime() > FIVE_MINUTES_MS) {
      return sessionRepository.updateActivity(sessionId, NOW);
    }

    return session;
  }

  async refreshSession(sessionId: string, newExpirationDate: Date): Promise<SessionDTO | null> {
    const session = await this.getSessionById(sessionId);
    if (!this.isSessionValid(session)) {
      throw new SessionError('No se puede extender una sesión inválida o revocada.');
    }

    if (newExpirationDate <= new Date()) {
      throw new SessionError('La nueva fecha de expiración debe ser futura.');
    }

    return sessionRepository.updateExpiration(sessionId, newExpirationDate);
  }

  async revokeSession(sessionId: string, reason?: string): Promise<SessionDTO | null> {
    const session = await this.getSessionById(sessionId);
    if (!session || session.isRevoked) return session;

    return sessionRepository.revoke(sessionId, reason);
  }

  async revokeAllSessions(userId: number, reason?: string, excludeSessionId?: string): Promise<number> {
    return sessionRepository.revokeAllByUserId(userId, reason, excludeSessionId);
  }

  async deleteExpiredSessions(): Promise<number> {
    return sessionRepository.deleteExpired(new Date());
  }
}

export const sessionService = new SessionService();