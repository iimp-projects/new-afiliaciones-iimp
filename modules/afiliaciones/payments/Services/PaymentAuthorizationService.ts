import { createHash, createHmac, randomBytes, timingSafeEqual } from "crypto";
import { prisma } from "@/lib/prisma";
import { getPaymentAuthSecret } from "@/lib/config/env";

const COOKIE_NAME = "iimp_payment_authorization";
const RESTORE_COOKIE_NAME = "iimp_payment_restore";
const CALLBACK_PURPOSE = "payment_callback";
const RESTORE_PURPOSE = "payment_restore";

interface PaymentAuthorizationPayload {
  applicationId: number;
  expiresAt: number;
  purpose: "payment_authorization";
}

interface PaymentCallbackPayload {
  applicationId: number;
  expiresAt: number;
  paymentId: number;
  purpose: typeof CALLBACK_PURPOSE;
  jti: string;
}

interface PaymentRestorePayload {
  applicationId: number;
  expiresAt: number;
  paymentId: number;
  purpose: typeof RESTORE_PURPOSE;
  sessionHash: string;
}

export class PaymentAuthorizationService {
  get cookieName(): string {
    return COOKIE_NAME;
  }

  get restoreCookieName(): string {
    return RESTORE_COOKIE_NAME;
  }

  create(applicationId: number, ttlSeconds: number): string {
    const payload: PaymentAuthorizationPayload = {
      applicationId,
      expiresAt: Date.now() + ttlSeconds * 1000,
      purpose: "payment_authorization",
    };
    const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
    return `${encodedPayload}.${this.sign(encodedPayload, payload.purpose)}`;
  }

  verify(token: string | undefined, applicationId: number): boolean {
    const payload = this.verifyPayload<PaymentAuthorizationPayload>(token, "payment_authorization");
    return payload?.applicationId === applicationId;
  }

  async createCallbackReference(paymentId: number, applicationId: number, ttlSeconds: number): Promise<string> {
    const jti = randomBytes(32).toString("base64url");
    const expiresAt = Date.now() + ttlSeconds * 1000;
    const payload: PaymentCallbackPayload = { paymentId, applicationId, expiresAt, purpose: CALLBACK_PURPOSE, jti };
    const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
    await prisma.verificationToken.create({
      data: {
        identifier: this.callbackIdentifier(paymentId, applicationId),
        token: this.hash(jti),
        expires: new Date(expiresAt),
      },
    });
    return `${encodedPayload}.${this.sign(encodedPayload, CALLBACK_PURPOSE)}`;
  }

  async verifyCallbackReference(token: string | undefined): Promise<PaymentCallbackPayload | null> {
    const payload = this.verifyPayload<PaymentCallbackPayload>(token, CALLBACK_PURPOSE);
    if (!payload || !Number.isInteger(payload.paymentId) || payload.paymentId <= 0 || !payload.jti) return null;
    const existing = await prisma.verificationToken.findFirst({
      where: {
        identifier: this.callbackIdentifier(payload.paymentId, payload.applicationId),
        token: this.hash(payload.jti),
        expires: { gt: new Date() },
      },
      select: { token: true },
    });
    return existing ? payload : null;
  }

  async consumeCallbackReference(token: string | undefined): Promise<PaymentCallbackPayload | null> {
    const payload = this.verifyPayload<PaymentCallbackPayload>(token, CALLBACK_PURPOSE);
    if (!payload || !Number.isInteger(payload.paymentId) || payload.paymentId <= 0 || !payload.jti) return null;
    const consumed = await prisma.verificationToken.deleteMany({
      where: {
        identifier: this.callbackIdentifier(payload.paymentId, payload.applicationId),
        token: this.hash(payload.jti),
        expires: { gt: new Date() },
      },
    });
    return consumed.count === 1 ? payload : null;
  }

  createRestoreReference(paymentId: number, applicationId: number, ttlSeconds: number): { reference: string; session: string } {
    const session = randomBytes(32).toString("base64url");
    const payload: PaymentRestorePayload = {
      paymentId,
      applicationId,
      expiresAt: Date.now() + ttlSeconds * 1000,
      purpose: RESTORE_PURPOSE,
      sessionHash: this.hash(session),
    };
    const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
    return { reference: `${encodedPayload}.${this.sign(encodedPayload, RESTORE_PURPOSE)}`, session };
  }

  verifyRestoreReference(token: string | undefined, session: string | undefined): PaymentRestorePayload | null {
    const payload = this.verifyPayload<PaymentRestorePayload>(token, RESTORE_PURPOSE);
    if (!payload || !session || !Number.isInteger(payload.paymentId) || payload.paymentId <= 0) return null;
    const received = Buffer.from(this.hash(session));
    const expected = Buffer.from(payload.sessionHash);
    return received.length === expected.length && timingSafeEqual(received, expected) ? payload : null;
  }

  private verifyPayload<T extends { applicationId: number; expiresAt: number; purpose: string }>(token: string | undefined, purpose: string): T | null {
    if (!token) return null;

    const [encodedPayload, signature, extra] = token.split(".");
    if (!encodedPayload || !signature || extra) return null;

    const expectedSignature = this.sign(encodedPayload, purpose);
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
        payload.expiresAt > Date.now() &&
        payload.purpose === purpose
      ) ? payload : null;
    } catch {
      return null;
    }
  }

  private callbackIdentifier(paymentId: number, applicationId: number): string {
    return `payment-callback:${paymentId}:${applicationId}`;
  }

  private hash(value: string): string {
    return createHash("sha256").update(value).digest("hex");
  }

  private sign(value: string, purpose: string): string {
    return createHmac("sha256", this.secret).update(`${purpose}:${value}`).digest("base64url");
  }

  private get secret(): string {
    return getPaymentAuthSecret();
  }
}

export const paymentAuthorizationService = new PaymentAuthorizationService();
