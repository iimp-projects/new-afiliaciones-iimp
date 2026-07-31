import { navigationRegistry } from "./NavigationRegistry";

// Importamos la configuración del módulo piloto
import { securityModuleDefinition } from "@/modules/security/Config/Navigation";

let isInitialized = false;

export function bootstrapNavigationModules() {
    if (isInitialized) return;

    // Registramos los módulos independientes
    navigationRegistry.register(securityModuleDefinition);

    isInitialized = true;
    console.log("[Navigation] Composition Root inicializado: Módulos registrados.");
}