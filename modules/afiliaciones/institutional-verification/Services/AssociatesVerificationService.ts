import { AssociatesApiClient } from "@/modules/afiliaciones/associates-integration/Clients/AssociatesApiClient";
import { AssociatesPayloadValidationError, toSieDocumentType } from "@/modules/afiliaciones/associates-integration/Mappers/AssociatesPayloadMapper";
import { classifyVerification, type VerificationResult } from "../Rules/MembershipVerificationRules";
import { VerifyAssociateRequestValidationError, type VerifyAssociateRequest } from "../Validators/verifyAssociateRequest";

type StateClient = Pick<AssociatesApiClient, "getAssociateState">;

export type VerifyAssociateResponse = VerificationResult & {
  /** ISO-8601 del momento en que SIE respondió la verificación. */
  verifiedAt: string;
};

/**
 * Caso de uso de verificación institucional de asociados.
 *
 * Consulta exclusivamente a SIE en vivo por tipo y número de documento; no
 * consulta PostgreSQL para decidir si alguien es o no asociado. Por eso puede
 * verificar asociados históricos que no tienen `Person` ni `User` locales.
 */
export class AssociatesVerificationService {
  constructor(
    private readonly client?: StateClient,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async verify(input: VerifyAssociateRequest): Promise<VerifyAssociateResponse> {
    let tipoDocumento: "1" | "4" | "7";
    try {
      tipoDocumento = toSieDocumentType(input.documentType);
    } catch (error) {
      if (error instanceof AssociatesPayloadValidationError) {
        throw new VerifyAssociateRequestValidationError("Tipo de documento no soportado.");
      }
      throw error;
    }

    const state = await this.apiClient().getAssociateState({
      tipoDocumento,
      numDocumento: input.documentNumber,
    });

    const now = this.now();
    return {
      ...classifyVerification(state, now),
      verifiedAt: now.toISOString(),
    };
  }

  private apiClient(): StateClient {
    return this.client ?? new AssociatesApiClient();
  }
}

export const associatesVerificationService = new AssociatesVerificationService();
