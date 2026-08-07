"use server";

import { signOut } from "@/lib/auth"; // Tu instancia de NextAuth
import { contextService } from "@/modules/auth/context/service";
import { sessionService } from "@/modules/auth/session/service";
import { securityService } from "@/modules/auth/security/service";
import { SecurityEventType } from "@prisma/client";

export async function logoutAction() {
    try {
        // 1. Obtener la sesión actual y el usuario antes de destruirla
        const session = await contextService.getCurrentSession();
        const user = await contextService.getCurrentUser();

        if (session && user) {
            // 2. Revocar la sesión en la base de datos (invalida el Opaque Token)
            await sessionService.revokeSession(session.id, "Cierre de sesión manual del usuario");
            
            // 3. Registrar en el log de auditoría de seguridad
            await securityService.recordEvent({
                userId: user.id,
                type: SecurityEventType.SESSION_REVOKED,
                // Opcional: podrías usar headers() para sacar la IP y el UserAgent aquí también
            });
        }
    } catch (error) {
        console.error("[Logout Error]:", error);
    }

    // 4. Destruir la cookie de NextAuth y redirigir al login
    // Al hacerlo desde el servidor, es mucho más seguro
    await signOut({ redirectTo: "/login" });
}