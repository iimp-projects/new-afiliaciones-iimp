// app/api/auth/session-expired/route.ts
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getAppBaseUrl } from "@/lib/config/env";

export async function GET() {
  const cookieStore = await cookies();

  // Borramos todas las posibles variantes de cookies de Auth.js / NextAuth
  cookieStore.delete("authjs.session-token");
  cookieStore.delete("__Secure-authjs.session-token");
  cookieStore.delete("next-auth.session-token");
  cookieStore.delete("__Secure-next-auth.session-token");

  // Usamos la URL pública canónica: `request.url` puede resolverse al bind
  // address interno (0.0.0.0:3000) en el servidor standalone.
  const url = new URL("/login", getAppBaseUrl());

  // Redirigimos al login, ya completamente limpios
  return NextResponse.redirect(url);
}