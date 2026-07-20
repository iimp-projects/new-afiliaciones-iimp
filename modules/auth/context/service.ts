import { cache } from 'react';
import { redirect } from 'next/navigation';
import { sessionService, type SessionDTO } from '../session';
import { AuthenticationError, AuthorizationError } from '../errors';
import { contextRepository } from './repository';
import { authAdapter } from './adapter';
import type { CurrentUserDTO } from './types';

class ContextService {
  /**
   * MEMOIZACIÓN PER-REQUEST:
   * React cache() garantiza que, sin importar cuántos Server Components o Server Actions
   * llamen a getCurrentSession() durante el MISMO ciclo de request HTTP,
   * la validación y la consulta a la BD se ejecutarán exactamente UNA vez.
   * NO es un caché global y NO comparte estado entre distintos usuarios o peticiones.
   */
  public getCurrentSession = cache(async (): Promise<SessionDTO | null> => {
    const sessionId = await authAdapter.getSessionIdFromJWT();
    if (!sessionId) return null;

    const session = await sessionService.getSessionById(sessionId);
    
    // Validación remota en tiempo real (Revocación / Expiración)
    if (!sessionService.isSessionValid(session)) return null;

    return session;
  });

  /**
   * MEMOIZACIÓN PER-REQUEST:
   * Hidrata y devuelve el usuario autenticado actual.
   */
  public getCurrentUser = cache(async (): Promise<CurrentUserDTO | null> => {
    const session = await this.getCurrentSession();
    if (!session) return null;

    return contextRepository.getHydratedUser(session.userId);
  });

  /**
   * Helper garantista para Server Actions y Pages protegidas.
   * Si no hay sesión válida, detiene la ejecución y redirige al login inmediatamente.
   */
  public requireAuth = async (): Promise<CurrentUserDTO> => {
    const user = await this.getCurrentUser();
    if (!user) {
      // redirect() en Next.js App Router arroja un error interno (NEXT_REDIRECT)
      // que cancela la ejecución del código subyacente de forma segura.
      redirect('/login');
    }
    
    if (user.status !== 'ACTIVE') {
      throw new AuthenticationError('Tu cuenta no se encuentra activa.');
    }

    return user;
  };

  /**
   * Evalúa si el usuario actual posee uno de los roles indicados.
   */
  public hasRole = async (roleSlugs: string[]): Promise<boolean> => {
    const user = await this.getCurrentUser();
    if (!user) return false;
    return roleSlugs.includes(user.role.slug);
  };

  /**
   * Detiene la ejecución si el usuario no posee el rol requerido.
   */
  public requireRole = async (roleSlugs: string[]): Promise<void> => {
    const has = await this.hasRole(roleSlugs);
    if (!has) {
      throw new AuthorizationError('No tienes el nivel de acceso necesario para realizar esta acción.');
    }
  };

  /**
   * Evalúa RBAC en O(1). Soporta comodín de super administrador ("manage:all").
   */
  public hasPermission = async (action: string, subject: string): Promise<boolean> => {
    const user = await this.getCurrentUser();
    if (!user) return false;

    // Privilegio absoluto de administración
    if (user.permissions.has('manage:all')) return true;

    return user.permissions.has(`${action}:${subject}`);
  };

  /**
   * Detiene la ejecución si el usuario no posee el permiso exacto.
   */
  public requirePermission = async (action: string, subject: string): Promise<void> => {
    const has = await this.hasPermission(action, subject);
    if (!has) {
      throw new AuthorizationError(`Permiso denegado: se requiere el privilegio [${action}] sobre [${subject}].`);
    }
  };
}

export const contextService = new ContextService();