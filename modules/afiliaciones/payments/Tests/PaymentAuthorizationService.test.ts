import { beforeEach, describe, expect, it, vi } from "vitest";

const storedTokens = new Set<string>();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    verificationToken: {
      create: vi.fn(async ({ data }: { data: { token: string } }) => { storedTokens.add(data.token); return data; }),
      findFirst: vi.fn(async ({ where }: { where: { token: string } }) => (storedTokens.has(where.token) ? { token: where.token } : null)),
      deleteMany: vi.fn(async ({ where }: { where: { token: string } }) => {
        const existed = storedTokens.delete(where.token);
        return { count: existed ? 1 : 0 };
      }),
    },
  },
}));

import { PaymentAuthorizationService } from "../Services/PaymentAuthorizationService";

describe("PaymentAuthorizationService", () => {
  beforeEach(() => {
    storedTokens.clear();
    process.env.PAYMENT_AUTH_SECRET = "test-secret-with-at-least-32-characters";
  });

  it("separa el propósito de autorización del callback", async () => {
    const service = new PaymentAuthorizationService();
    const callback = await service.createCallbackReference(7, 42, 60);
    expect(service.verify(callback, 42)).toBe(false);
  });

  it("consume el JTI del callback una sola vez", async () => {
    const service = new PaymentAuthorizationService();
    const callback = await service.createCallbackReference(7, 42, 60);
    expect(await service.consumeCallbackReference(callback)).toMatchObject({ paymentId: 7, applicationId: 42 });
    expect(await service.consumeCallbackReference(callback)).toBeNull();
  });

  it("verifica la referencia de callback sin consumirla y la rechaza tras consumir", async () => {
    const service = new PaymentAuthorizationService();
    const callback = await service.createCallbackReference(7, 42, 60);

    expect(await service.verifyCallbackReference(callback)).toMatchObject({ paymentId: 7, applicationId: 42 });
    // Sigue disponible para un reintento legítimo.
    expect(await service.verifyCallbackReference(callback)).toMatchObject({ paymentId: 7, applicationId: 42 });

    expect(await service.consumeCallbackReference(callback)).toMatchObject({ paymentId: 7, applicationId: 42 });
    expect(await service.verifyCallbackReference(callback)).toBeNull();
  });

  it("rechaza una referencia de callback desconocida", async () => {
    const service = new PaymentAuthorizationService();
    expect(await service.verifyCallbackReference("no-es-un-token")).toBeNull();
    expect(await service.verifyCallbackReference(undefined)).toBeNull();
  });

  it("liga la restauración al secreto de la cookie", () => {
    const service = new PaymentAuthorizationService();
    const restore = service.createRestoreReference(7, 42, 60);
    expect(service.verifyRestoreReference(restore.reference, restore.session)).toMatchObject({ paymentId: 7, applicationId: 42 });
    expect(service.verifyRestoreReference(restore.reference, "otra-sesion")).toBeNull();
  });
});
