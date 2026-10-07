import type { ReactNode } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { contextService } from "@/modules/auth/context/service";
import {
    AFFILIATE_PROFILE_ONLY_ROUTE,
    isAffiliateProfileOnlyRestrictedRoute,
} from "@/lib/security/affiliate-profile-only";

export default async function AssociatePortalLayout({ children }: { children: ReactNode }) {
    await contextService.requireAffiliate();

    // R70: en modo "solo perfil" bloqueamos el acceso directo a las secciones
    // del portal del asociado, redirigiendo siempre a su perfil.
    const pathname = (await headers()).get("x-pathname") ?? "";
    if (isAffiliateProfileOnlyRestrictedRoute(pathname)) {
        redirect(AFFILIATE_PROFILE_ONLY_ROUTE);
    }

    return children;
}
