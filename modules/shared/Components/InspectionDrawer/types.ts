import type { SmartCaseCardData } from "../SmartCaseCard/types";

export interface DrawerTab {
  id: string;               
  label: string;            
  icon?: string;
  hasNotification: boolean; 
}

export interface DrawerData<T = unknown> {
  caseId: string | number;
  header: SmartCaseCardData; 
  availableTabs: DrawerTab[];
  defaultTabId: string;
  payload: T; 
}