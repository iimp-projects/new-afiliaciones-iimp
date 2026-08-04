// Contratos visuales puros (Agnósticos - No saben nada de Afiliaciones)
export type CasePriority = 'low' | 'medium' | 'high' | 'critical';
export type AtomicValidationStatus = 'check' | 'pending' | 'error' | 'dash';
export type PrimaryBadgeIcon = 'check' | 'clock' | 'error' | 'dash';
export type WorkflowStepState = 'pending' | 'current' | 'completed' | 'blocked' | 'skipped';

export interface WorkflowStep {
  id: string;
  label: string;            
  state: WorkflowStepState;
}

export interface WorkflowData {
  currentStepIndex: number;
  steps: WorkflowStep[];
}

export interface AtomicValidation {
  label: string; 
  status: AtomicValidationStatus;
}

export interface SmartCaseCardData {
  id: string | number;
  trackingCode: string; 
  
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

  workflow: WorkflowData;
  atomicValidations?: AtomicValidation[];
  
  metadata: {
    priority: CasePriority;
    lastUpdatedRelative: string;
    assignedTo: {
      name: string;
      initial: string;
    };
  };

  allowedActions: string[];
}

export interface SmartCaseCardProps {
  data: SmartCaseCardData;
  onClick?: () => void;
}