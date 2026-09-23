export type VerificationChannel = "EMAIL" | "SMS" | "WHATSAPP";
export type VerificationContext = "RESUME_APPLICATION" | "APPLICATION_QUERY";
// Only available channels are included; destination is always masked.
// Both lookup APIs return this contract directly to the shared dialogs.
export type DestinationChannel = { channel: VerificationChannel; destination?: string };
export const OTP_COOLDOWN_SECONDS = 60;
export const OTP_TTL_MS = 15 * 60 * 1000;
export const OTP_MAX_ATTEMPTS = 3;

/** Local readiness of each OTP provider (feature flag AND provider configuration). */
export interface OtpChannelAvailability {
  EMAIL: boolean;
  SMS: boolean;
  WHATSAPP: boolean;
}

export const ALL_OTP_CHANNELS_AVAILABLE: OtpChannelAvailability = { EMAIL: true, SMS: true, WHATSAPP: true };

/**
 * Globally enabled channels, without any per-applicant destination.
 * Used by the public consultation lookup so the response never reveals which
 * contacts (or how many) a given document has registered.
 */
export function genericChannels(
  availability: OtpChannelAvailability = ALL_OTP_CHANNELS_AVAILABLE,
): DestinationChannel[] {
  const channels: DestinationChannel[] = [];
  if (availability.WHATSAPP) channels.push({ channel: "WHATSAPP" });
  if (availability.SMS) channels.push({ channel: "SMS" });
  if (availability.EMAIL) channels.push({ channel: "EMAIL" });
  return channels;
}

export function destinationChannels(
  email?: string | null,
  phone?: string | null,
  availability: OtpChannelAvailability = ALL_OTP_CHANNELS_AVAILABLE,
): DestinationChannel[] {
  const channels: DestinationChannel[] = [];
  if (phone?.trim()) {
    const destination = `*** *** ${phone.replace(/\D/g, "").slice(-3)}`;
    if (availability.WHATSAPP) channels.push({ channel: "WHATSAPP", destination });
    if (availability.SMS) channels.push({ channel: "SMS", destination });
  }
  if (email?.trim() && availability.EMAIL) {
    const [name, domain] = email.trim().split("@");
    channels.push({ channel: "EMAIL", destination: `${name[0]}***@${domain || "***"}` });
  }
  return channels;
}
