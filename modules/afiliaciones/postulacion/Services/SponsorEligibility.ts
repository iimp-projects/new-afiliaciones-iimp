import { AffiliateType, ApplicationStatus, PaymentStatus, Prisma, UserStatus, UserType } from "@prisma/client";

/**
 * Regla única de elegibilidad de aval (búsqueda y guardado comparten este filtro).
 *
 * Un DNI es un aval elegible cuando existe una persona con ese documento que
 * cumpla AL MENOS UNA de estas condiciones:
 *
 * A. Flujo nuevo: tiene al menos una solicitud COMPLETED, de modalidad ASOCIADO
 *    ACTIVO, no eliminada, y con al menos un pago PAGADO.
 * B. Asociado histórico: su usuario vinculado es type=AFFILIATE, está ACTIVE y
 *    no fue eliminado (asociados migrados desde SIE sin postulación/pago local).
 */
export function sponsorEligibilityWhere(documentNumber: string): Prisma.PersonWhereInput {
  return {
    documentNumber,
    OR: [
      {
        applications: {
          some: {
            status: ApplicationStatus.COMPLETED,
            affiliateType: AffiliateType.ACTIVE,
            deletedAt: null,
            payments: {
              some: { status: PaymentStatus.PAID },
            },
          },
        },
      },
      {
        user: {
          is: {
            type: UserType.AFFILIATE,
            status: UserStatus.ACTIVE,
            deletedAt: null,
          },
        },
      },
    ],
  };
}
