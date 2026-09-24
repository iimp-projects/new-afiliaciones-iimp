// app/api/auth/session-expired/route.ts
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getAppBaseUrl } from "@/lib/config/env";

const SESSION_COOKIE_VARIANTS = [
  { name: "authjs.session-token", secure: false },
  { name: "__Secure-authjs.session-token", secure: true },
  { name: "next-auth.session-token", secure: false },
  { name: "__Secure-next-auth.session-token", secure: true },
] as const;

export async function GET() {
  const cookieStore = await cookies();

  // Eliminamos todas las variantes de cookies de Auth.js / NextAuth replicando
  // los atributos reales de la cookie. Para las variantes con prefijo "__Secure-"
  // es obligatorio incluir `Secure`: de lo contrario el navegador rechaza el
  // Set-Cookie y la cookie de sesión (aún criptográficamente válida) sobrevive,
  // provocando el loop /login -> /intranet -> /api/auth/session-expired.
  for (const { name, secure } of SESSION_COOKIE_VARIANTS) {
    cookieStore.set(name, "", {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure,
      maxAge: 0,
    });
  }

  // Usamos la URL pública canónica: `request.url` puede resolverse al bind
  // address interno (0.0.0.0:3000) en el servidor standalone.
  const url = new URL("/login", getAppBaseUrl());

  // Redirigimos al login, ya completamente limpios
  return NextResponse.redirect(url);
}
