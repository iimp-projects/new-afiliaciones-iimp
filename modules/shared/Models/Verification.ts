export type VerificationChannel = "EMAIL" | "SMS" | "WHATSAPP";
export type VerificationContext = "RESUME_APPLICATION" | "APPLICATION_QUERY";
// Only available channels are included; destination is always masked.
// Both lookup APIs return this contract directly to the shared dialogs.
export type DestinationChannel = { channel: VerificationChannel; destination: string };
export const OTP_COOLDOWN_SECONDS = 60;
export const OTP_TTL_MS = 15 * 60 * 1000;
export const OTP_MAX_ATTEMPTS = 3;

export function destinationChannels(email?: string | null, phone?: string | null): DestinationChannel[] {
  const channels: DestinationChannel[] = [];
  if (phone?.trim()) {
    const destination = `*** *** ${phone.replace(/\D/g, "").slice(-3)}`;
    channels.push({ channel: "WHATSAPP", destination }, { channel: "SMS", destination });
  }
  if (email?.trim()) {
    const [name, domain] = email.trim().split("@");
    channels.push({ channel: "EMAIL", destination: `${name[0]}***@${domain || "***"}` });
  }
  return channels;
}
