export type CasePriority = 'low' | 'medium' | 'high' | 'critical';
export type ActionSeverity = 'success' | 'warning' | 'error' | 'info';
export type WorkflowStepState = 'pending' | 'current' | 'completed' | 'blocked' | 'skipped';

export interface ActionCenterData {
  id: string;
  severity: ActionSeverity;
  icon: string;             
  message: string;          
  actionLabel?: string;     
}

export interface WorkflowStep {
  id: string;
  label: string;            
  state: WorkflowStepState;
}

export interface WorkflowData {
  currentStepIndex: number;
  steps: WorkflowStep[];
}

export interface SmartCaseCardData {
  id: string | number;
  trackingCode: string;     
  
  identity: {
    title: string;          
    subtitle: string;       
    avatarUrl: string | null; 
    fallbackInitials: string; 
    badge?: {
      label: string;        
      colorName: string;    
    };
  };

  workflow: WorkflowData;
  actionCenter: ActionCenterData | null; 
  
  metadata: {
    priority: CasePriority;
    lastUpdatedAt: string;        
    lastUpdatedRelative: string;  
    assignedTo: {
      id: number;
      name: string;
      avatarUrl: string | null;
    } | null;
  };

  allowedActions: string[]; 
}

export interface SmartCaseCardProps {
  data: SmartCaseCardData;
  onClick?: () => void;
}