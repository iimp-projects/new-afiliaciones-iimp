// app/api/auth/session-expired/route.ts
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const cookieStore = await cookies();

  // Borramos todas las posibles variantes de cookies de Auth.js / NextAuth
  cookieStore.delete("authjs.session-token");
  cookieStore.delete("__Secure-authjs.session-token");
  cookieStore.delete("next-auth.session-token");
  cookieStore.delete("__Secure-next-auth.session-token");

  // Obtenemos la URL base (localhost o tu dominio en producci n)
  const url = new URL("/login", request.url);

  // Redirigimos al login, ya completamente limpios
  return NextResponse.redirect(url);
}