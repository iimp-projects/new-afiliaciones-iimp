// src/modules/navigation/models/ModuleDefinition.ts
import type { NavigationNode } from "./NavigationNode";
import type { IBreadcrumbResolver } from "../Ports/IBreadcrumbResolver";

export interface ModuleDefinition {
    name: string;
    description?: string;
    
    // Core actual
    navigation?: NavigationNode[];
    breadcrumbs?: Record<string, IBreadcrumbResolver>;
    
    // Preparado para el futuro (pueden venir vacíos por ahora)
    widgets?: Record<string, unknown>;
    dashboards?: Record<string, unknown>;
    configuration?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
}