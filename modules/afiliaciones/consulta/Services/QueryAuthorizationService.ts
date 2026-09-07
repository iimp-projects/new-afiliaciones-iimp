import { VerificationError } from "@/modules/shared/Models/VerificationError";
import jwt from "jsonwebtoken";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

export const QUERY_COOKIE = "iimp_application_access";
export class QueryAuthorizationService {
  private secret() {
    if (!process.env.AUTH_SECRET) throw new VerificationError("No se pudo preparar la verificación.");
    return process.env.AUTH_SECRET;
  }
  create(applicationId: number, purpose: "QUERY_CHALLENGE" | "QUERY_ACCESS") {
    if (purpose === "QUERY_ACCESS") return this.createAccess([applicationId], applicationId);
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", createHash("sha256").update(this.secret()).digest(), iv);
    const encrypted = Buffer.concat([cipher.update(JSON.stringify({ applicationId, expiresAt: Date.now() + 15 * 60000 }), "utf8"), cipher.final()]);
    return [iv, cipher.getAuthTag(), encrypted].map(value => value.toString("base64url")).join(".");
  }
  createAccess(applicationIds: number[], applicationId = applicationIds[0]) {
    applicationIds = [applicationId, ...applicationIds.filter(id => id !== applicationId)];
    return jwt.sign({ applicationId, applicationIds, purpose: "QUERY_ACCESS" }, this.secret(), { algorithm: "HS256", expiresIn: "15m", audience: "iimp-consulta" });
  }
  allowedIds(token: string | undefined): number[] {
    if (!token) return [];
    try {
      const payload = jwt.verify(token, this.secret(), { algorithms: ["HS256"], audience: "iimp-consulta" });
      if (typeof payload === "string" || payload.purpose !== "QUERY_ACCESS" || !Array.isArray(payload.applicationIds)) return [];
      return payload.applicationIds.filter((id: unknown): id is number => typeof id === "number" && Number.isSafeInteger(id) && id > 0);
    } catch { return []; }
  }
  verify(token: string | undefined, purpose: "QUERY_CHALLENGE" | "QUERY_ACCESS"): number | null {
    if (!token) return null;
    if (purpose === "QUERY_ACCESS") return this.allowedIds(token)[0] || null;
    try {
      const parts = token.split(".");
      if (parts.length !== 3) return null;
      const [iv, tag, encrypted] = parts.map(value => Buffer.from(value, "base64url"));
      const decipher = createDecipheriv("aes-256-gcm", createHash("sha256").update(this.secret()).digest(), iv);
      decipher.setAuthTag(tag);
      const payload = JSON.parse(Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8"));
      return Number.isSafeInteger(payload.applicationId) && payload.applicationId > 0 && payload.expiresAt > Date.now() ? payload.applicationId : null;
    } catch { return null; }
  }
}
export const queryAuthorization = new QueryAuthorizationService();
