import type { NavigationNode } from "../Models/NavigationNode";
import type { IAuthorizationProvider } from "../Ports/IAuthorizationProvider";
import { navigationRegistry } from "../Registry/NavigationRegistry";

export class NavigationService {
    constructor(
        private readonly authProvider: IAuthorizationProvider
    ) {}

    public async getAuthorizedTree(): Promise<NavigationNode[]> {
        const rawTree = navigationRegistry.getRawNavigationTree();
        return await this.filterAndSortTree(rawTree);
    }

    private async filterAndSortTree(nodes: NavigationNode[]): Promise<NavigationNode[]> {
        const result: NavigationNode[] = [];

        for (const node of nodes) {
            // 1. Evaluar Permiso si el nodo lo requiere
            if (node.permission) {
                const hasAccess = await this.authProvider.hasPermission(
                    node.permission.action, 
                    node.permission.subject
                );
                
                if (!hasAccess) continue; // Poda la rama si no tiene permiso
            }

            const authorizedNode: NavigationNode = { ...node };

            // 2. Procesar hijos recursivamente
            if (node.children && node.children.length > 0) {
                const authorizedChildren = await this.filterAndSortTree(node.children);
                
                // 🛑 CORRECCIÓN DEL GRUPO FANTASMA:
                // Si este nodo es un "grupo" pero se quedó sin hijos tras filtrar los permisos, 
                // entonces NO lo agregamos a la navegación (lo omitimos por completo).
                if (authorizedNode.type === "group" && authorizedChildren.length === 0) {
                    continue;
                }
                
                authorizedNode.children = authorizedChildren.length > 0 ? authorizedChildren : undefined;
            }

            result.push(authorizedNode);
        }

        // 3. Ordenamiento por el campo `order`
        return result.sort((a, b) => (a.order ?? 9999) - (b.order ?? 9999));
    }
}