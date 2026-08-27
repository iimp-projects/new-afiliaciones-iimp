import type { ReactNode } from "react";
import { contextService } from "@/modules/auth/context/service";
import { getAuthorizedNavigation } from "@/modules/navigation/Services/getAuthorizedNavigation";
import { MainLayout } from "@/modules/layout/Components/MainLayout/MainLayout";
// ✅ Importamos ÚNICAMENTE nuestro Toaster personalizado
import { AppToaster } from "@/modules/shared/Components/AppToaster/AppToaster"; 

export default async function intranetLayout({ children }: { children: ReactNode }) {
    const user = await contextService.requireAuth();
    const navigationTree = await getAuthorizedNavigation();

    return (
        <>
            {/* ✅ El ÚNICO Toaster de toda la aplicación */}
            <AppToaster />

            <MainLayout navigationTree={navigationTree} user={user}>
                {children}
            </MainLayout>
        </>
    );
}