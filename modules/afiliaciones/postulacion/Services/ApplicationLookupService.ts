import { z } from "zod";
import { destinationChannels } from "@/modules/shared/Models/Verification";
import { VerificationError } from "@/modules/shared/Models/VerificationError";
import { ApplicationLookupRepository } from "../Repositories/ApplicationLookupRepository";
import { queryAuthorization } from "@/modules/afiliaciones/consulta/Services/QueryAuthorizationService";
import { resolveOtpChannelAvailability } from "./OtpChannelAvailability";

export const applicationIdentitySchema = z.object({ documentType: z.enum(["DNI", "CE", "PASSPORT"]), documentNumber: z.string().trim().min(4).max(20).regex(/^[a-zA-Z0-9]+$/), affiliateType: z.enum(["ACTIVE", "STUDENT"]).optional() }).strict();
export class ApplicationLookupService {
  async lookup(input: unknown) {
    const parsed = applicationIdentitySchema.safeParse(input);
    if (!parsed.success) throw new VerificationError("Revisa el tipo y número de documento.");
    const applications = await new ApplicationLookupRepository().find(parsed.data.documentType, parsed.data.documentNumber, parsed.data.affiliateType);
    // Group contact choices, not application states. No personal or historical
    // details leave the server until an actual destination has been verified.
    const contacts = new Map<string, typeof applications[number]>();
    for (const application of applications) {
      const key = JSON.stringify([application.email.trim().toLowerCase(), application.phone.trim()]);
      if (!contacts.has(key)) contacts.set(key, application);
    }
    const options = Array.from(contacts.values()).map(application => ({ context: queryAuthorization.create(application.id, "QUERY_CHALLENGE"), channels: destinationChannels(application.email, application.phone, resolveOtpChannelAvailability()) }));
    return { hasApplication: applications.length > 0, requiresVerification: applications.length > 0, context: options[0]?.context, channels: options[0]?.channels || [], options };
  }
}
