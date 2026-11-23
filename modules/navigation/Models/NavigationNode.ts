export type NavigationVisibility = "visible" | "hidden";
export type NavigationNodeType = "item" | "group"; // <-- Nuevo tipo para soportar secciones
export type NavigationAudience = "administrative" | "affiliate";

export interface NavigationPermission {
    action: string;
    subject: string;
}

export interface NavigationNode {
    id: string;
    title: string;
    href?: string;
    icon?: string;
    subtitle?: string;
    openInNewTab?: boolean;
    type?: NavigationNodeType; // <-- Si es "group", actúa como título de sección
    collapsible?: boolean; // <-- Grupo desplegable (acordeón) cuando es true
    permission?: NavigationPermission;
    children?: NavigationNode[];
    order?: number;
    badge?: string;
    visibility?: NavigationVisibility;
    audience?: NavigationAudience;
    metadata?: Record<string, unknown>;
}
