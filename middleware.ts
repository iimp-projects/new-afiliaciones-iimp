// middleware.ts (en la raíz)
import { auth } from "@/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const { nextUrl } = req;
  const path = nextUrl.pathname;

  // 1. Logs de depuración (MIRA TU TERMINAL AL RECARGAR)
  console.log("🔍 Middleware Debug:", { path, isLoggedIn });

  // 2. Definimos las rutas públicas
  const isAuthRoute = path === "/login" || path === "/recuperar-password";
  const isBackofficeRoute = path.startsWith("/backoffice");
  const isIntranetRoute = path.startsWith("/intranet");

  // 3. SI EL USUARIO ESTÁ EN LOGIN
  if (isAuthRoute) {
    if (isLoggedIn) {
      // Si ya está logueado, no lo dejes en login, mándalo a su panel
      const userRole = (req.auth?.user as any)?.role;
      const isAdmin = ["SUPER_ADMIN", "LOGISTICA", "LEGAL", "COMUNICACIONES"].includes(userRole);
      return NextResponse.redirect(new URL(isAdmin ? "/backoffice" : "/intranet", nextUrl));
    }
    // Si NO está logueado, déjalo cargar el login
    return NextResponse.next();
  }

  // 4. SI EL USUARIO NO ESTÁ LOGUEADO Y QUIERE ENTRAR A ZONAS PRIVADAS
  if (!isLoggedIn && (isBackofficeRoute || isIntranetRoute)) {
    return NextResponse.redirect(new URL("/login", nextUrl));
  }

  // 5. PROTECCIÓN DE ROL (Backoffice solo para Staff)
  if (isLoggedIn && isBackofficeRoute) {
    const userRole = (req.auth?.user as any)?.role;
    const isStaff = ["SUPER_ADMIN", "LOGISTICA", "LEGAL", "COMUNICACIONES"].includes(userRole);
    
    if (!isStaff) {
      return NextResponse.redirect(new URL("/intranet", nextUrl));
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|images).*)"],
};