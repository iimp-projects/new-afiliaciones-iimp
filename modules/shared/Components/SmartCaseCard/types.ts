export type CasePriority = "low" | "medium" | "high" | "critical";

// Se integran los nuevos estados del backend conservando la compatibilidad gráfica
export type AtomicValidationStatus =
  | "PENDING"
  | "UNDER_EVALUATION"
  | "OBSERVED"
  | "RESOLVED"
  | "APPROVED"
  | "REJECTED"
  | "check"
  | "pending"
  | "error"
  | "dash"
  | "review";

export type PrimaryBadgeIcon =
  | "check"
  | "clock"
  | "error"
  | "dash"
  | "review"
  | "alert";

export interface WorkflowStep {
  id: string;
  label: string;
  state: "pending" | "current" | "completed" | "blocked" | "skipped";
}

export interface WorkflowData {
  currentStepIndex: number;
  steps: WorkflowStep[];
}

export interface AtomicValidation {
  icon: string;
  label: string;
  status: AtomicValidationStatus;
  statusLabel: string;
  statusColorClass: string;
  assignee?: {
    name: string;
    timeRelative: string;
  };
}

export interface SmartCaseCardData {
  id: string | number;
  trackingCode: string;
  topBorderColorClass?: string;
  subStatus?: string;
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
  workflow?: WorkflowData;
  atomicValidations?: AtomicValidation[];
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
