import type { 
  SmartCaseCardData, 
  WorkflowStep 
} from "@/modules/shared/Components/SmartCaseCard/types";
import type { 
  ExpedientesWorkspaceMetric 
} from "@/modules/afiliaciones/expedientes/Contracts/WorkspaceContracts";
import type { 
  DrawerData 
} from "@/modules/shared/Components/InspectionDrawer/types";

// ============================================================================
// 1. MOCK: MÉTRICAS DEL WORKSPACE (Botonera Táctica)
// Estas métricas inyectan filtros en la URL al hacerles clic.
// ============================================================================
export const mockWorkspaceMetrics: ExpedientesWorkspaceMetric[] = [
  {
    id: "metric-critical",
    label: "Vencen Hoy",
    count: 3,
    icon: "Clock",
    color: "danger",
    filterPayload: { priority: ["critical"] },
  },
  {
    id: "metric-observed",
    label: "Observados",
    count: 12,
    icon: "AlertTriangle",
    color: "warning",
    filterPayload: { requiresAttention: true },
  },
  {
    id: "metric-committee",
    label: "Listos para Comité",
    count: 8,
    icon: "Users",
    color: "info",
    filterPayload: { status: ["UNDER_EVALUATION"] },
  },
  {
    id: "metric-all",
    label: "En Cola",
    count: 142,
    icon: "Inbox",
    color: "neutral",
    filterPayload: {},
  },
];

// ============================================================================
// 2. MOCK: PIPELINES BASE (Reutilizables)
// ============================================================================
const standardWorkflowSteps: Omit<WorkflowStep, 'state'>[] = [
  { id: "step-1", label: "Solicitud" },
  { id: "step-2", label: "Documentos" },
  { id: "step-3", label: "Validación" },
  { id: "step-4", label: "Tesorería" },
  { id: "step-5", label: "Comité" },
];

const studentWorkflowSteps: Omit<WorkflowStep, 'state'>[] = [
  { id: "step-1", label: "Solicitud" },
  { id: "step-2", label: "Documentos" },
  { id: "step-3", label: "Validación" },
  { id: "step-5", label: "Comité" }, // Los estudiantes no pasan por Tesorería
];

// ============================================================================
// 3. MOCK: SMART CASE CARDS (Poniendo a prueba la UI)
// ============================================================================
export const mockSmartCaseCards: SmartCaseCardData[] = [
  // CASO 1: El "Cuello de Botella" (Pago rechazado, prioridad Alta)
  {
    id: 101,
    trackingCode: "APP-2026-0045",
    identity: {
      title: "Carlos Alfredo Vargas Paz",
      subtitle: "DNI: 41000039",
      avatarUrl: "https://randomuser.me/api/portraits/men/32.jpg", // Foto real
      fallbackInitials: "CV",
      badge: { label: "Activo", colorName: "primary-gold" },
    },
    workflow: {
      currentStepIndex: 3, // Tesorería
      steps: standardWorkflowSteps.map((s, i) => ({
        ...s,
        state: i < 3 ? 'completed' : i === 3 ? 'blocked' : 'pending'
      })),
    },
    actionCenter: {
      id: "err-001",
      severity: "error",
      icon: "Receipt",
      message: "Voucher de pago ilegible",
      actionLabel: "Ver documento",
    },
    metadata: {
      priority: "high",
      lastUpdatedAt: "2026-07-31T10:30:00Z",
      lastUpdatedRelative: "hace 3h",
      assignedTo: { id: 1, name: "Ana de Tesorería", avatarUrl: null },
    },
    allowedActions: ["VIEW_DETAILS", "NOTIFY_APPLICANT", "REASSIGN"],
  },

  // CASO 2: El "Happy Path" (Estudiante, todo perfecto, esperando comité)
  {
    id: 102,
    trackingCode: "APP-2026-0088",
    identity: {
      title: "Katherine Salazar Ortega",
      subtitle: "DNI: 41000067",
      avatarUrl: null, // ¡No tiene foto! Pondremos a prueba el Fallback Avatar
      fallbackInitials: "KS",
      badge: { label: "Estudiante", colorName: "blue-500" },
    },
    workflow: {
      currentStepIndex: 3, // Comité (Recordemos que no tiene Tesorería)
      steps: studentWorkflowSteps.map((s, i) => ({
        ...s,
        state: i < 3 ? 'completed' : i === 3 ? 'current' : 'pending'
      })),
    },
    actionCenter: null, // Todo está bien
    metadata: {
      priority: "low",
      lastUpdatedAt: "2026-07-31T13:00:00Z",
      lastUpdatedRelative: "hace 14m",
      assignedTo: null, // En la bandeja global
    },
    allowedActions: ["VIEW_DETAILS", "APPROVE_PHASE", "ASSIGN_TO_ME"],
  },

  // CASO 3: Requiere Atención Inmediata (Falta Aval)
  {
    id: 103,
    trackingCode: "APP-2026-0102",
    identity: {
      title: "Diego Alonso Salazar Ortega",
      subtitle: "DNI: 41000047",
      avatarUrl: "https://randomuser.me/api/portraits/men/44.jpg",
      fallbackInitials: "DS",
      badge: { label: "Activo", colorName: "primary-gold" },
    },
    workflow: {
      currentStepIndex: 2, // Validación
      steps: standardWorkflowSteps.map((s, i) => ({
        ...s,
        state: i < 2 ? 'completed' : i === 2 ? 'current' : 'pending'
      })),
    },
    actionCenter: {
      id: "warn-002",
      severity: "warning",
      icon: "Users",
      message: "Esperando respuesta de 1 Aval",
      actionLabel: "Reenviar correo",
    },
    metadata: {
      priority: "critical", // Marca la tarjeta con bandera roja
      lastUpdatedAt: "2026-07-29T09:00:00Z",
      lastUpdatedRelative: "hace 2 días",
      assignedTo: { id: 2, name: "Tú", avatarUrl: null },
    },
    allowedActions: ["VIEW_DETAILS", "RESEND_ENDORSEMENT", "OBSERVE"],
  },
];

// ============================================================================
// 4. MOCK: DATOS DEL DRAWER (El Quirófano)
// ============================================================================
// Esto es lo que carga cuando hacemos clic en Carlos Vargas (Caso 1)
export const mockDrawerData: DrawerData<any> = {
  caseId: 101,
  header: mockSmartCaseCards[0], // Reutiliza la metadata de la Card superior
  defaultTabId: "payments", // Se abre automáticamente en "Pagos" porque ahí está el error
  availableTabs: [
    { id: "summary", label: "Resumen", hasNotification: false, icon: "Layout" },
    { id: "documents", label: "Documentación", hasNotification: false, icon: "Files" },
    { id: "payments", label: "Pagos", hasNotification: true, icon: "CreditCard" }, // Punto rojo aquí
    { id: "history", label: "Auditoría", hasNotification: false, icon: "Activity" },
  ],
  payload: {
    // Aquí viajará la data específica de la tab en el futuro
    paymentEvidenceUrl: "https://ejemplo.com/voucher-borroso.jpg",
    validationAttempts: 2,
    internalNotes: [
      { author: "Sistema", text: "El código de operación no coincide con Niubiz.", date: "hace 3h" }
    ]
  }
};