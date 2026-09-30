export interface RecipientListItem {
  id: number;
  email: string;
  name: string | null;
  company: string | null;
  lists: string[];
  createdAt: string;
}

export interface RecipientListOption {
  id: number;
  name: string;
}

export interface RecipientDetail {
  id: number;
  email: string;
  name: string | null;
  company: string | null;
  position: string | null;
  ruc: string | null;
  phone: string | null;
  createdAt: string;
  lists: Array<{ listName: string; metadata: unknown }>;
}
