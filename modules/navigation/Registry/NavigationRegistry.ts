// src/modules/navigation/registry/NavigationRegistry.ts
import type { ModuleDefinition } from "../Models/ModuleDefinition";
import type { NavigationNode } from "../Models/NavigationNode";
import type { IBreadcrumbResolver } from "../Ports/IBreadcrumbResolver";

export class NavigationRegistry {
    private modules: Map<string, ModuleDefinition> = new Map();

    public register(moduleDef: ModuleDefinition): void {
        if (this.modules.has(moduleDef.name)) {
            console.warn(`[NavigationRegistry] El módulo ${moduleDef.name} ya está registrado y será sobrescrito.`);
        }
        this.modules.set(moduleDef.name, moduleDef);
    }

    /**
     * Extrae y combina todos los nodos de navegación de los módulos registrados.
     * Retorna el árbol crudo (sin filtrar por permisos).
     */
    public getRawNavigationTree(): NavigationNode[] {
        const rawTree: NavigationNode[] = [];
        for (const moduleDef of this.modules.values()) {
            if (moduleDef.navigation && moduleDef.navigation.length > 0) {
                rawTree.push(...moduleDef.navigation);
            }
        }
        return rawTree;
    }

    /**
     * Retorna todos los resolvers de breadcrumbs registrados por los módulos.
     */
    public getBreadcrumbResolvers(): Record<string, IBreadcrumbResolver> {
        let resolvers: Record<string, IBreadcrumbResolver> = {};
        for (const moduleDef of this.modules.values()) {
            if (moduleDef.breadcrumbs) {
                resolvers = { ...resolvers, ...moduleDef.breadcrumbs };
            }
        }
        return resolvers;
    }
}

// Exportamos un Singleton interno para el uso del servidor
export const navigationRegistry = new NavigationRegistry();