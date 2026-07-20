import type { UserType, UserStatus } from '@prisma/client';

export interface CurrentUserDTO {
  id: number;
  email: string;
  type: UserType;
  status: UserStatus;
  person: {
    firstName: string;
    paternalLastName: string;
    maternalLastName: string | null;
    documentNumber: string;
  };
  role: {
    id: number;
    slug: string;
  };
  /**
   * Representación interna optimizada (O(1)) para evaluaciones RBAC repetitivas.
   * Almacena los permisos en formato "action:subject".
   */
  permissions: Set<string>;
}