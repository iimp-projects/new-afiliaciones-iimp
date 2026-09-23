import type { NextAuthConfig } from "next-auth";

/**
 * Decide explícitamente si Auth.js confía en el host de la petición.
 *
 * Detrás de un reverse proxy (ALB/CloudFront) el host debe confiarse solo
 * cuando hay una URL pública configurada (AUTH_URL) o cuando se declara
 * AUTH_TRUST_HOST. En producción sin ninguna de las dos, Auth.js rechazaría
 * el host (UntrustedHost), lo cual es el comportamiento deseado.
 */
export function resolveTrustHost(env: Record<string, string | undefined> = process.env): boolean {
  if (env.AUTH_TRUST_HOST === "true") return true;
  if (env.AUTH_TRUST_HOST === "false") return false;
  if (env.AUTH_URL) return true;
  return env.NODE_ENV !== "production";
}

export const authConfig = {
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 24 * 60 * 60, // 24 horas
  },
  trustHost: resolveTrustHost(),
  providers: [], // Array vacío por defecto; se inyectarán los de Node en auth.ts
  callbacks: {
    async jwt({ token, user }) {
      // Si hay un usuario (sucede al iniciar sesión), guardamos el Opaque Token
      if (user?.id) {
        token.sessionId = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      // Exponemos el sessionId del token hacia el objeto de sesión para el ContextService
      if (token.sessionId) {
        session.sessionId = token.sessionId;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;