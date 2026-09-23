import type { UserType, UserStatus } from '@prisma/client';

export interface CurrentUserDTO {
  id: number;
  email: string;
  type: UserType;
  status: UserStatus;
  image: string | null;
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

const associateRoleSlugs = new Set(["ASOCIADO_ACTIVO", "ASOCIADO_ESTUDIANTE"]);

/** Identidad de asociado basada en los datos formales de cuenta y rol. */
export function isAffiliateUser(user: Pick<CurrentUserDTO, "type" | "role">): boolean {
  return user.type === "AFFILIATE" || associateRoleSlugs.has(user.role.slug);
}
