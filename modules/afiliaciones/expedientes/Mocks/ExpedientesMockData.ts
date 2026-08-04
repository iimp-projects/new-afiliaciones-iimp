import type { SmartCaseCardData } from "@/modules/shared/Components/SmartCaseCard/types";
import type { ExpedientesWorkspaceMetric } from "../Contracts/WorkspaceContracts";
import type { DrawerData } from "@/modules/shared/Components/InspectionDrawer/types";

export const mockWorkspaceMetrics: ExpedientesWorkspaceMetric[] = [
  { id: "metric-1", label: "Todos", count: 142, icon: "Inbox", color: "neutral", filterPayload: {} },
  // AQUÍ ESTABA EL ERROR: Cambiamos "true" por true (sin comillas)
  { id: "metric-2", label: "Pendientes", count: 12, icon: "Clock", color: "warning", filterPayload: { requiresAttention: true } },
];

export const mockSmartCaseCards: SmartCaseCardData[] = [
  {
    id: 1,
    trackingCode: "APP-2026-0045",
    identity: {
      title: "Carlos Alfredo Gonzales Mendoza",
      subtitle: "DNI • 41000039",
      avatarUrl: "https://images.unsplash.com/photo-1560250097-0b93528c311a?w=150&h=200&fit=crop&crop=faces",
      fallbackInitials: "CG",
      categoryBadge: { label: "ASOCIADO ACTIVO", colorClass: "bg-[#e29b38]" },
    },
    primaryBadge: { label: "PAGADO", icon: "check", colorClass: "text-emerald-700 bg-emerald-50 border-emerald-200" },
    workflow: { currentStepIndex: 2, steps: [] },
    atomicValidations: [
      { label: "LOG", status: "check" },
      { label: "ASI", status: "pending" },
      { label: "COM", status: "check" },
      { label: "TES", status: "check" },
    ],
    metadata: {
      priority: "low",
      lastUpdatedRelative: "Hace 3 horas",
      assignedTo: { name: "ANA", initial: "A" },
    },
    allowedActions: [],
  },
  {
    id: 2,
    trackingCode: "APP-2026-0088",
    identity: {
      title: "Katherine Salazar Ramos",
      subtitle: "DNI • 41000067",
      avatarUrl: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&h=200&fit=crop&crop=faces",
      fallbackInitials: "KS",
      categoryBadge: { label: "ESTUDIANTE", colorClass: "bg-[#3b82f6]" },
    },
    primaryBadge: { label: "PENDIENTE", icon: "clock", colorClass: "text-amber-700 bg-amber-50 border-amber-200" },
    workflow: { currentStepIndex: 2, steps: [] },
    atomicValidations: [
      { label: "LOG", status: "check" },
      { label: "ASI", status: "check" },
      { label: "COM", status: "check" },
      { label: "TES", status: "pending" },
    ],
    metadata: {
      priority: "low",
      lastUpdatedRelative: "Hace 14 min",
      assignedTo: { name: "SIN ASIGNAR", initial: "-" },
    },
    allowedActions: [],
  },
  {
    id: 3,
    trackingCode: "APP-2026-0089",
    identity: {
      title: "Usuario Sin Foto",
      subtitle: "DNI • 99887766",
      avatarUrl: null,
      fallbackInitials: "US",
      categoryBadge: { label: "ASOCIADO ACTIVO", colorClass: "bg-[#e29b38]" },
    },
    primaryBadge: { label: "OBSERVADO", icon: "error", colorClass: "text-red-700 bg-red-50 border-red-200" },
    workflow: { currentStepIndex: 2, steps: [] },
    atomicValidations: [
      { label: "LOG", status: "check" },
      { label: "ASI", status: "error" },
      { label: "COM", status: "check" },
      { label: "TES", status: "check" },
    ],
    metadata: {
      priority: "low",
      lastUpdatedRelative: "Hace 2 días",
      assignedTo: { name: "JUAN", initial: "J" },
    },
    allowedActions: [],
  }
];

export const mockDrawerData: DrawerData<any> = {
  caseId: 1,
  header: mockSmartCaseCards[0], 
  defaultTabId: "summary", 
  availableTabs: [
    { id: "summary", label: "Resumen", hasNotification: false, icon: "Layout" },
    { id: "documents", label: "Documentación", hasNotification: false, icon: "Files" },
    { id: "payments", label: "Pagos", hasNotification: true, icon: "CreditCard" }, 
  ],
  payload: {}
};