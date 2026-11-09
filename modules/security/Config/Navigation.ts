import type { ModuleDefinition } from "@/modules/navigation/Models/ModuleDefinition";

export const securityModuleDefinition: ModuleDefinition = {
    name: "security",
    description: "Módulo de gestión de accesos y auditoría",
    navigation: [
        // --- DASHBOARD (sección fija, siempre visible) ---
        {
            id: "group-dashboard",
            title: "Dashboard",
            type: "group",
            audience: "administrative",
            order: 10,
            children: [
                {
                    id: "nav-dashboard",
                    title: "Panel Principal",
                    href: "/intranet",
                    icon: "LayoutDashboard",
                    order: 1,
                }
            ]
        },
        // --- GESTIÓN DE AFILIACIONES ---
        {
            id: "group-afiliaciones",
            title: "Gestión de Afiliaciones",
            type: "group",
            collapsible: true,
            icon: "FolderOpen",
            audience: "administrative",
            order: 15,
            children: [
                {
                    id: "nav-afiliaciones-expedientes",
                    title: "Expedientes",
                    href: "/intranet/expedientes",
                    icon: "FolderOpen",
                    order: 1,
                    permission: { action: "read", subject: "applications" }
                },
                {
                    id: "nav-afiliaciones-asociados",
                    title: "Asociados",
                    href: "/intranet/asociados",
                    icon: "UserCheck",
                    order: 2,
                    permission: { action: "read", subject: "associates" }
                }
            ]
        },
        // --- EVENTOS ---
        {
            id: "group-eventos",
            title: "Eventos",
            type: "group",
            collapsible: true,
            icon: "CalendarDays",
            audience: "administrative",
            order: 18,
            children: [
                {
                    id: "nav-sie-enrollments",
                    title: "Inscripciones",
                    href: "/intranet/sie/inscripciones",
                    icon: "ClipboardList",
                    order: 1,
                    permission: { action: "manage", subject: "all" }
                }
            ]
        },
        // --- ADMINISTRACIÓN ---
        {
            id: "group-administracion",
            title: "Administración",
            type: "group",
            collapsible: true,
            icon: "Settings",
            audience: "administrative",
            order: 25,
            children: [
                {
                    id: "nav-security-users",
                    title: "Usuarios del Sistema",
                    href: "/intranet/security/users",
                    icon: "Users",
                    order: 1,
                    permission: { action: "read", subject: "users" }
                },
                {
                    id: "nav-security-roles",
                    title: "Roles y Permisos",
                    href: "/intranet/security/roles",
                    icon: "KeyRound",
                    order: 2,
                    visibility: "hidden",
                    permission: { action: "read", subject: "roles" }
                },
                {
                    id: "nav-security-audit",
                    title: "Auditoría del Sistema",
                    href: "/intranet/security/audit",
                    icon: "Activity",
                    order: 3,
                    visibility: "hidden",
                    permission: { action: "read", subject: "audit" }
                },
                {
                    id: "nav-security-system-settings",
                    title: "Configuración de pagos",
                    href: "/intranet/security/system-settings",
                    icon: "Settings",
                    order: 4,
                    permission: { action: "manage", subject: "all" }
                },
                {
                    id: "nav-master-data",
                    title: "Datos Académicos",
                    href: "/intranet/master-data",
                    icon: "Database",
                    order: 5,
                    permission: { action: "read", subject: "catalogs" }
                }
            ]
        },
        // --- MENÚ DE ASOCIADO (sin cambios) ---
        {
            id: "group-affiliate-main",
            title: "MENÚ PRINCIPAL",
            type: "group",
            audience: "affiliate",
            order: 10,
            children: [{ id: "nav-affiliate-home", title: "Inicio", href: "/intranet/mi-cuenta", icon: "LayoutDashboard", order: 1 }],
        },
        {
            id: "group-affiliate-account",
            title: "MI CUENTA",
            type: "group",
            audience: "affiliate",
            order: 15,
            children: [
                { id: "nav-affiliate-profile", title: "Mi perfil", href: "/intranet/mi-cuenta/perfil", icon: "UserRound", order: 1 },
                { id: "nav-affiliate-carnet", title: "Mi carnet virtual", href: "/intranet/mi-cuenta/carnet", icon: "IdCard", order: 2, visibility: "hidden" },
                { id: "nav-affiliate-membership", title: "Mi membresía", href: "/intranet/mi-cuenta/membresia", icon: "CreditCard", order: 3 },
                { id: "nav-affiliate-payments", title: "Pagos y comprobantes", href: "/intranet/mi-cuenta/pagos", icon: "FileText", order: 4 },
                { id: "nav-affiliate-benefits", title: "Beneficios", href: "/intranet/mi-cuenta/beneficios", icon: "Gift", order: 5 },
                { id: "nav-affiliate-events", title: "Eventos", href: "/intranet/mi-cuenta/eventos", icon: "CalendarDays", order: 6 },
                { id: "nav-affiliate-documents", title: "Documentos", href: "/intranet/mi-cuenta/documentos", icon: "FileText", order: 7 },
                { id: "nav-affiliate-support", title: "Soporte", href: "/intranet/mi-cuenta/soporte", icon: "BadgeHelp", order: 8 },
            ],
        },
        {
            id: "group-affiliate-library",
            title: "Biblioteca virtual",
            type: "group",
            audience: "affiliate",
            order: 16,
            children: [
                { id: "nav-affiliate-onemine", title: "OneMine", href: "/api/integrations/onemine", icon: "BookOpen", openInNewTab: true, order: 1 },
            ],
        }
    ]
};
