// prisma/seed/auth/data/role-permissions.data.ts

export type RolePermissionMatrix = Record<string, Array<[string, string]>>;

export const rolePermissionsData: RolePermissionMatrix = {
  SUPER_ADMIN: [
    ["manage","all"],
  ],

  SYSTEM_ADMIN: [
    ["read","dashboard"],

    ["create","users"],
    ["read","users"],
    ["update","users"],
    ["delete","users"],
    ["block","users"],
    ["unlock","users"],
    ["assign-role","users"],

    ["create","roles"],
    ["read","roles"],
    ["update","roles"],
    ["assign-permissions","roles"],

    ["create","permissions"],
    ["read","permissions"],

    ["create","applications"],
    ["read","applications"],
    ["update","applications"],
    ["approve","applications"],
    ["reject","applications"],
    ["observe","applications"],
    ["assign","applications"],
    ["export","applications"],

    ["upload","documents"],
    ["read","documents"],
    ["validate","documents"],
    ["download","documents"],

    ["create","payments"],
    ["read","payments"],
    ["validate","payments"],
    ["refund","payments"],

    ["read","reports"],
    ["export","reports"],

    ["read","audit"],

    ["send","notifications"],

    ["read","configuration"],
    ["update","configuration"],
  ],

  COMITE_EVALUADOR: [
    ["read","applications"],
    ["approve","applications"],
    ["reject","applications"],
    ["observe","applications"],
    ["read","documents"],
    ["validate","documents"],
    ["download","documents"],
  ],

  VALIDADOR: [
    ["read","applications"],
    ["approve","applications"],
    ["reject","applications"],
    ["read","documents"],
    ["validate","documents"],
  ],

  TESORERIA: [
    ["read","payments"],
    ["validate","payments"],
    ["refund","payments"],
    ["read","reports"],
    ["export","reports"],
  ],

  CONTABILIDAD: [
    ["read","payments"],
    ["export","payments"],
    ["read","reports"],
  ],

  CAJA: [
    ["create","payments"],
    ["read","payments"],
    ["validate","payments"],
  ],

  ATENCION_ASOCIADO: [
    ["read","applications"],
    ["update","applications"],
    ["upload","documents"],
    ["read","documents"],
    ["read","memberships"],
  ],

  MESA_PARTES: [
    ["upload","documents"],
    ["read","documents"],
  ],

  AUDITOR: [
    ["read","audit"],
    ["export","audit"],
    ["read","reports"],
  ],

  POSTULANTE: [
    ["create","applications"],
    ["read","applications"],
    ["submit","applications"],
    ["upload","documents"],
    ["read","documents"],
  ],

  ASOCIADO_ACTIVO: [
    ["read","documents"],
    ["read","memberships"],
  ],

  ASOCIADO_ESTUDIANTE: [
    ["read","documents"],
    ["read","memberships"],
  ],

  INVITADO: [
    ["read","dashboard"],
  ],
};
