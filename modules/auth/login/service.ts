import bcrypt from 'bcryptjs';
import { loginRepository } from './repository';
import { securityService } from '../security';
import { sessionService } from '../session';
import { verificationTokenRateLimiter } from '../rate-limit/VerificationTokenRateLimiter';
import { AuthenticationError, SecurityError } from '../errors';
import type { LoginInputDTO, LoginRequestMeta } from './types';

const LOGIN_IP_LIMIT = 20;
const LOGIN_IP_WINDOW_MINUTES = 15;

function normalizeIpAddress(ipAddress?: string | null): string {
  return ipAddress?.split(',')[0]?.trim() || 'unknown';
}

export class LoginService {
  async authenticate(
    credentials: LoginInputDTO,
    meta: LoginRequestMeta
  ): Promise<{ sessionId: string }> {
    // Rate limiting por IP: coexiste con el lockout por cuenta.
    const ipAddress = normalizeIpAddress(meta.ipAddress);
    const ipAllowed = await verificationTokenRateLimiter.consume(
      'login:ip',
      ipAddress,
      LOGIN_IP_LIMIT,
      LOGIN_IP_WINDOW_MINUTES,
    );
    if (!ipAllowed) {
      throw new SecurityError('Demasiados intentos de acceso. Intente nuevamente más tarde.');
    }

    const user = await loginRepository.findUserWithPassword(credentials.email);


    if (!user) {
      throw new AuthenticationError('Credenciales inválidas.');
    }

    if (securityService.isAccountLocked(user.lockedUntil)) {
      throw new SecurityError('La cuenta se encuentra bloqueada por exceso de intentos fallidos. Intente más tarde.');
    }

    if (user.status !== 'ACTIVE') {
      throw new AuthenticationError('La cuenta no se encuentra activa.');
    }

    const activeCredential = user.credentials[0];
    if (!activeCredential) {
      throw new AuthenticationError('Credenciales inválidas.');
    }

    const isPasswordValid = await bcrypt.compare(credentials.password, activeCredential.secret);

    if (!isPasswordValid) {
      // Se delega el meta directo gracias al tipado estructural
      await securityService.handleLoginFailure(user.id, meta);
      throw new AuthenticationError('Credenciales inválidas.');
    }

    // Se delega el meta directo
    await securityService.handleLoginSuccess(user.id, meta);

    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    const session = await sessionService.createSession({
      userId: user.id,
      expiresAt,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      os: meta.os,
      browser: meta.browser,
    });

    return { sessionId: session.id };
  }
}

export const loginService = new LoginService();