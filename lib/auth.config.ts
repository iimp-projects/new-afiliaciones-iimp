import type { NextAuthConfig } from "next-auth";

export const authConfig = {
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 24 * 60 * 60, // 24 horas
  },
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