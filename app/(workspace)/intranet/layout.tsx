import type { ReactNode } from "react";
import { contextService } from "@/modules/auth/context/service";
import { getAuthorizedNavigation } from "@/modules/navigation/Services/getAuthorizedNavigation";
import { MainLayout } from "@/modules/layout/Components/MainLayout/MainLayout";

export default async function intranetLayout({ children }: { children: ReactNode }) {
    // 1. Exigimos autenticación con tu infraestructura existente de Auth
    const user = await contextService.requireAuth();

    // 2. Obtenemos el árbol de navegación autorizado en el servidor (Memoizado con cache)
    const navigationTree = await getAuthorizedNavigation();

    // 3. Renderizamos el esqueleto visual corporativo pasando los datos limpios
    return (
        <MainLayout navigationTree={navigationTree} user={user}>
            {children}
        </MainLayout>
    );
}