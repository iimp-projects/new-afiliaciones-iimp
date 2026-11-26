import { connect } from "node:http2";
import { sign } from "jsonwebtoken";
import type { AppleApnsConfig } from "@/lib/config/wallet";

export type ApplePushResult = "delivered" | "unregistered" | "failed";

export interface ApplePushTransport {
  send(input: { pushToken: string; authorization: string; topic: string; host: string }): Promise<ApplePushResult>;
}

export class Http2ApplePushTransport implements ApplePushTransport {
  async send(input: { pushToken: string; authorization: string; topic: string; host: string }): Promise<ApplePushResult> {
    const client = connect(`https://${input.host}`);
    try {
      return await new Promise<ApplePushResult>((resolve) => {
        const request = client.request({
          ":method": "POST",
          ":path": `/3/device/${encodeURIComponent(input.pushToken)}`,
          authorization: input.authorization,
          "apns-topic": input.topic,
          "apns-push-type": "background",
          "apns-priority": "5",
          "content-length": "0",
        });
        let status = 0;
        request.on("response", (headers) => {
          status = Number(headers[":status"] ?? 0);
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
 * Notificación silenciosa de actualización de pases. Si APNs no está
 * configurado, la sincronización institucional continúa y el pase se actualiza
 * cuando el dispositivo lo consulte.
 */
export class ApplePushService {
  private cachedToken: { value: string; expiresAtMs: number } | null = null;

  constructor(
    private readonly config: AppleApnsConfig,
    private readonly passTypeIdentifier: string,
    private readonly transport: ApplePushTransport = new Http2ApplePushTransport(),
    private readonly now: () => Date = () => new Date(),
    private readonly host = "api.push.apple.com",
  ) {}

  async notify(pushToken: string): Promise<ApplePushResult> {
    if (!pushToken.trim()) return "failed";
    const authorization = `bearer ${this.providerToken()}`;
    return this.transport.send({
      pushToken,
      authorization,
      topic: this.passTypeIdentifier,
      host: this.host,
    });
  }

  private providerToken(): string {
    const nowMs = this.now().getTime();
    if (this.cachedToken && this.cachedToken.expiresAtMs > nowMs) return this.cachedToken.value;
    const issuedAt = Math.floor(nowMs / 1000);
    const token = sign(
      { iss: this.config.teamId, iat: issuedAt },
      this.config.privateKeyPem,
      { algorithm: "ES256", header: { alg: "ES256", kid: this.config.keyId } },
    );
    this.cachedToken = { value: token, expiresAtMs: nowMs + 50 * 60 * 1000 };
    return token;
  }
}
