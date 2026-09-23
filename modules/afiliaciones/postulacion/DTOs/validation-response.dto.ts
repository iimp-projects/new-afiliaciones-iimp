import type { DestinationChannel } from "@/modules/shared/Models/Verification";
export interface VerificationChoice { context: string; channels: DestinationChannel[] }
export interface ValidationResponseDTO {
  /** Omitted by the public consultation lookup so existence is never disclosed. */
  hasApplication?: boolean;
  requiresVerification: boolean;
  context?: string;
  channels: DestinationChannel[];
  /** Omitted by the public consultation lookup (no per-applicant contact options). */
  options?: VerificationChoice[];
  /** RENIEC prefill for a new DNI only; omitted for every existing application. */
  person?: { firstName: string; paternalLastName: string; maternalLastName: string } | null;
}
