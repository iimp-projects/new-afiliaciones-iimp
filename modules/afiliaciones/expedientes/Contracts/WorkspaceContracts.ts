import type { CasePriority } from "@/modules/shared/Components/SmartCaseCard/types";

export interface ExpedientesSearchFilters {
  query?: string;
  status?: string;
  priority?: CasePriority;
  requiresAttention?: boolean; // <-- DEBE SER BOOLEAN
}

export type MetricSemanticColor = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

export interface ExpedientesWorkspaceMetric {
  id: string;              
  label: string;           
  count: number;           
  icon: string;            
  color: MetricSemanticColor; 
  filterPayload: Partial<ExpedientesSearchFilters>; 
}