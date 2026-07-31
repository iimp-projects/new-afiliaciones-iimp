// src/modules/navigation/ports/IAuthorizationProvider.ts

export interface IAuthorizationProvider {
    /**
     * Evalúa si el usuario en el contexto actual posee el permiso requerido.
     */
    hasPermission(action: string, subject: string): Promise<boolean>;
}