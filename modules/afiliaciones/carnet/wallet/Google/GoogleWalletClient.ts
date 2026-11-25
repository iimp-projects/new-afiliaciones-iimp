import { sign } from "jsonwebtoken";
import type { GoogleWalletConfig } from "@/lib/config/wallet";
import { WalletError, type GoogleWalletLinkDto, type WalletCardSnapshot } from "../Types/wallet";
import { googleWalletObjectId } from "../Services/walletIdentity";

const WALLET_API = "https://walletobjects.googleapis.com/walletobjects/v1";
const OAUTH_TOKEN_URL = "https://oauth2.googleapis.com/token";
const WALLET_SCOPE = "https://www.googleapis.com/auth/wallet_object.issuer";

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

interface GoogleWalletClientDeps {
  readonly fetchImpl?: FetchLike;
  readonly now?: () => Date;
}

export interface GoogleWalletDoctorResult {
  readonly auth: "OK" | "FAILED";
  readonly api: "OK" | "FAILED";
  readonly issuerAccess: "OK" | "FAILED";
  readonly classExists: "YES" | "NO" | "UNKNOWN";
  readonly classOperation?: "CREATED" | "REUSED";
  readonly classCreateError?: { readonly status?: number; readonly message?: string };
  readonly objectQuery: "OK" | "FAILED";
  readonly objectCount?: number;
  readonly status?: number;
}

interface CachedToken {
  readonly value: string;
  readonly expiresAtMs: number;
}

function localized(value: string) {
  return { defaultValue: { language: "es", value } };
}

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);
const MAX_ATTEMPTS = 3;

export function buildGenericClassPayload(config: GoogleWalletConfig, appBaseUrl: string) {
  return {
    id: config.classId,
    issuerName: "Instituto de Ingenieros de Minas del Perú",
    reviewStatus: "UNDER_REVIEW",
    localizedTitle: localized("Carné Virtual IIMP"),
    hexBackgroundColor: "#FFFFFF",
    homepageUri: { uri: appBaseUrl },
  };
}

export function buildGenericObjectPayload(input: {
  config: GoogleWalletConfig;
  snapshot: WalletCardSnapshot;
  appBaseUrl: string;
}) {
  const { config, snapshot, appBaseUrl } = input;
  // Google descarga `logo.sourceUri` desde sus servidores: solo se incluye con
  // un origen HTTPS público. En local (http://localhost) se omite para no enviar
  // una URL inalcanzable al proveedor.
  const logo = /^https:\/\//i.test(appBaseUrl)
    ? { logo: { sourceUri: { uri: `${appBaseUrl.replace(/\/+$/, "")}/images/logo-iimp.png` } } }
    : {};
  return {
    id: googleWalletObjectId(config.issuerId, snapshot.cardId, config.objectPrefix),
    classId: config.classId,
    state: snapshot.revoked ? "INACTIVE" : "ACTIVE",
    cardTitle: localized("Instituto de Ingenieros de Minas del Perú"),
    header: localized(snapshot.fullName),
    subheader: localized(snapshot.membershipType),
    hexBackgroundColor: "#FFFFFF",
    ...logo,
    barcode: {
      type: "QR_CODE",
      value: snapshot.verificationUrl,
      alternateText: snapshot.associateCode,
    },
    textModulesData: [
      { id: "associate_code", header: "Código de asociado", body: snapshot.associateCode },
      { id: "membership_type", header: "Membresía", body: snapshot.membershipType },
      { id: "membership_status", header: "Estado", body: snapshot.membershipStatus },
      { id: "issued_at", header: "Fecha de emisión", body: snapshot.issuedAt },
      { id: "verification", header: "Verificación", body: snapshot.verificationUrl },
    ],
  };
}

function mutableObjectFields(payload: ReturnType<typeof buildGenericObjectPayload>) {
  const { id: _id, classId: _classId, ...mutable } = payload;
  return mutable;
}

export class GoogleWalletClient {
  private tokenCache: CachedToken | null = null;
  private readonly fetchImpl: FetchLike;
  private readonly now: () => Date;

  constructor(
    private readonly config: GoogleWalletConfig,
    private readonly appBaseUrl: string,
    deps: GoogleWalletClientDeps = {},
  ) {
    this.fetchImpl = deps.fetchImpl ?? fetch;
    this.now = deps.now ?? (() => new Date());
  }

  async createSaveLink(snapshot: WalletCardSnapshot): Promise<GoogleWalletLinkDto> {
    const accessToken = await this.accessToken();
    await this.ensureClass(accessToken);
    const payload = buildGenericObjectPayload({ config: this.config, snapshot, appBaseUrl: this.appBaseUrl });
    const created = await this.upsertObject(accessToken, payload);
    // El JWT debe referenciar EXACTAMENTE el objeto creado (mismo objectPrefix).
    const jwt = this.signSaveJwt(payload.id);
    return {
      link: `https://pay.google.com/gp/v/save/${jwt}`,
      created,
      objectId: payload.id,
      status: "LINK_READY",
    };
  }

  async syncObject(snapshot: WalletCardSnapshot): Promise<void> {
    const accessToken = await this.accessToken();
    await this.ensureClass(accessToken);
    const payload = buildGenericObjectPayload({ config: this.config, snapshot, appBaseUrl: this.appBaseUrl });
    await this.upsertObject(accessToken, payload);
  }

  private signSaveJwt(objectId: string): string {
    const issuedAt = Math.floor(this.now().getTime() / 1000);
    // `origins` aplica al botón JS; para el enlace oficial basta con omitirlo en
    // local (http). Con HTTPS se declara el origen normalizado.
    const origins = /^https:\/\//i.test(this.appBaseUrl)
      ? { origins: [this.appBaseUrl.replace(/\/+$/, "")] }
      : {};
    return sign(
      {
        iss: this.config.serviceAccount.clientEmail,
        aud: "google",
        typ: "savetowallet",
        iat: issuedAt,
        ...origins,
        payload: {
          genericObjects: [{ id: objectId, classId: this.config.classId }],
        },
      },
      this.config.serviceAccount.privateKey,
      { algorithm: "RS256" },
    );
  }

  private async accessToken(): Promise<string> {
    const nowMs = this.now().getTime();
    if (this.tokenCache && this.tokenCache.expiresAtMs > nowMs + 30_000) return this.tokenCache.value;

    const issuedAt = Math.floor(nowMs / 1000);
    const assertion = sign(
      {
        iss: this.config.serviceAccount.clientEmail,
        scope: WALLET_SCOPE,
        aud: OAUTH_TOKEN_URL,
        iat: issuedAt,
        exp: issuedAt + 3600,
      },
      this.config.serviceAccount.privateKey,
      { algorithm: "RS256" },
    );

    const response = await this.request(OAUTH_TOKEN_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion,
      }).toString(),
    });
    if (!response.ok) throw new WalletError("PROVIDER_ERROR", "No pudimos conectar con Google Wallet.");
    const body = (await response.json().catch(() => null)) as { access_token?: unknown; expires_in?: unknown } | null;
    if (!body || typeof body.access_token !== "string") {
      throw new WalletError("PROVIDER_ERROR", "No pudimos conectar con Google Wallet.");
    }
    const expiresIn = typeof body.expires_in === "number" ? body.expires_in : 3600;
    this.tokenCache = { value: body.access_token, expiresAtMs: nowMs + expiresIn * 1000 };
    return body.access_token;
  }

  private async ensureClass(accessToken: string): Promise<"CREATED" | "REUSED"> {
    // Falla de forma segura si la clase configurada no pertenece al issuer.
    if (!this.config.classId.startsWith(`${this.config.issuerId}.`)) {
      throw new WalletError("PROVIDER_NOT_CONFIGURED", "La clase de Google Wallet no corresponde al emisor configurado.");
    }
    const url = `${WALLET_API}/genericClass/${encodeURIComponent(this.config.classId)}`;
    const current = await this.request(url, { headers: this.authHeaders(accessToken) });
    if (current.ok) return "REUSED";
    if (current.status !== 404) throw new WalletError("PROVIDER_ERROR", "No pudimos preparar la credencial en Google Wallet.");
    if (!this.config.classAutoCreate) {
      throw new WalletError("PROVIDER_NOT_CONFIGURED", "La clase institucional de Google Wallet aún no está aprobada.");
    }
    const created = await this.request(`${WALLET_API}/genericClass`, {
      method: "POST",
      headers: { ...this.authHeaders(accessToken), "content-type": "application/json" },
      body: JSON.stringify(buildGenericClassPayload(this.config, this.appBaseUrl)),
    });
    if (created.ok) return "CREATED";
    if (created.status === 409) return "REUSED";
    throw new WalletError("PROVIDER_ERROR", "No pudimos preparar la credencial en Google Wallet.");
  }

  /**
   * Diagnóstico sanitizado: no expone tokens, JWT ni credenciales. Comprueba
   * autenticación, acceso al emisor, la clase y la consulta de objetos.
   */
  async doctor(options: { createClass?: boolean } = {}): Promise<GoogleWalletDoctorResult> {
    let accessToken: string;
    try {
      accessToken = await this.accessToken();
    } catch {
      return { auth: "FAILED", api: "FAILED", issuerAccess: "FAILED", classExists: "UNKNOWN", objectQuery: "FAILED" };
    }

    let classExists: "YES" | "NO" | "UNKNOWN" = "UNKNOWN";
    let issuerAccess: "OK" | "FAILED" = "FAILED";
    let api: "OK" | "FAILED" = "FAILED";
    let status: number | undefined;
    let classOperation: "CREATED" | "REUSED" | undefined;

    try {
      const response = await this.request(`${WALLET_API}/genericClass/${encodeURIComponent(this.config.classId)}`, {
        headers: this.authHeaders(accessToken),
      });
      status = response.status;
      if (response.ok) {
        classExists = "YES";
        issuerAccess = "OK";
        api = "OK";
      } else if (response.status === 404) {
        classExists = "NO";
        issuerAccess = "OK";
        api = "OK";
      }
    } catch {
      status = undefined;
    }

    let classCreateError: { status?: number; message?: string } | undefined;
    if (options.createClass && this.config.classAutoCreate) {
      const created = await this.createClassDiagnostic(accessToken);
      if (created.operation) {
        classOperation = created.operation;
        classExists = "YES";
        issuerAccess = "OK";
        api = "OK";
      } else {
        classCreateError = { status: created.status, message: created.error };
      }
    }

    let objectQuery: "OK" | "FAILED" = "FAILED";
    let objectCount: number | undefined;
    if (classExists === "YES") {
      try {
        const response = await this.request(
          `${WALLET_API}/genericObject?classId=${encodeURIComponent(this.config.classId)}&maxResults=10`,
          { headers: this.authHeaders(accessToken) },
        );
        if (response.ok) {
          objectQuery = "OK";
          const body = (await response.json().catch(() => null)) as { resources?: unknown } | null;
          objectCount = Array.isArray(body?.resources) ? body.resources.length : 0;
        }
      } catch {
        objectQuery = "FAILED";
      }
    }

    return { auth: "OK", api, issuerAccess, classExists, classOperation, classCreateError, objectQuery, objectCount, status };
  }

  /** Inspección sanitizada de un objeto: no devuelve datos personales ni tokens. */
  async inspectObject(objectId: string): Promise<{
    found: boolean;
    status?: number;
    state?: string;
    classId?: string;
    hasBarcode?: boolean;
    textModules?: number;
  }> {
    const accessToken = await this.accessToken();
    const response = await this.request(`${WALLET_API}/genericObject/${encodeURIComponent(objectId)}`, {
      headers: this.authHeaders(accessToken),
    });
    if (!response.ok) return { found: false, status: response.status };
    const body = (await response.json().catch(() => null)) as
      | { state?: unknown; classId?: unknown; barcode?: unknown; textModulesData?: unknown }
      | null;
    return {
      found: true,
      status: response.status,
      state: typeof body?.state === "string" ? body.state : undefined,
      classId: typeof body?.classId === "string" ? body.classId : undefined,
      hasBarcode: Boolean(body?.barcode),
      textModules: Array.isArray(body?.textModulesData) ? body.textModulesData.length : 0,
    };
  }

  private async createClassDiagnostic(
    accessToken: string,
  ): Promise<{ operation?: "CREATED" | "REUSED"; status?: number; error?: string }> {
    try {
      const response = await this.request(`${WALLET_API}/genericClass`, {
        method: "POST",
        headers: { ...this.authHeaders(accessToken), "content-type": "application/json" },
        body: JSON.stringify(buildGenericClassPayload(this.config, this.appBaseUrl)),
      });
      if (response.ok) return { operation: "CREATED", status: response.status };
      if (response.status === 409) return { operation: "REUSED", status: response.status };
      let message: string | undefined;
      try {
        const body = (await response.json()) as { error?: { message?: unknown } };
        if (typeof body?.error?.message === "string") message = body.error.message.slice(0, 240);
      } catch {
        message = undefined;
      }
      return { status: response.status, error: message };
    } catch (error) {
      return { error: error instanceof Error ? error.name : "UnknownError" };
    }
  }

  private async upsertObject(
    accessToken: string,
    payload: ReturnType<typeof buildGenericObjectPayload>,
  ): Promise<boolean> {
    this.assertObjectScope(payload.id);
    const url = `${WALLET_API}/genericObject/${encodeURIComponent(payload.id)}`;
    const current = await this.request(url, { headers: this.authHeaders(accessToken) });
    if (current.ok) {
      const existing = (await current.json().catch(() => null)) as { classId?: unknown } | null;
      if (existing && typeof existing.classId === "string" && existing.classId !== this.config.classId) {
        throw new WalletError("PROVIDER_ERROR", "El pase pertenece a otra clase de Wallet y no se modificará.");
      }
      const updated = await this.request(url, {
        method: "PATCH",
        headers: { ...this.authHeaders(accessToken), "content-type": "application/json" },
        body: JSON.stringify(mutableObjectFields(payload)),
      });
      if (!updated.ok) throw new WalletError("PROVIDER_ERROR", "No pudimos actualizar tu pase de Google Wallet.");
      return false;
    }
    if (current.status !== 404) throw new WalletError("PROVIDER_ERROR", "No pudimos consultar tu pase de Google Wallet.");

    const created = await this.request(`${WALLET_API}/genericObject`, {
      method: "POST",
      headers: { ...this.authHeaders(accessToken), "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (created.ok) return true;
    if (created.status === 409) {
      const updated = await this.request(url, {
        method: "PATCH",
        headers: { ...this.authHeaders(accessToken), "content-type": "application/json" },
        body: JSON.stringify(mutableObjectFields(payload)),
      });
      if (updated.ok) return false;
    }
    throw new WalletError("PROVIDER_ERROR", "No pudimos crear tu pase de Google Wallet.");
  }

  /**
   * Reintenta únicamente fallos transitorios (red, 429 y 5xx) con backoff
   * acotado. Los errores permanentes (4xx) se devuelven sin reintento.
   */
  private async request(url: string, init: RequestInit): Promise<Response> {
    let lastError: unknown;
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
      try {
        const response = await this.fetchImpl(url, {
          ...init,
          signal: init.signal ?? AbortSignal.timeout(15_000),
        });
        if (!RETRYABLE_STATUS.has(response.status) || attempt === MAX_ATTEMPTS - 1) return response;
      } catch (error) {
        lastError = error;
        if (attempt === MAX_ATTEMPTS - 1) throw error;
      }
      await sleep(200 * 2 ** attempt);
    }
    throw lastError ?? new Error("Google Wallet no respondió.");
  }

  private assertObjectScope(objectId: string): void {
    const expectedPrefix = `${this.config.issuerId}.${this.config.objectPrefix}`;
    if (!objectId.startsWith(expectedPrefix)) {
      throw new WalletError("PROVIDER_ERROR", "El identificador del pase no pertenece al namespace del ambiente.");
    }
  }

  private authHeaders(accessToken: string): Record<string, string> {
    return { authorization: `Bearer ${accessToken}` };
  }
}
