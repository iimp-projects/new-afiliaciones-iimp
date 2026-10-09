import { randomBytes } from 'crypto';
import { SessionError } from '../errors';
import { sessionRepository } from './repository';
import type { CreateSessionInput, SessionDTO, SessionStatusDTO } from './types';

export const SESSION_IDLE_TIMEOUT_MS = 30 * 60 * 1000;
export const SESSION_ACTIVITY_THROTTLE_MS = 5 * 60 * 1000;

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

  // isSessionValid(session: SessionDTO | null): boolean {
  //   if (!session) return false;
  //   if (session.isRevoked) return false;
  //   if (session.expiresAt <= new Date()) return false;
  //   return true;
  // }

  isSessionValid(session: SessionDTO | null): boolean {
    if (!session) return false;
    if (session.isRevoked) return false;
    if (session.expiresAt <= new Date()) return false;

    // NUEVO: Validar inactividad (Ejemplo: 30 minutos)
    const NOW = new Date().getTime();
    if (NOW - session.lastActivityAt.getTime() > SESSION_IDLE_TIMEOUT_MS) {
        return false; // La sesión caducó por inactividad
    }

    return true;
}

  async touchSession(sessionId: string): Promise<SessionDTO | null> {
    const session = await this.getSessionById(sessionId);
    if (!this.isSessionValid(session)) return null;

    const NOW = new Date();
    
    if (NOW.getTime() - session!.lastActivityAt.getTime() > SESSION_ACTIVITY_THROTTLE_MS) {
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

  /**
   * Calcula el vencimiento efectivo sin mutar la sesión. Es el único dato de
   * sesión que se expone al navegador mediante el endpoint de estado.
   */
  getSessionStatus(session: SessionDTO | null, now = new Date()): SessionStatusDTO {
    if (!session || !this.isSessionValid(session)) {
      return { valid: false, serverNow: now, expiresAt: null, lastActivityAt: null, effectiveExpiresAt: null, expiryReason: null };
    }

    const idleExpiresAt = new Date(session.lastActivityAt.getTime() + SESSION_IDLE_TIMEOUT_MS);
    const expiryReason = session.expiresAt <= idleExpiresAt ? "ABSOLUTE" : "IDLE";
    return {
      valid: true,
      serverNow: now,
      expiresAt: session.expiresAt,
      lastActivityAt: session.lastActivityAt,
      effectiveExpiresAt: expiryReason === "ABSOLUTE" ? session.expiresAt : idleExpiresAt,
      expiryReason,
    };
  }

  /** Registra actividad humana; nunca amplía el límite absoluto expiresAt. */
  async registerActivity(sessionId: string): Promise<SessionStatusDTO> {
    const before = await this.getSessionById(sessionId);
    if (!before || !this.isSessionValid(before)) return this.getSessionStatus(null);

    const now = new Date();
    const session = now.getTime() - before.lastActivityAt.getTime() > SESSION_ACTIVITY_THROTTLE_MS
      ? await sessionRepository.updateActivity(sessionId, now)
      : before;
    return this.getSessionStatus(session, now);
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
