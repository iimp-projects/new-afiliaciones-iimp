import { contextService } from "@/modules/auth/context/service";
import { ExpedientesWorkspace } from "@/modules/afiliaciones/expedientes/Views/ExpedientesWorkspace";

export const metadata = {
    title: "Gestión de Expedientes | Intranet IIMP",
};

export default async function ExpedientesPage() {
    // 1. Verificamos el permiso general
    await contextService.requirePermission("read", "applications");
    
    // 2. Obtenemos al usuario real conectado (Ej: Rosa León)
    const user = await contextService.getCurrentUser();

    return (
        <div className="h-full">
            {/* 3. Le pasamos el usuario al componente cliente */}
            <ExpedientesWorkspace currentUser={user} />
        </div>
    );
}