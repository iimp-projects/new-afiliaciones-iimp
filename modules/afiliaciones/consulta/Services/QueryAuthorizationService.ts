import { VerificationError } from "@/modules/shared/Models/VerificationError";
import jwt from "jsonwebtoken";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";
import type { DocumentType } from "@prisma/client";
import { getAuthSecret } from "@/lib/config/env";

export const QUERY_COOKIE = "iimp_application_access";
export const QUERY_ACCESS_TTL_SECONDS = 900;
export const APPLICATION_ACCESS_EXPIRED_CODE = "APPLICATION_ACCESS_EXPIRED";

const CHALLENGE_TTL_MS = 15 * 60 * 1000;

/**
 * Opaque, encrypted challenge. It never carries data the client could read:
 * - "application": internal challenge for the existing-application gate.
 * - "document": public consultation challenge; binds only the document identity
 *   so the response cannot reveal whether an application exists.
 */
export type QueryChallenge =
  | { kind: "application"; applicationId: number; expiresAt: number }
  | { kind: "document"; documentType: DocumentType; documentNumber: string; expiresAt: number };

export type QueryAccessStatus = "VALID" | "EXPIRED" | "INVALID" | "MISSING";

export type QueryAccessResolution =
  | { status: "VALID"; applicationIds: number[]; applicationId: number }
  | { status: "EXPIRED" | "INVALID" | "MISSING" };

export class QueryAuthorizationService {
  private secret() {
    try {
      return getAuthSecret();
    } catch {
      throw new VerificationError("No se pudo preparar la verificación.");
    }
  }
  private encryptChallenge(payload: QueryChallenge): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", createHash("sha256").update(this.secret()).digest(), iv);
    const encrypted = Buffer.concat([cipher.update(JSON.stringify(payload), "utf8"), cipher.final()]);
    return [iv, cipher.getAuthTag(), encrypted].map(value => value.toString("base64url")).join(".");
  }
  create(applicationId: number, purpose: "QUERY_CHALLENGE" | "QUERY_ACCESS") {
    if (purpose === "QUERY_ACCESS") return this.createAccess([applicationId], applicationId);
    return this.encryptChallenge({ kind: "application", applicationId, expiresAt: Date.now() + CHALLENGE_TTL_MS });
  }
  createDocumentChallenge(documentType: DocumentType, documentNumber: string) {
    return this.encryptChallenge({ kind: "document", documentType, documentNumber, expiresAt: Date.now() + CHALLENGE_TTL_MS });
  }
  createAccess(applicationIds: number[], applicationId = applicationIds[0]) {
    applicationIds = [applicationId, ...applicationIds.filter(id => id !== applicationId)];
    return jwt.sign({ applicationId, applicationIds, purpose: "QUERY_ACCESS" }, this.secret(), { algorithm: "HS256", expiresIn: QUERY_ACCESS_TTL_SECONDS, audience: "iimp-consulta" });
  }

  /**
   * Distingue internamente el estado del token de acceso, sin exponer firma,
   * JWT ni detalles criptográficos. Únicamente un token firmado y no expirado
   * se clasifica como VALID; cualquier otra condición es MISSING/EXPIRED/INVALID.
   */
  resolveAccess(token: string | undefined): QueryAccessResolution {
    if (!token || !token.trim()) return { status: "MISSING" };
    try {
      const payload = jwt.verify(token, this.secret(), { algorithms: ["HS256"], audience: "iimp-consulta" });
      if (typeof payload === "string" || payload.purpose !== "QUERY_ACCESS" || !Array.isArray(payload.applicationIds)) {
        return { status: "INVALID" };
      }
      const applicationIds = payload.applicationIds.filter((id: unknown): id is number => typeof id === "number" && Number.isSafeInteger(id) && id > 0);
      if (applicationIds.length === 0) return { status: "INVALID" };
      const applicationId = typeof payload.applicationId === "number" && Number.isSafeInteger(payload.applicationId) && payload.applicationId > 0
        ? payload.applicationId
        : applicationIds[0];
      return { status: "VALID", applicationIds, applicationId };
    } catch (error) {
      if (error instanceof Error && error.name === "TokenExpiredError") return { status: "EXPIRED" };
      return { status: "INVALID" };
    }
  }

  /**
   * Renovación deslizante: solo re-firma cuando el token sigue siendo VÁLIDO.
   * Un token expirado, inválido o ausente nunca se revive (devuelve null).
   */
  renewAccess(token: string | undefined): string | null {
    const resolution = this.resolveAccess(token);
    if (resolution.status !== "VALID") return null;
    return this.createAccess(resolution.applicationIds, resolution.applicationId);
  }

  allowedIds(token: string | undefined): number[] {
    const resolution = this.resolveAccess(token);
    return resolution.status === "VALID" ? resolution.applicationIds : [];
  }
  resolveChallenge(token: string | undefined): QueryChallenge | null {
    if (!token) return null;
    try {
      const parts = token.split(".");
      if (parts.length !== 3) return null;
      const [iv, tag, encrypted] = parts.map(value => Buffer.from(value, "base64url"));
      const decipher = createDecipheriv("aes-256-gcm", createHash("sha256").update(this.secret()).digest(), iv);
      decipher.setAuthTag(tag);
      const payload = JSON.parse(Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8")) as QueryChallenge;
      if (typeof payload?.expiresAt !== "number" || payload.expiresAt <= Date.now()) return null;
      if (payload.kind === "application" && Number.isSafeInteger(payload.applicationId) && payload.applicationId > 0) return payload;
      if (payload.kind === "document" && typeof payload.documentType === "string" && typeof payload.documentNumber === "string") return payload;
      return null;
    } catch { return null; }
  }
  verify(token: string | undefined, purpose: "QUERY_CHALLENGE" | "QUERY_ACCESS"): number | null {
    if (!token) return null;
    if (purpose === "QUERY_ACCESS") return this.allowedIds(token)[0] || null;
    const payload = this.resolveChallenge(token);
    return payload?.kind === "application" ? payload.applicationId : null;
  }
}
export const queryAuthorization = new QueryAuthorizationService();
