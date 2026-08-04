import { contextService } from "@/modules/auth/context/service";
import { ExpedientesWorkspace } from "@/modules/afiliaciones/expedientes/Views/ExpedientesWorkspace";
import { ExpedientesMockupView } from "@/modules/afiliaciones/expedientes/Views/ExpedientesMockupView";
export const metadata = {
    title: "Gestión de Expedientes | Intranet IIMP",
};

export default async function ExpedientesPage() {
    // Protección a nivel de Servidor. Solo usuarios autorizados.
    await contextService.requirePermission("read", "applications");

    return (
        <div className="h-full">
            {/* <ExpedientesWorkspace /> */}
            <ExpedientesMockupView />
        </div>
    );
}