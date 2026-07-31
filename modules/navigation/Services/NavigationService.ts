/**
 * IMPORTANTE
 *
 * Este servicio NO debe conocer:
 *
 * - React
 * - Next.js
 * - Tailwind
 * - Prisma
 * - Auth.js
 * - Cookies
 * - Session
 *
 * Su única responsabilidad es construir
 * el árbol de navegación autorizado.
 *
 */
import type { NavigationNode } from "../Models/NavigationNode";
import type { IAuthorizationProvider } from "../Ports/IAuthorizationProvider";
import { navigationRegistry } from "../Registry/NavigationRegistry";

export class NavigationService {
    constructor(
        private readonly authProvider: IAuthorizationProvider
    ) {}

    /**
     * Construye el árbol de navegación autorizado y ordenado.
     */
    public async getAuthorizedTree(): Promise<NavigationNode[]> {
        const rawTree = navigationRegistry.getRawNavigationTree();
        return await this.filterAndSortTree(rawTree);
    }

    /**
     * Algoritmo recursivo para podar nodos no autorizados.
     */
    private async filterAndSortTree(nodes: NavigationNode[]): Promise<NavigationNode[]> {
        const result: NavigationNode[] = [];

        for (const node of nodes) {
            // 1. Evaluar Permiso si existe
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
                authorizedNode.children = authorizedChildren.length > 0 ? authorizedChildren : undefined;
            }

            result.push(authorizedNode);
        }

        // 3. Ordenamiento por el campo `order`
        return result.sort((a, b) => (a.order ?? 9999) - (b.order ?? 9999));
    }
}