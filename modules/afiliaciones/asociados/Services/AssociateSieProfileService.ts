import { prisma } from "@/lib/prisma";
import { AssociatesApiClient } from "@/modules/afiliaciones/associates-integration/Clients/AssociatesApiClient";
import { AssociatesPayloadValidationError, toSieDocumentType } from "@/modules/afiliaciones/associates-integration/Mappers/AssociatesPayloadMapper";
import type { SieAssociateState } from "@/modules/afiliaciones/associates-integration/Models/AssociateIntegration";

type AssociateLookup = {
  membershipApplication: {
    findFirst(args: unknown): Promise<{ person: { documentType: string; documentNumber: string; deletedAt: Date | null } | null } | null>;
  };
};

type StateClient = Pick<AssociatesApiClient, "getAssociateState">;

export type AssociateSieProfileResponse =
  | { registered: false; checkedAt: string }
  | {
      registered: true;
      checkedAt: string;
      quotas: Array<{
        concepto: "INSCRIPCION" | "CUOTA";
        numero: number | null;
        monto: number;
        moneda: "S/" | "US$";
        anno: number;
        tipo: string;
        estadoContable: "Facturado" | "Pendiente";
        fechaPago: string;
        fechaInicio: string;
        fechaFin: string;
        docGSer: string;
        docGNro: string;
      }>;
    };

export class AssociateSieProfileError extends Error {
  constructor(message: string, readonly status: 404 | 422) {
    super(message);
    this.name = "AssociateSieProfileError";
  }
}

/**
 * Read-only bridge from an internal completed application to its SIE state.
 * It deliberately has no outbox, payment, status-transition, or persistence side effects.
 */
export class AssociateSieProfileService {
  constructor(
    private readonly database: AssociateLookup = prisma as unknown as AssociateLookup,
    private readonly client: StateClient = new AssociatesApiClient(),
    private readonly now: () => Date = () => new Date(),
  ) {}

  async getByApplicationId(applicationId: number): Promise<AssociateSieProfileResponse> {
    if (!Number.isInteger(applicationId) || applicationId < 1) throw new AssociateSieProfileError("Asociado no encontrado.", 404);

    const application = await this.database.membershipApplication.findFirst({
      where: { id: applicationId, status: "COMPLETED", deletedAt: null, person: { is: { deletedAt: null } } },
      select: { person: { select: { documentType: true, documentNumber: true, deletedAt: true } } },
    });
    if (!application?.person) throw new AssociateSieProfileError("Asociado no encontrado.", 404);
    if (!application.person.documentNumber.trim()) throw new AssociateSieProfileError("El asociado no tiene un documento válido para consultar SIE.", 422);

    let tipoDocumento: "1" | "4" | "7";
    try {
      tipoDocumento = toSieDocumentType(application.person.documentType);
    } catch (error) {
      if (error instanceof AssociatesPayloadValidationError) throw new AssociateSieProfileError("El tipo de documento del asociado no es compatible con SIE.", 422);
      throw error;
    }

    return toAssociateSieProfileResponse(
      await this.client.getAssociateState({ tipoDocumento, numDocumento: application.person.documentNumber }),
      this.now().toISOString(),
    );
  }
}

export function toAssociateSieProfileResponse(state: SieAssociateState, checkedAt: string): AssociateSieProfileResponse {
  if (!state.status) return { registered: false, checkedAt };
  return {
    registered: true,
    checkedAt,
    quotas: state.cuotas.map((quota) => ({ ...quota })),
  };
}

export const associateSieProfileService = new AssociateSieProfileService();
