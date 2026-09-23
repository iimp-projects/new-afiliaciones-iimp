import { contextService } from "@/modules/auth/context/service";
import { isAffiliateUser } from "@/modules/auth/context/types";
import type { IAuthorizationProvider } from "../Ports/IAuthorizationProvider";

export class AuthContextAdapter implements IAuthorizationProvider {
    /**
     * Delega la verificación de permisos al ContextService real de tu app.
     * Utiliza la búsqueda O(1) en el Set<string> de permisos del usuario logueado.
     */
    public async hasPermission(action: string, subject: string): Promise<boolean> {
        return await contextService.hasPermission(action, subject);
    }

    public async isAffiliate(): Promise<boolean> {
        const user = await contextService.getCurrentUser();
        return Boolean(user && isAffiliateUser(user));
    }
}
