import type { SmartCaseCardData } from "../SmartCaseCard/types";

export interface DrawerTab {
  id: string;               // Ej: 'summary', 'documents', 'payments'
  label: string;            // Ej: "Documentos"
  icon?: string;
  hasNotification: boolean; // Notificación de atención requerida
}

// Usamos <T> (Genéricos) para que el Drawer sea un cascarón vacío
// que cada módulo llenará con su propia data de negocio.
export interface DrawerData<T = unknown> {
  caseId: string | number;
  
  // Reutilizamos el contrato de la tarjeta para pintar el encabezado fijo del Drawer
  header: SmartCaseCardData; 
  
  availableTabs: DrawerTab[];
  defaultTabId: string;
  
  // Carga útil de negocio. Aquí viajarán los Arrays de documentos, historial, etc.
  payload: T; 
}