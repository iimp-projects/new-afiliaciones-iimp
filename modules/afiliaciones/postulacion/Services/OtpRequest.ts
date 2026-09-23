import { VerificationError } from "@/modules/shared/Models/VerificationError";
import { z } from "zod";
import { queryAuthorization, type QueryChallenge } from "@/modules/afiliaciones/consulta/Services/QueryAuthorizationService";

const identity = z.union([
  z.object({ purpose: z.literal("APPLICATION_QUERY"), context: z.string().max(2048) }).strict(),
  z.object({ trackingCode: z.string().trim().min(1).max(200) }).strict(),
]);

export type OtpIdentifier = string | QueryChallenge;

export function parseOtpRequest(input: unknown, action: "send" | "verify") {
  const body = z.object({
    purpose: z.literal("APPLICATION_QUERY").optional(), context: z.string().optional(), trackingCode: z.string().optional(),
    ...(action === "send" ? { channel: z.enum(["EMAIL", "SMS", "WHATSAPP"]).default("EMAIL") } : { code: z.string().regex(/^\d{6}$/) }),
  }).strict().safeParse(input);
  if (!body.success) throw new VerificationError("Datos de verificación inválidos.");
  const { purpose, context, trackingCode } = body.data;
  const parsed = identity.safeParse(purpose ? { purpose, context, ...(trackingCode === undefined ? {} : { trackingCode }) } : { trackingCode, ...(context === undefined ? {} : { context }) });
  if (!parsed.success) throw new VerificationError("Datos de verificación inválidos.");
  if (purpose) {
    // The challenge is the only accepted source of identity; the client cannot
    // supply an email, phone, destination or applicationId.
    const challenge = queryAuthorization.resolveChallenge(context);
    if (!challenge) throw new VerificationError("La verificación ha expirado. Busca tu postulación nuevamente.");
    return { identifier: challenge as OtpIdentifier, purpose, channel: "channel" in body.data ? body.data.channel : undefined, code: "code" in body.data ? body.data.code : undefined };
  }
  return { identifier: trackingCode as OtpIdentifier, purpose: "RESUME_APPLICATION" as const, channel: "channel" in body.data ? body.data.channel : undefined, code: "code" in body.data ? body.data.code : undefined };
}
