import { DefaultSession, DefaultUser } from "next-auth";
import { JWT as DefaultJWT } from "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    sessionId: string;

    user: {
      id: string;
      role?: string | null;
      permissions?: string[];
      personId?: string | null;
      documentNumber?: string | null;
      fullName?: string | null;
    } & DefaultSession["user"];
  }

  interface User extends DefaultUser {
    id: string;

    role?: string | null;
    permissions?: string[];
    personId?: string | null;
    documentNumber?: string | null;
    fullName?: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT extends DefaultJWT {
    sessionId: string;

    role?: string | null;
    permissions?: string[];
    personId?: string | null;
    documentNumber?: string | null;
    fullName?: string | null;
  }
}