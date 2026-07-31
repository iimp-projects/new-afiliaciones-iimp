import type { CasePriority } from "@/modules/shared/Components/SmartCaseCard/types";

// 1. Paginación
export interface PaginatedResult<T> {
  items: T[];
  meta: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
}

// 2. Filtros de Búsqueda para la URL (?status=APPROVED&category=STUDENT)
export interface ExpedientesSearchFilters {
  query?: string; // Búsqueda Omnibox
  status?: string[];
  category?: string[];
  priority?: CasePriority[];
  assignedTo?: string[]; 
  requiresAttention?: boolean; 
  dateRange?: {
    from: string; 
    to: string;   
  };
}

// 3. Botonera Táctica (Métricas)
export type MetricSemanticColor = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

export interface ExpedientesWorkspaceMetric {
  id: string;              
  label: string;           // Ej: "Observados"
  count: number;           // Ej: 3
  icon: string;            
  color: MetricSemanticColor; 
  
  // El payload define qué filtros se inyectarán en la URL al hacer clic
  filterPayload: Partial<ExpedientesSearchFilters>; 
}