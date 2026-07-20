// import { DefaultSession, DefaultUser } from "next-auth";
// import { JWT as DefaultJWT } from "next-auth/jwt";

// declare module "next-auth" {
//   interface Session {
//     sessionId: string;

//     user: {
//       id: string;
//       role?: string | null;
//       permissions?: string[];
//       personId?: string | null;
//       documentNumber?: string | null;
//       fullName?: string | null;
//     } & DefaultSession["user"];
//   }

//   interface User extends DefaultUser {
//     id: string;

//     role?: string | null;
//     permissions?: string[];
//     personId?: string | null;
//     documentNumber?: string | null;
//     fullName?: string | null;
//   }
// }

// declare module "next-auth/jwt" {
//   interface JWT extends DefaultJWT {
//     sessionId: string;

//     role?: string | null;
//     permissions?: string[];
//     personId?: string | null;
//     documentNumber?: string | null;
//     fullName?: string | null;
//   }
// }



import NextAuth, { type DefaultSession } from "next-auth";
import { JWT } from "next-auth/jwt";

declare module "next-auth" {
  /**
   * Extendemos la sesión predeterminada para incluir el identificador transaccional
   * (Opaque Token) generado por nuestro SessionService.
   */
  interface Session {
    sessionId: string;
    user: DefaultSession["user"];
  }

  interface User {
    id: string; // Garantizamos que id sea string, ya que mapeamos el sessionId aquí
  }
}

declare module "next-auth/jwt" {
  /**
   * Extendemos el JWT para almacenar temporalmente el sessionId 
   * durante el tránsito de la cookie.
   */
  interface JWT {
    sessionId?: string;
  }
}