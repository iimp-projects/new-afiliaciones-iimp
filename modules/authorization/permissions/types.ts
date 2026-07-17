export interface PermissionDTO {
  id: number;
  action: string;
  subject: string;
  isActive: boolean;
}

export type PermissionString = `${string}:${string}`;