import { connect } from "node:http2";
import { sign } from "jsonwebtoken";
import type { AppleApnsConfig } from "@/lib/config/wallet";

export type ApplePushResult = "delivered" | "unregistered" | "failed";

export interface ApplePushTlsOptions {
  readonly cert: string;
  readonly key: string;
  readonly passphrase?: string | null;
}

export interface ApplePushCertificate {
  readonly certificatePem: string;
  readonly privateKeyPem: string;
  readonly passphrase: string | null;
}

export interface ApplePushTransportInput {
  readonly pushToken: string;
  readonly authorization: string | null;
  readonly topic: string;
  readonly host: string;
  readonly tls?: ApplePushTlsOptions;
}

export interface ApplePushTransport {
  send(input: ApplePushTransportInput): Promise<ApplePushResult>;
}

export class Http2ApplePushTransport implements ApplePushTransport {
  async send(input: ApplePushTransportInput): Promise<ApplePushResult> {
    const client = input.tls
      ? connect(`https://${input.host}`, {
          cert: input.tls.cert,
          key: input.tls.key,
          passphrase: input.tls.passphrase ?? undefined,
        })
      : connect(`https://${input.host}`);
    try {
      return await new Promise<ApplePushResult>((resolve) => {
        const headers: Record<string, string | number> = {
          ":method": "POST",
          ":path": `/3/device/${encodeURIComponent(input.pushToken)}`,
          "apns-topic": input.topic,
          "apns-push-type": "background",
          "apns-priority": "5",
          "content-length": "0",
        };
        if (input.authorization) headers.authorization = input.authorization;
        const request = client.request(headers);
        let status = 0;
        request.on("response", (responseHeaders) => {
          status = Number(responseHeaders[":status"] ?? 0);
        });
        const timer = setTimeout(() => {
          request.destroy();
          client.destroy();
          resolve("failed");
        }, 10_000);
        const finish = (result: ApplePushResult) => {
          clearTimeout(timer);
          resolve(result);
        };
        request.on("error", () => finish("failed"));
        request.on("end", () => {
          if (status === 200) finish("delivered");
          else if (status === 410) finish("unregistered");
          else finish("failed");
        });
        request.end();
      });
    } catch {
      return "failed";
    } finally {
      client.close();
    }
  }
}

/**
 * Notificación silenciosa de actualización de pases.
 *
 * Mecanismo preferido (documentado por Apple para Wallet): autenticación con el
 * MISMO certificado y clave privada del Pass Type ID que firma el pase
 * (`tls`/client certificate), topic = Pass Type ID, payload vacío y endpoint de
 * PRODUCCIÓN (`api.push.apple.com`).
 *
 * Fallback: token-based APNs (JWT ES256 con `.p8` Auth Key) cuando no se provee
 * certificado del pase. Si APNs no está configurado, la sincronización
 * institucional continúa y el pase se actualiza cuando el dispositivo consulta.
 */
export class ApplePushService {
  private cachedToken: { value: string; expiresAtMs: number } | null = null;

  constructor(
    private readonly config: AppleApnsConfig | null,
    private readonly passTypeIdentifier: string,
    private readonly transport: ApplePushTransport = new Http2ApplePushTransport(),
    private readonly now: () => Date = () => new Date(),
    private readonly host = "api.push.apple.com",
    private readonly certificate: ApplePushCertificate | null = null,
  ) {}

  async notify(pushToken: string): Promise<ApplePushResult> {
    if (!pushToken.trim()) return "failed";

    if (this.certificate) {
      return this.transport.send({
        pushToken,
        authorization: null,
        topic: this.passTypeIdentifier,
        host: this.host,
        tls: {
          cert: this.certificate.certificatePem,
          key: this.certificate.privateKeyPem,
          passphrase: this.certificate.passphrase,
        },
      });
    }

    if (!this.config) return "failed";
    const authorization = `bearer ${this.providerToken()}`;
    return this.transport.send({
      pushToken,
      authorization,
      topic: this.passTypeIdentifier,
      host: this.host,
    });
  }

  private providerToken(): string {
    const config = this.config;
    if (!config) throw new Error("APNs token config missing");
    const nowMs = this.now().getTime();
    if (this.cachedToken && this.cachedToken.expiresAtMs > nowMs) return this.cachedToken.value;
    const issuedAt = Math.floor(nowMs / 1000);
    const token = sign(
      { iss: config.teamId, iat: issuedAt },
      config.privateKeyPem,
      { algorithm: "ES256", header: { alg: "ES256", kid: config.keyId } },
    );
    // APNs exige refrescar entre 20 y 60 minutos; 50 min es seguro.
    this.cachedToken = { value: token, expiresAtMs: nowMs + 50 * 60 * 1000 };
    return token;
  }
}
