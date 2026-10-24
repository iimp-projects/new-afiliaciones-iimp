import { Prisma, UserStatus, UserType } from "@prisma/client";

/**
 * Regla única de elegibilidad de aval (búsqueda y guardado comparten este filtro).
 *
 * Un DNI es un aval elegible cuando existe una persona con ese documento cuyo
 * usuario vinculado es un asociado activo:
 *
 * - user.type = AFFILIATE
 * - user.status = ACTIVE
 * - user.deletedAt = null
 */
export function sponsorEligibilityWhere(documentNumber: string): Prisma.PersonWhereInput {
  return {
    documentNumber,
    user: {
      is: {
        type: UserType.AFFILIATE,
        status: UserStatus.ACTIVE,
        deletedAt: null,
      },
    },
  };
}
