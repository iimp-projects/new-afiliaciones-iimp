import { createHmac, timingSafeEqual } from "crypto";

const COOKIE_NAME = "iimp_payment_authorization";

interface PaymentAuthorizationPayload {
  applicationId: number;
  expiresAt: number;
}

interface PaymentCallbackPayload extends PaymentAuthorizationPayload {
  paymentId: number;
}

export class PaymentAuthorizationService {
  get cookieName(): string {
    return COOKIE_NAME;
  }

  create(applicationId: number, ttlSeconds: number): string {
    const payload: PaymentAuthorizationPayload = {
      applicationId,
      expiresAt: Date.now() + ttlSeconds * 1000,
    };
    const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
    return `${encodedPayload}.${this.sign(encodedPayload)}`;
  }

  verify(token: string | undefined, applicationId: number): boolean {
    const payload = this.verifyPayload<PaymentAuthorizationPayload>(token);
    return payload?.applicationId === applicationId;
  }

  createCallbackReference(paymentId: number, applicationId: number, ttlSeconds: number): string {
    const payload: PaymentCallbackPayload = { paymentId, applicationId, expiresAt: Date.now() + ttlSeconds * 1000 };
    const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
    return `${encodedPayload}.${this.sign(encodedPayload)}`;
  }

  verifyCallbackReference(token: string | undefined): PaymentCallbackPayload | null {
    const payload = this.verifyPayload<PaymentCallbackPayload>(token);
    return payload && Number.isInteger(payload.paymentId) && payload.paymentId > 0 ? payload : null;
  }

  private verifyPayload<T extends PaymentAuthorizationPayload>(token: string | undefined): T | null {
    if (!token) return null;

    const [encodedPayload, signature, extra] = token.split(".");
    if (!encodedPayload || !signature || extra) return null;

    const expectedSignature = this.sign(encodedPayload);
    const received = Buffer.from(signature);
    const expected = Buffer.from(expectedSignature);

    if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
      return null;
    }

    try {
      const payload = JSON.parse(
        Buffer.from(encodedPayload, "base64url").toString("utf8"),
      ) as T;

      return (
        Number.isInteger(payload.applicationId) &&
        Number.isFinite(payload.expiresAt) &&
        payload.expiresAt > Date.now()
      ) ? payload : null;
    } catch {
      return null;
    }
  }

  private sign(value: string): string {
    return createHmac("sha256", this.secret).update(value).digest("base64url");
  }

  private get secret(): string {
    const secret = process.env.PAYMENT_AUTH_SECRET || process.env.AUTH_SECRET;
    if (!secret) {
      throw new Error("No se configuró PAYMENT_AUTH_SECRET ni AUTH_SECRET.");
    }

    return secret;
  }
}

export const paymentAuthorizationService = new PaymentAuthorizationService();
