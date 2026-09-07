import { ApplicationLookupService } from "./ApplicationLookupService";
import type { DocumentType, AffiliateType } from "@prisma/client";
import type { ValidationResponseDTO } from "../DTOs/validation-response.dto";
import { ApisNetPeService } from "@/modules/shared/Services/ApisNetPeService";
export class ValidateDocumentService {
  async execute(documentType: DocumentType, documentNumber: string, affiliateType?: AffiliateType): Promise<ValidationResponseDTO> {
    const lookup = new ApplicationLookupService();
    const result = await lookup.lookup({ documentType, documentNumber, ...(affiliateType ? { affiliateType } : {}) });
    if (result.hasApplication || documentType !== "DNI") return result;
    // A different affiliation type must not expose an existing applicant through RENIEC.
    if (affiliateType) {
      const existing = await lookup.lookup({ documentType, documentNumber });
      if (existing.hasApplication) return existing;
    }
    try {
      const person = await new ApisNetPeService().getDni(documentNumber.trim());
      if (person?.nombres && person.numeroDocumento === documentNumber.trim()) {
        return { ...result, person: { firstName: person.nombres, paternalLastName: person.apellidoPaterno, maternalLastName: person.apellidoMaterno || "" } };
      }
    } catch {
      // Preserve manual entry when the existing provider is unavailable.
    }
    return { ...result, person: null };
  }
}
