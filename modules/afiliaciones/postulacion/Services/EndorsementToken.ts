import jwt from "jsonwebtoken";
import { getJwtSecret } from "@/lib/config/env";

export const ENDORSEMENT_ISSUER = "iimp-afiliaciones";
export const ENDORSEMENT_AUDIENCE = "iimp-endorsement-review";
export const ENDORSEMENT_PURPOSE = "endorsement-review";

export interface EndorsementTokenPayload {
  applicationId: number;
  sponsorPersonId: number;
}

interface EndorsementClaims extends EndorsementTokenPayload {
  iss?: string;
  aud?: string;
  purpose?: string;
}

function getSecret(): string {
  return getJwtSecret();
}

/**
 * Emite un token de revisión de aval con issuer, audience, purpose y expiración.
 */
export function signEndorsementToken(payload: EndorsementTokenPayload): string {
  return jwt.sign(
    { applicationId: payload.applicationId, sponsorPersonId: payload.sponsorPersonId, purpose: ENDORSEMENT_PURPOSE },
    getSecret(),
    { expiresIn: "7d", issuer: ENDORSEMENT_ISSUER, audience: ENDORSEMENT_AUDIENCE },
  );
}

/**
 * Valida un token de revisión de aval.
 *
 * Los enlaces emitidos antes del hardening no incluyen `iss`/`aud`/`purpose`;
 * se aceptan como transición mientras sigan vigentes (TTL 7 días). Los tokens
 * nuevos deben declarar y coincidir en los tres claims.
 */
export function verifyEndorsementToken(token: string): EndorsementTokenPayload {
  const decoded = jwt.verify(token, getSecret()) as EndorsementClaims;

  if (decoded.iss !== undefined && decoded.iss !== ENDORSEMENT_ISSUER) {
    throw new Error("El enlace no corresponde a este flujo.");
  }
  if (decoded.aud !== undefined && decoded.aud !== ENDORSEMENT_AUDIENCE) {
    throw new Error("El enlace no corresponde a este flujo.");
  }
  if (decoded.purpose !== undefined && decoded.purpose !== ENDORSEMENT_PURPOSE) {
    throw new Error("El enlace no corresponde a este flujo.");
  }
  if (!Number.isInteger(decoded.applicationId) || !Number.isInteger(decoded.sponsorPersonId)) {
    throw new Error("El enlace es inválido o no posee un formato correcto.");
  }

  return { applicationId: decoded.applicationId, sponsorPersonId: decoded.sponsorPersonId };
}
