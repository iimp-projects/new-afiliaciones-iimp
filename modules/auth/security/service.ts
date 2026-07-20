import { securityRepository } from './repository';
import { SecurityError } from '../errors';
import { SecurityEventType } from './types';
import type { CreateSecurityEventInput, SecurityRequestMeta } from './types';

const POLICY = {
  MAX_FAILED_ATTEMPTS: 5,
  LOCKOUT_DURATION_MINUTES: 15,
};

export class SecurityService {
  isAccountLocked(lockedUntil: Date | null): boolean {
    if (!lockedUntil) return false;
    return lockedUntil.getTime() > new Date().getTime();
  }

  async recordEvent(data: CreateSecurityEventInput) {
    return securityRepository.createEvent(data);
  }

  async handleLoginSuccess(userId: number, meta: SecurityRequestMeta): Promise<void> {
    await securityRepository.resetFailedAttemptsAndUpdateLogin(userId);
    
    await this.recordEvent({
      userId,
      type: SecurityEventType.LOGIN_SUCCESS,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      os: meta.os,
      browser: meta.browser,
    });
  }

  async handleLoginFailure(userId: number, meta: SecurityRequestMeta): Promise<void> {
    const attempts = await securityRepository.incrementFailedAttempts(userId);

    await this.recordEvent({
      userId,
      type: SecurityEventType.LOGIN_FAILED,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      os: meta.os,
      browser: meta.browser,
      metadata: { attempts },
    });

    if (attempts >= POLICY.MAX_FAILED_ATTEMPTS) {
      const lockedUntil = new Date();
      lockedUntil.setMinutes(lockedUntil.getMinutes() + POLICY.LOCKOUT_DURATION_MINUTES);

      await securityRepository.lockAccount(userId, lockedUntil);

      await this.recordEvent({
        userId,
        type: SecurityEventType.ACCOUNT_LOCKED,
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
        os: meta.os,
        browser: meta.browser,
        metadata: { 
          lockedUntil, 
          reason: 'Exceeded max failed login attempts',
          threshold: POLICY.MAX_FAILED_ATTEMPTS 
        },
      });

      throw new SecurityError(`Demasiados intentos fallidos. La cuenta ha sido bloqueada por ${POLICY.LOCKOUT_DURATION_MINUTES} minutos.`);
    }
  }
}

export const securityService = new SecurityService();