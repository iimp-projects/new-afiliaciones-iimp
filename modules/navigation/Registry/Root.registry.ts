import { navigationRegistry } from "./NavigationRegistry";

// Importamos la configuración del módulo piloto
import { securityModuleDefinition } from "@/modules/security/Config/Navigation";
import { communicationsModuleDefinition } from "@/modules/communications/Config/Navigation";

let isInitialized = false;

export function bootstrapNavigationModules() {
    if (isInitialized) return;

    // Registramos los módulos independientes
    navigationRegistry.register(securityModuleDefinition);
    navigationRegistry.register(communicationsModuleDefinition);

    isInitialized = true;
    console.log("[Navigation] Composition Root inicializado: Módulos registrados.");
}