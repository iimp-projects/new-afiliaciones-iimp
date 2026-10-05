import { AffiliateType, ApplicationStatus, PaymentStatus, Prisma } from "@prisma/client";

/**
 * Regla única de elegibilidad de aval (búsqueda y guardado comparten este filtro).
 *
 * Un DNI es un aval elegible cuando existe una persona con ese documento que
 * tenga al menos una solicitud COMPLETED, de modalidad ASOCIADO ACTIVO, no
 * eliminada, y con al menos un pago PAGADO. No se exige cuenta de usuario.
 */
export function sponsorEligibilityWhere(documentNumber: string): Prisma.PersonWhereInput {
  return {
    documentNumber,
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
  };
}
