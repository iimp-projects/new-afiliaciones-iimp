import type { ModuleDefinition } from "@/modules/navigation/Models/ModuleDefinition";

export const securityModuleDefinition: ModuleDefinition = {
    name: "security",
    description: "Módulo de gestión de accesos y auditoría",
    navigation: [
        {
            id: "group-main",
            title: "MENÚ PRINCIPAL",
            type: "group", // <-- Esto pinta el título de sección
            audience: "administrative",
            order: 10,
            children: [
                {
                    id: "nav-security-users",
                    title: "Panel Principal",
                    href: "/intranet",
                    icon: "LayoutDashboard",
                    order: 1,
                }
            ]
        },
        // --- NUEVA SECCION: GESTIÓN DE AFILIACIONES ---
        {
            id: "group-afiliaciones",
            title: "GESTIÓN DE AFILIACIONES",
            type: "group", // Esto activa el diseño estetico de cabecera en el Sidebar
            audience: "administrative",
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
                    href: "/intranet/asociados", // Ajusta la ruta seg n tu proyecto
                    icon: "UserCheck", // Icono est tico de Lucide
                    order: 2,
                    // Filtro exacto para ATENCION_ASOCIADO basado en tus seeds
                    permission: { action: "read", subject: "memberships" } 
                }
            ]
        },
        // 3. NUEVO GRUPO: SEGURIDAD Y USUARIOS (Restringido)
        {
            id: "group-security",
            title: "SEGURIDAD Y USUARIOS",
            type: "group",
            audience: "administrative",
            order: 20,
            children: [
                {
                    id: "nav-security-users",
                    title: "Usuarios del Sistema",
                    href: "/intranet/security/users",
                    icon: "Users",
                    order: 1,
                    // Solo visible si el rol tiene permiso de 'read:users'
                    permission: { action: "read", subject: "users" }
                },
                {
                    id: "nav-security-roles",
                    title: "Roles y Permisos",
                    href: "/intranet/security/roles",
                    icon: "KeyRound",
                    order: 2,
                    // Solo visible si el rol tiene permiso de 'read:roles'
                    permission: { action: "read", subject: "roles" }
                },
                {
                    id: "nav-security-audit",
                    title: "Auditoría del Sistema",
                    href: "/intranet/security/audit",
                    icon: "Activity",
                    order: 3,
                    // Solo visible si el rol tiene permiso de 'read:audit'
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
            ]
        },
        {
            id: "group-sie",
            title: "SISTEMA INTEGRAL DE EVENTOS",
            type: "group",
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
        {
            id: "group-administracion",
            title: "ADMINISTRACIÓN",
            type: "group",
            audience: "administrative",
            order: 25,
            children: [
                {
                    id: "nav-operational-alerts",
                    title: "Centro de Alertas",
                    href: "/intranet/alertas",
                    icon: "BellRing",
                    order: 1,
                    permission: { action: "read", subject: "alerts" }
                },
                {
                    id: "nav-master-data",
                    title: "Datos Academicos",
                    href: "/intranet/master-data",
                    icon: "Database",
                    order: 2,
                    permission: { action: "read", subject: "catalogs" }
                }
            ]
        },
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
                { id: "nav-affiliate-membership", title: "Mi membresía", href: "/intranet/mi-cuenta/membresia", icon: "CreditCard", order: 2 },
                { id: "nav-affiliate-payments", title: "Pagos y comprobantes", href: "/intranet/mi-cuenta/pagos", icon: "FileText", order: 3 },
                { id: "nav-affiliate-benefits", title: "Beneficios", href: "/intranet/mi-cuenta/beneficios", icon: "Gift", order: 4 },
                { id: "nav-affiliate-events", title: "Eventos", href: "/intranet/mi-cuenta/eventos", icon: "CalendarDays", order: 5 },
                { id: "nav-affiliate-documents", title: "Documentos", href: "/intranet/mi-cuenta/documentos", icon: "FileText", order: 6 },
                { id: "nav-affiliate-support", title: "Soporte", href: "/intranet/mi-cuenta/soporte", icon: "BadgeHelp", order: 7 },
            ],
        }
    ]
};
