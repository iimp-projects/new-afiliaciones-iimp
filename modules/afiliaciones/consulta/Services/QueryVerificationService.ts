import { applicationIdentitySchema } from "@/modules/afiliaciones/postulacion/Services/ApplicationLookupService";
import { queryAuthorization } from "./QueryAuthorizationService";
import { VerificationError } from "@/modules/shared/Models/VerificationError";
import type { ValidationResponseDTO } from "@/modules/afiliaciones/postulacion/DTOs/validation-response.dto";
import { genericChannels } from "@/modules/shared/Models/Verification";
import { resolveOtpChannelAvailability } from "@/modules/afiliaciones/postulacion/Services/OtpChannelAvailability";

export const publicApplicationQuerySchema = applicationIdentitySchema
  .omit({ affiliateType: true })
  .strict();

export class QueryVerificationService {
  async lookup(input: unknown): Promise<ValidationResponseDTO> {
    const parsed = publicApplicationQuerySchema.safeParse(input);
    if (!parsed.success) throw new VerificationError("Revisa el tipo y número de documento.");

    // The public response is byte-identical for existing, nonexistent or
    // channel-less documents: no existence flag, no contact data and only the
    // globally enabled channels. The opaque challenge binds the document and is
    // resolved server-side at OTP time.
    const context = queryAuthorization.createDocumentChallenge(parsed.data.documentType, parsed.data.documentNumber);
    return {
      requiresVerification: true,
      context,
      channels: genericChannels(resolveOtpChannelAvailability()),
    };
  }
}
