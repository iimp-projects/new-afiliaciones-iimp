import type { ModuleDefinition } from "@/modules/navigation/Models/ModuleDefinition";

export const securityModuleDefinition: ModuleDefinition = {
    name: "security",
    description: "Módulo de gestión de accesos y auditoría",
    navigation: [
        {
            id: "group-main",
            title: "MENÚ PRINCIPAL",
            type: "group", // <-- Esto pinta el título de sección
            order: 10,
            children: [
                {
                    id: "nav-security-users",
                    title: "Panel Principal",
                    href: "/intranet",
                    icon: "LayoutDashboard",
                    order: 1,
                },
                {
                    id: "nav-security-roles-list",
                    title: "Usuarios y Accesos",
                    href: "/workspace/seguridad/usuarios",
                    icon: "Users",
                    order: 2,
                    permission: { action: "read", subject: "users" }
                }
            ]
        },
        // --- NUEVA SECCI N: GESTI N DE AFILIACIONES ---
        {
            id: "group-afiliaciones",
            title: "GESTIÓN DE AFILIACIONES",
            type: "group", // Esto activa el dise o est tico de cabecera en el Sidebar
            order: 15,
            children: [
                {
                    id: "nav-afiliaciones-expedientes",
                    title: "Expedientes",
                    href: "/intranet/expedientes", // Ajusta la ruta seg n tu proyecto
                    icon: "FolderOpen", // Icono est tico de Lucide
                    order: 1,
                    // Filtro exacto para ATENCION_ASOCIADO basado en tus seeds
                    permission: { action: "read", subject: "applications" } 
                },
                {
                    id: "nav-afiliaciones-asociados",
                    title: "Asociados",
                    href: "#", // Ajusta la ruta seg n tu proyecto
                    icon: "UserCheck", // Icono est tico de Lucide
                    order: 2,
                    // Filtro exacto para ATENCION_ASOCIADO basado en tus seeds
                    permission: { action: "read", subject: "memberships" } 
                }
            ]
        },
        {
            id: "group-admin",
            title: "ADMINISTRACIÓN",
            type: "group", // <-- Otra sección del menú
            order: 20,
            children: [
                {
                    id: "nav-security-roles",
                    title: "Roles y Permisos",
                    href: "/workspace/seguridad/roles",
                    icon: "KeyRound",
                    order: 1,
                    permission: { action: "read", subject: "roles" }
                },
                {
                    id: "nav-security-audit",
                    title: "Auditoría del Sistema",
                    href: "/workspace/seguridad/auditoria",
                    icon: "Activity",
                    order: 2,
                    permission: { action: "read", subject: "audit" }
                }
            ]
        }
    ]
};