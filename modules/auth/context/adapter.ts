import { auth } from '@/lib/auth';

export class AuthJSAdapter {
  /**
   * Extrae exclusivamente el identificador de la sesión transaccional (Opaque Token)
   * desde el payload del JWT desencriptado por Auth.js.
   */
  async getSessionIdFromJWT(): Promise<string | null> {
    try {
      const session = await auth();
      
      // Accedemos al sessionId inyectado en el callback de sesión definido en lib/auth.ts.
      // Utilizamos cast 'any' temporalmente para acceder a la propiedad extendida de la sesión.
      return (session as any)?.sessionId || null;
    } catch {
      return null;
    }
  }
}

export const authAdapter = new AuthJSAdapter();