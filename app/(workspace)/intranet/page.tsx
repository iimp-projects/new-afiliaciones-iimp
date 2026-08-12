import { contextService } from "@/modules/auth/context/service";
// Fíjate que aquí importamos el cliente desde la carpeta que creaste
import { DashboardClient } from "./dashboard/DashboardClient"; 

export const metadata = {
    title: "Dashboard Institucional | Intranet IIMP",
};

export default async function IntranetDashboardPage() {
    // Exigimos autenticación y obtenemos los datos del usuario real
    const user = await contextService.requireAuth();

    return (
        <div className="h-full">
            {/* Aquí inyectamos el componente visual que creaste */}
            <DashboardClient currentUser={user} />
        </div>
    );
}