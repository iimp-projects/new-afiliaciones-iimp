import jwt from "jsonwebtoken";
import { getJwtSecret } from "@/lib/config/env";

export const COMITE_REVIEW_ISSUER = "iimp-afiliaciones";
export const COMITE_REVIEW_AUDIENCE = "iimp-committee-review";
export const COMITE_REVIEW_PURPOSE = "committee-review";

export interface ComiteReviewTokenPayload {
  applicationId: number;
  committeeUserId: number;
}

interface ComiteReviewClaims extends ComiteReviewTokenPayload {
  iss?: string;
  aud?: string;
  purpose?: string;
}

function getSecret(): string {
  return getJwtSecret();
}

/**
 * Emite un token de revisión del Comité Evaluador. El token identifica al
 * miembro del comité destinatario, de modo que el enlace recibido por correo
 * sólo puede ser usado por esa persona.
 */
export function signComiteReviewToken(payload: ComiteReviewTokenPayload): string {
  return jwt.sign(
    {
      applicationId: payload.applicationId,
      committeeUserId: payload.committeeUserId,
      purpose: COMITE_REVIEW_PURPOSE,
    },
    getSecret(),
    { expiresIn: "7d", issuer: COMITE_REVIEW_ISSUER, audience: COMITE_REVIEW_AUDIENCE },
  );
}

export function verifyComiteReviewToken(token: string): ComiteReviewTokenPayload {
  const decoded = jwt.verify(token, getSecret()) as ComiteReviewClaims;

  if (decoded.iss !== COMITE_REVIEW_ISSUER) {
    throw new Error("El enlace no corresponde a este flujo.");
  }
  if (decoded.aud !== COMITE_REVIEW_AUDIENCE) {
    throw new Error("El enlace no corresponde a este flujo.");
  }
  if (decoded.purpose !== COMITE_REVIEW_PURPOSE) {
    throw new Error("El enlace no corresponde a este flujo.");
  }
  if (!Number.isInteger(decoded.applicationId) || !Number.isInteger(decoded.committeeUserId)) {
    throw new Error("El enlace es inválido o no posee un formato correcto.");
  }

  return {
    applicationId: decoded.applicationId,
    committeeUserId: decoded.committeeUserId,
  };
}
