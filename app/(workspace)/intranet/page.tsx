import { contextService } from "@/modules/auth/context/service";
import { DashboardWorkspace } from "@/modules/dashboard/Views/DashboardWorkspace"; 

export const metadata = {
    title: "Dashboard Institucional | Intranet IIMP",
};

export default async function IntranetDashboardPage() {
    const user = await contextService.requireAdministrativeUser();

    return (
        <div className="h-full">
            <DashboardWorkspace currentUser={user} />
        </div>
    );
}
