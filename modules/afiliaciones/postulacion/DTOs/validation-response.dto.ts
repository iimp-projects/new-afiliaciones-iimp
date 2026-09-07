import type { DestinationChannel } from "@/modules/shared/Models/Verification";
export interface VerificationChoice { context: string; channels: DestinationChannel[] }
export interface ValidationResponseDTO {
  hasApplication: boolean;
  requiresVerification: boolean;
  context?: string;
  channels: DestinationChannel[];
  options: VerificationChoice[];
  /** RENIEC prefill for a new DNI only; omitted for every existing application. */
  person?: { firstName: string; paternalLastName: string; maternalLastName: string } | null;
}
