import { UserStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ROLE_DEPARTMENT } from "@/modules/afiliaciones/expedientes/Services/ExpedienteAuthorizationService";

const ADMIN_ROLE_SLUGS = ["SUPER_ADMIN", "SYSTEM_ADMIN"] as const;

const DEPARTMENT_ROLE_SLUGS: Record<string, string[]> = (() => {
  const map: Record<string, string[]> = {};
  for (const [roleSlug, departmentCode] of Object.entries(ROLE_DEPARTMENT)) {
    const slugs = map[departmentCode] ?? [];
    slugs.push(roleSlug);
    map[departmentCode] = slugs;
  }
  return map;
})();

/**
 * Resuelve los destinatarios internos de un evento por área(s) de trabajo.
 *
 * Devuelve únicamente usuarios ACTIVE con un rol que administra el área indicada,
 * más los administradores autorizados (SUPER_ADMIN / SYSTEM_ADMIN). No resuelve
 * usuarios inactivos, bloqueados ni pendientes, y no depende de datos enviados
 * por el navegador.
 */
export class NotificationRecipientResolver {
  async resolveForDepartments(departmentCodes: string[]): Promise<number[]> {
    if (departmentCodes.length === 0) return [];

    const roleSlugs = new Set<string>(ADMIN_ROLE_SLUGS);
    for (const code of departmentCodes) {
      for (const slug of DEPARTMENT_ROLE_SLUGS[code] ?? []) roleSlugs.add(slug);
    }

    const users = await prisma.user.findMany({
      where: {
        status: UserStatus.ACTIVE,
        role: { slug: { in: [...roleSlugs] }, isActive: true },
      },
      select: { id: true },
    });

    return users.map((user) => user.id);
  }
}
