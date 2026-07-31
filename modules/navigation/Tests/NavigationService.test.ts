// src/modules/navigation/Tests/NavigationService.test.ts
import { describe, it, expect, beforeAll } from "vitest";
import { NavigationService } from "../Services/NavigationService";
import type { IAuthorizationProvider } from "../Ports/IAuthorizationProvider";
import { bootstrapNavigationModules } from "../Registry/Root.registry";

// 1. MOCK: Simulamos el ContextService
class MockAuthProvider implements IAuthorizationProvider {
    constructor(private allowedPermissions: Set<string>) {}

    async hasPermission(action: string, subject: string): Promise<boolean> {
        if (this.allowedPermissions.has("manage:all")) return true;
        return this.allowedPermissions.has(`${action}:${subject}`);
    }
}

// 2. SETUP: Cargamos el Registry
beforeAll(() => {
    bootstrapNavigationModules();
});

describe("NavigationService - Application Service", () => {
    
    it("Debe retornar el árbol completo para un Super Administrador", async () => {
        const superAdminProvider = new MockAuthProvider(new Set(["manage:all"]));
        const service = new NavigationService(superAdminProvider);

        const tree = await service.getAuthorizedTree();
        const securityNode = tree.find(node => node.id === "nav-security-root");

        expect(securityNode).toBeDefined();
        expect(securityNode?.children?.length).toBe(3); 
    });

    it("Debe podar las rutas no autorizadas para un usuario limitado", async () => {
        const limitedProvider = new MockAuthProvider(new Set(["read:users"]));
        const service = new NavigationService(limitedProvider);

        const tree = await service.getAuthorizedTree();
        const securityNode = tree.find(node => node.id === "nav-security-root");

        expect(securityNode).toBeDefined();
        expect(securityNode?.children?.length).toBe(1);
        expect(securityNode?.children?.[0].id).toBe("nav-security-users");
    });

    it("Debe eliminar el nodo padre si no tiene hijos autorizados", async () => {
        const noSecurityProvider = new MockAuthProvider(new Set(["read:dashboard"]));
        const service = new NavigationService(noSecurityProvider);

        const tree = await service.getAuthorizedTree();
        const securityNode = tree.find(node => node.id === "nav-security-root");

        expect(securityNode?.children).toBeUndefined();
    });
});