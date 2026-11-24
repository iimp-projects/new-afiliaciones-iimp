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
  return {
    id: googleWalletObjectId(config.issuerId, snapshot.cardId),
    classId: config.classId,
    state: snapshot.revoked ? "INACTIVE" : "ACTIVE",
    cardTitle: localized("Instituto de Ingenieros de Minas del Perú"),
    header: localized(snapshot.fullName),
    subheader: localized(snapshot.membershipType),
    hexBackgroundColor: "#FFFFFF",
    logo: { sourceUri: { uri: `${appBaseUrl.replace(/\/+$/, "")}/images/logo-iimp.png` } },
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
    const jwt = this.signSaveJwt(googleWalletObjectId(this.config.issuerId, snapshot.cardId));
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
    return sign(
      {
        iss: this.config.serviceAccount.clientEmail,
        aud: "google",
        typ: "savetowallet",
        iat: issuedAt,
        origins: [this.appBaseUrl],
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

  private async ensureClass(accessToken: string): Promise<void> {
    const url = `${WALLET_API}/genericClass/${encodeURIComponent(this.config.classId)}`;
    const current = await this.request(url, { headers: this.authHeaders(accessToken) });
    if (current.ok) return;
    if (current.status !== 404) throw new WalletError("PROVIDER_ERROR", "No pudimos preparar la credencial en Google Wallet.");
    if (!this.config.classAutoCreate) {
      throw new WalletError("PROVIDER_NOT_CONFIGURED", "La clase institucional de Google Wallet aún no está aprobada.");
    }
    const created = await this.request(`${WALLET_API}/genericClass`, {
      method: "POST",
      headers: { ...this.authHeaders(accessToken), "content-type": "application/json" },
      body: JSON.stringify(buildGenericClassPayload(this.config, this.appBaseUrl)),
    });
    if (!created.ok && created.status !== 409) {
      throw new WalletError("PROVIDER_ERROR", "No pudimos preparar la credencial en Google Wallet.");
    }
  }

  private async upsertObject(
    accessToken: string,
    payload: ReturnType<typeof buildGenericObjectPayload>,
  ): Promise<boolean> {
    const url = `${WALLET_API}/genericObject/${encodeURIComponent(payload.id)}`;
    const current = await this.request(url, { headers: this.authHeaders(accessToken) });
    if (current.ok) {
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

  private authHeaders(accessToken: string): Record<string, string> {
    return { authorization: `Bearer ${accessToken}` };
  }
}
