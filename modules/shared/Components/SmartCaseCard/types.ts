export type CasePriority = 'low' | 'medium' | 'high' | 'critical';
export type AtomicValidationStatus = 'check' | 'pending' | 'error' | 'dash' | 'review';
export type PrimaryBadgeIcon = 'check' | 'clock' | 'error' | 'dash';

export interface WorkflowStep {
  id: string;
  label: string;
  state: 'pending' | 'current' | 'completed' | 'blocked' | 'skipped';
}

export interface WorkflowData {
  currentStepIndex: number;
  steps: WorkflowStep[];
}

export interface AtomicValidation {
  icon: string; // Nombre del icono de Lucide (ej. 'CreditCard', 'Users', 'Package')
  label: string;
  status: AtomicValidationStatus;
  statusLabel: string; // Ej. "Confirmado", "Pendiente", "Aprobado"
  statusColorClass: string; // Clases de Tailwind para el badge
  assignee?: {
    name: string;
    timeRelative: string;
  };
}

export interface SmartCaseCardData {
  id: string | number;
  trackingCode: string;
  topBorderColorClass?: string; // NUEVO: Color de la franja superior
  subStatus?: string; // NUEVO: Ej. "Pendiente Logística"
  
  identity: {
    title: string;
    subtitle: string;
    avatarUrl: string | null;
    fallbackInitials: string;
    categoryBadge?: {
      label: string;
      colorClass: string;
    };
  };
  
  primaryBadge?: {
    label: string;
    icon: PrimaryBadgeIcon;
    colorClass: string;
  };
  
  workflow?: WorkflowData; // Opcional para este diseño
  atomicValidations?: AtomicValidation[]; // ACTUALIZADO a la nueva estructura
  
  metadata: {
    priority: CasePriority;
    lastUpdatedRelative: string;
    assignedTo?: {
      name: string;
      initial: string;
    };
  };
  allowedActions: string[];
  rawId?: number;
}

export interface SmartCaseCardProps {
  data: SmartCaseCardData;
  onClick?: () => void;
}