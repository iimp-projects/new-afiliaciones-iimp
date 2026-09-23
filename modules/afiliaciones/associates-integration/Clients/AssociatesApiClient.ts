import { getAssociatesApiConfig, type AssociatesApiConfig } from "../Config/AssociatesApiConfig";
import type { AssociateRequestPayloadSnapshot } from "../Models/AssociateIntegration";
import { AssociatesApiError } from "./AssociatesApiError";

type FetchLike = typeof fetch;
type TokenCache = { token: string; expiresAt: number };
export type AssociatesCreateResult = { externalAssociateCode: number; externalMessage: string; httpStatus: number; receipt?: { type?: string; serie?: string; number?: string; pdfReference?: string } };
type ErrorBody = { codigo?: string; mensaje?: string; identificador?: string; detalles?: string[] };

export class AssociatesApiClient {
  private tokenCache: TokenCache | null = null;
  constructor(private readonly config: AssociatesApiConfig = getAssociatesApiConfig(), private readonly fetcher: FetchLike = fetch, private readonly now: () => number = Date.now) {}

  async createAssociate(payload: AssociateRequestPayloadSnapshot): Promise<AssociatesCreateResult> {
    try { return await this.postAssociate(payload); }
    catch (error) {
      if (!(error instanceof AssociatesApiError) || error.httpStatus !== 401) throw error;
      this.tokenCache = null;
      try { return await this.postAssociate(payload); }
      catch (retryError) {
        if (retryError instanceof AssociatesApiError && retryError.httpStatus === 401) throw new AssociatesApiError(retryError.message, { ...retryError.options, retryable: false });
        throw retryError;
      }
    }
  }

  private async postAssociate(payload: AssociateRequestPayloadSnapshot): Promise<AssociatesCreateResult> {
    const token = await this.token();
    const response = await this.request("/asociados", { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${token}` }, body: JSON.stringify(payload) }, "CREATE_ASSOCIATE");
    if (!response.ok) throw await this.toError(response, "CREATE_ASSOCIATE");
    const body = await this.json(response, "CREATE_ASSOCIATE");
    if (body?.estado !== true || !Number.isInteger(body.codigo)) throw new AssociatesApiError("La API de asociados devolvió una respuesta de éxito inválida.", { retryable: false, operation: "CREATE_ASSOCIATE" });
    return { externalAssociateCode: body.codigo, externalMessage: typeof body.msg === "string" ? body.msg : "Success", httpStatus: response.status, receipt: body.contable ? { type: stringOrUndefined(body.contable.tipoDocumento), serie: stringOrUndefined(body.contable.serie), number: stringOrUndefined(body.contable.numero), pdfReference: stringOrUndefined(body.contable.pdfUrl) } : undefined };
  }

  private async token(): Promise<string> {
    const safetyWindowMs = 30_000;
    if (this.tokenCache && this.tokenCache.expiresAt - safetyWindowMs > this.now()) return this.tokenCache.token;
    const response = await this.request("/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ usuario: this.config.user, clave: this.config.password }) }, "LOGIN");
    if (!response.ok) throw await this.toError(response, "LOGIN");
    const body = await this.json(response, "LOGIN");
    if (typeof body?.token !== "string" || !body.token || !Number.isInteger(body.expiraEnSegundos) || body.expiraEnSegundos <= 30) throw new AssociatesApiError("La API de asociados devolvió un token inválido.", { retryable: false, operation: "LOGIN" });
    this.tokenCache = { token: body.token, expiresAt: this.now() + body.expiraEnSegundos * 1000 };
    return body.token;
  }

  private async request(path: string, init: RequestInit, operation: "LOGIN" | "CREATE_ASSOCIATE"): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);
    try { return await this.fetcher(`${this.config.baseUrl}${path}`, { ...init, signal: controller.signal }); }
    catch (cause) { throw new AssociatesApiError(cause instanceof Error && cause.name === "AbortError" ? "Tiempo de espera agotado al comunicarse con la API de asociados." : "No se pudo comunicar con la API de asociados.", { retryable: true, operation, cause }); }
    finally { clearTimeout(timeout); }
  }

  private async toError(response: Response, operation: "LOGIN" | "CREATE_ASSOCIATE"): Promise<AssociatesApiError> {
    const body = await this.json(response, operation, true) as ErrorBody | null;
    const retryable = operation === "LOGIN" ? response.status === 429 : response.status >= 500;
    return new AssociatesApiError(body?.mensaje || `La API de asociados respondió HTTP ${response.status}.`, { httpStatus: response.status, code: body?.codigo, identifier: body?.identificador, details: Array.isArray(body?.detalles) ? body.detalles.filter((item): item is string => typeof item === "string") : undefined, retryable, operation });
  }

  private async json(response: Response, operation: "LOGIN" | "CREATE_ASSOCIATE", allowEmpty = false): Promise<any> {
    try { return await response.json(); }
    catch { if (allowEmpty) return null; throw new AssociatesApiError("La API de asociados devolvió JSON inválido.", { retryable: false, operation }); }
  }
}

function stringOrUndefined(value: unknown) { return typeof value === "string" && value.trim() ? value : undefined; }
