import { cache } from "react";
import { NavigationService } from "./NavigationService";
import { AuthContextAdapter } from "../Adapters/AuthContextAdapter";
import { bootstrapNavigationModules } from "../Registry/Root.registry";

/**
 * MEMOIZACIÓN PER-REQUEST:
 * Garantiza que el árbol autorizado solo se procese UNA vez por request HTTP.
 */
export const getAuthorizedNavigation = cache(async () => {
    // 1. Aseguramos que los módulos (Security, etc.) estén registrados en el Composition Root
    bootstrapNavigationModules();

    // 2. Instanciamos el servicio inyectándole el adaptador real de tu Auth
    const adapter = new AuthContextAdapter();
    const navigationService = new NavigationService(adapter);

    // 3. Retornamos el árbol autorizado en el servidor
    return await navigationService.getAuthorizedTree();
});