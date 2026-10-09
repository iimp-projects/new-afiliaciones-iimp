import { getAssociatesApiConfig, type AssociatesApiConfig } from "../Config/AssociatesApiConfig";
import { parseAssociateListPage, parseAssociateListPageWithClave } from "../Mappers/SieAssociateListMapper";
import type { AssociateRequestPayloadSnapshot, SieAssociateState, SieAssociateStateQuota, SieAssociateStateRequest } from "../Models/AssociateIntegration";
import type { SieAssociateListPage, SieAssociateListPageWithClave, SieAssociateListRequest } from "../Models/SieAssociateList";
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

  /**
   * Read-only SIE query. P0-A intentionally does not connect this operation to
   * outbox processing, payments, application statuses, or timeline data.
   */
  async getAssociateState(input: SieAssociateStateRequest): Promise<SieAssociateState> {
    assertStateRequest(input);
    try { return await this.getAssociateStateOnce(input); }
    catch (error) {
      if (!(error instanceof AssociatesApiError) || error.httpStatus !== 401) throw error;
      this.tokenCache = null;
      try { return await this.getAssociateStateOnce(input); }
      catch (retryError) {
        if (retryError instanceof AssociatesApiError && retryError.httpStatus === 401) throw new AssociatesApiError(retryError.message, { ...retryError.options, retryable: false });
        throw retryError;
      }
    }
  }

  async listAssociates(input: SieAssociateListRequest = {}): Promise<SieAssociateListPage> {
    const body: Record<string, unknown> = { Pagina: input.pagina ?? 1, TamanioPagina: input.tamanioPagina ?? 500 };
    if (input.tipo) body.Tipo = input.tipo;
    try { return await this.listAssociatesOnce(body); }
    catch (error) {
      if (!(error instanceof AssociatesApiError) || error.httpStatus !== 401) throw error;
      this.tokenCache = null;
      try { return await this.listAssociatesOnce(body); }
      catch (retryError) {
        if (retryError instanceof AssociatesApiError && retryError.httpStatus === 401) throw new AssociatesApiError(retryError.message, { ...retryError.options, retryable: false });
        throw retryError;
      }
    }
  }

  private async listAssociatesOnce(body: Record<string, unknown>): Promise<SieAssociateListPage> {
    const token = await this.token();
    const response = await this.request("/ventas/asociados/lista", { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${token}` }, body: JSON.stringify(body) }, "LIST_ASSOCIATES");
    if (!response.ok) throw await this.toError(response, "LIST_ASSOCIATES");
    return parseAssociateListPage(await this.json(response, "LIST_ASSOCIATES"));
  }

  async listAssociatesWithClave(input: SieAssociateListRequest = {}): Promise<SieAssociateListPageWithClave> {
    const body: Record<string, unknown> = { Pagina: input.pagina ?? 1, TamanioPagina: input.tamanioPagina ?? 500 };
    if (input.tipo) body.Tipo = input.tipo;
    try { return await this.listAssociatesWithClaveOnce(body); }
    catch (error) {
      if (!(error instanceof AssociatesApiError) || error.httpStatus !== 401) throw error;
      this.tokenCache = null;
      try { return await this.listAssociatesWithClaveOnce(body); }
      catch (retryError) {
        if (retryError instanceof AssociatesApiError && retryError.httpStatus === 401) throw new AssociatesApiError(retryError.message, { ...retryError.options, retryable: false });
        throw retryError;
      }
    }
  }

  private async listAssociatesWithClaveOnce(body: Record<string, unknown>): Promise<SieAssociateListPageWithClave> {
    const token = await this.token();
    const response = await this.request("/ventas/asociados/lista", { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${token}` }, body: JSON.stringify(body) }, "LIST_ASSOCIATES");
    if (!response.ok) throw await this.toError(response, "LIST_ASSOCIATES");
    return parseAssociateListPageWithClave(await this.json(response, "LIST_ASSOCIATES"));
  }

  private async postAssociate(payload: AssociateRequestPayloadSnapshot): Promise<AssociatesCreateResult> {
    const token = await this.token();
    const response = await this.request("/asociados", { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${token}` }, body: JSON.stringify(payload) }, "CREATE_ASSOCIATE");
    if (!response.ok) throw await this.toError(response, "CREATE_ASSOCIATE");
    const body = await this.json(response, "CREATE_ASSOCIATE");
    if (body?.estado !== true || !Number.isInteger(body.codigo)) throw new AssociatesApiError("La API de asociados devolvió una respuesta de éxito inválida.", { retryable: false, operation: "CREATE_ASSOCIATE", kind: "INVALID_RESPONSE" });
    return { externalAssociateCode: body.codigo, externalMessage: typeof body.msg === "string" ? body.msg : "Success", httpStatus: response.status, receipt: body.contable ? { type: stringOrUndefined(body.contable.tipoDocumento), serie: stringOrUndefined(body.contable.serie), number: stringOrUndefined(body.contable.numero), pdfReference: stringOrUndefined(body.contable.pdfUrl) } : undefined };
  }

  private async getAssociateStateOnce(input: SieAssociateStateRequest): Promise<SieAssociateState> {
    const token = await this.token();
    const query = new URLSearchParams({ tipo_documento: input.tipoDocumento, num_documento: input.numDocumento });
    const response = await this.request(`/asociados/estado?${query.toString()}`, { method: "GET", headers: { authorization: `Bearer ${token}` } }, "GET_ASSOCIATE_STATE");
    if (!response.ok) throw await this.toError(response, "GET_ASSOCIATE_STATE");
    return parseAssociateState(await this.json(response, "GET_ASSOCIATE_STATE"));
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

  private async request(path: string, init: RequestInit, operation: "LOGIN" | "CREATE_ASSOCIATE" | "GET_ASSOCIATE_STATE" | "LIST_ASSOCIATES"): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);
    try { return await this.fetcher(`${this.config.baseUrl}${path}`, { ...init, signal: controller.signal }); }
    catch (cause) { const timeout = cause instanceof Error && cause.name === "AbortError"; throw new AssociatesApiError(timeout ? "Tiempo de espera agotado al comunicarse con la API de asociados." : "No se pudo comunicar con la API de asociados.", { retryable: true, operation, kind: timeout ? "TIMEOUT" : "TRANSPORT_ERROR", cause }); }
    finally { clearTimeout(timeout); }
  }

  private async toError(response: Response, operation: "LOGIN" | "CREATE_ASSOCIATE" | "GET_ASSOCIATE_STATE" | "LIST_ASSOCIATES"): Promise<AssociatesApiError> {
    const body = await this.json(response, operation, true) as ErrorBody | null;
    const retryable = operation === "LOGIN" ? response.status === 429 : response.status >= 500;
    return new AssociatesApiError(body?.mensaje || `La API de asociados respondió HTTP ${response.status}.`, { httpStatus: response.status, code: body?.codigo, identifier: body?.identificador, details: Array.isArray(body?.detalles) ? body.detalles.filter((item): item is string => typeof item === "string") : undefined, retryable, operation, kind: httpErrorKind(response.status) });
  }

  private async json(response: Response, operation: "LOGIN" | "CREATE_ASSOCIATE" | "GET_ASSOCIATE_STATE" | "LIST_ASSOCIATES", allowEmpty = false): Promise<any> {
    try { return await response.json(); }
    catch { if (allowEmpty) return null; throw new AssociatesApiError("La API de asociados devolvió JSON inválido.", { retryable: false, operation }); }
  }
}

function stringOrUndefined(value: unknown) { return typeof value === "string" && value.trim() ? value : undefined; }

function assertStateRequest(input: SieAssociateStateRequest): void {
  if (!input || !(input.tipoDocumento === "1" || input.tipoDocumento === "4" || input.tipoDocumento === "7") || typeof input.numDocumento !== "string" || !input.numDocumento.trim()) {
    throw new AssociatesApiError("La consulta de estado requiere un tipo y número de documento válidos.", { retryable: false, operation: "GET_ASSOCIATE_STATE" });
  }
}

function parseAssociateState(value: unknown): SieAssociateState {
  if (!isRecord(value) || typeof value.status !== "boolean") throw invalidStateResponse("La API de asociados devolvió un estado inválido.");
  if (value.status === false) {
    if (typeof value.message !== "string") throw invalidStateResponse("La API de asociados devolvió un mensaje de estado inválido.");
    return { status: false, message: value.message };
  }
  if (!Array.isArray(value.cuotas)) throw invalidStateResponse("La API de asociados devolvió cuotas inválidas.");
  return { status: true, cuotas: value.cuotas.map(parseStateQuota) };
}

function parseStateQuota(value: unknown): SieAssociateStateQuota {
  if (!isRecord(value)) throw invalidStateResponse("La API de asociados devolvió una cuota inválida.");
  const concepto = oneOf(value.concepto, ["INSCRIPCION", "CUOTA"] as const);
  const numero = concepto === "INSCRIPCION"
    ? parseInscriptionNumber(value.numero)
    : finiteInteger(value.numero);
  const monto = finiteNumber(value.monto);
  if (monto < 0) throw invalidStateResponse("La API de asociados devolvió un monto inválido.");
  const anno = finiteInteger(value.anno);
  const estadoContable = oneOf(value.estadoContable, ["Facturado", "Pendiente"] as const);
  const fechaPago = dateField(value.fechaPago, estadoContable);
  const fechaInicio = dateField(value.fechaInicio, estadoContable, concepto === "INSCRIPCION");
  const fechaFin = dateField(value.fechaFin, estadoContable, concepto === "INSCRIPCION");
  return {
    concepto,
    numero,
    monto,
    moneda: oneOf(value.moneda, ["S/", "US$"] as const),
    anno,
    tipo: oneOf(value.tipo, ["Activo", "Estudiante", "Adherente", "Vitalicio", "Honorario", "Fallecido", "Renunciante", "Separado", "Anulado"] as const),
    estadoContable,
    fechaPago,
    fechaInicio,
    fechaFin,
    docGSer: stringField(value.docGSer),
    docGNro: stringField(value.docGNro),
  };
}

function parseInscriptionNumber(value: unknown): null {
  if (value === undefined || value === null) return null;
  throw invalidStateResponse("La API de asociados devolvió un número de cuota inválido.");
}

function dateField(value: unknown, estadoContable: "Facturado" | "Pendiente", allowEmptyInvoiced = false): string {
  if (typeof value !== "string") throw invalidStateResponse("La API de asociados devolvió una fecha inválida.");
  if (!value) {
    if (estadoContable === "Pendiente" || allowEmptyInvoiced) return value;
    throw invalidStateResponse("La API de asociados devolvió una fecha facturada vacía.");
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw invalidStateResponse("La API de asociados devolvió una fecha inválida.");
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) throw invalidStateResponse("La API de asociados devolvió una fecha inválida.");
  return value;
}

function stringField(value: unknown): string { if (typeof value !== "string") throw invalidStateResponse("La API de asociados devolvió un texto inválido."); return value; }
function finiteNumber(value: unknown): number { if (typeof value !== "number" || !Number.isFinite(value)) throw invalidStateResponse("La API de asociados devolvió un número inválido."); return value; }
function finiteInteger(value: unknown): number { if (typeof value !== "number" || !Number.isSafeInteger(value)) throw invalidStateResponse("La API de asociados devolvió un entero inválido."); return value; }
function oneOf<T extends string>(value: unknown, allowed: readonly T[]): T { if (typeof value !== "string" || !allowed.includes(value as T)) throw invalidStateResponse("La API de asociados devolvió un valor no soportado."); return value as T; }
function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
function invalidStateResponse(message: string): AssociatesApiError { return new AssociatesApiError(message, { retryable: false, operation: "GET_ASSOCIATE_STATE", kind: "INVALID_RESPONSE" }); }
function httpErrorKind(status: number): import("./AssociatesApiError").AssociatesApiErrorKind { if (status === 400) return "HTTP_400"; if (status === 401) return "HTTP_401"; if (status === 403) return "HTTP_403"; if (status === 409) return "HTTP_409"; return "HTTP_5XX"; }
