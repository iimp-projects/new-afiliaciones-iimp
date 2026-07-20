import bcrypt from 'bcryptjs';
import { loginRepository } from './repository';
import { securityService } from '../security';
import { sessionService } from '../session';
import { AuthenticationError, SecurityError } from '../errors';
import type { LoginInputDTO, LoginRequestMeta } from './types';

export class LoginService {
  async authenticate(
    credentials: LoginInputDTO,
    meta: LoginRequestMeta
  ): Promise<{ sessionId: string }> {
    
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