import { PaymentStatus, Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { PaymentRepository } from "../Repositories/PaymentRepository";

describe("PaymentRepository.resetSandboxPayment", () => {
  it("deja el pago PENDING y elimina únicamente el resultado previo de Niubiz", async () => {
    const update = vi.fn().mockResolvedValue({});
    const repository = new PaymentRepository({} as never);
    await repository.resetSandboxPayment(71, { payment: { update } } as unknown as Prisma.TransactionClient);

    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 71 },
      data: expect.objectContaining({
        status: PaymentStatus.PENDING,
        transactionId: null,
        authorizationCode: null,
        responseCode: null,
        paymentDate: null,
        gatewayTransactionDate: null,
        cardBrand: null,
        maskedCard: null,
        paymentChannel: null,
        actionCode: null,
        cardType: null,
        traceNumber: null,
        failureCode: null,
        failureReason: null,
        gatewayErrorCode: null,
        failureAt: null,
        confirmationEmailSentAt: null,
        gatewayPayload: Prisma.DbNull,
      }),
    }));
  });

  it("crea el AuditLog SANDBOX_PAYMENT_RESET sin guardar metadata de Niubiz", async () => {
    const create = vi.fn().mockResolvedValue({});
    const repository = new PaymentRepository({} as never);
    await repository.createSandboxResetAudit({
      userId: 11,
      paymentId: 71,
      applicationId: 42,
      previousStatus: PaymentStatus.PAID,
      ipAddress: "127.0.0.1",
      userAgent: "Vitest",
    }, { auditLog: { create } } as unknown as Prisma.TransactionClient);

    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 11,
        action: "SANDBOX_PAYMENT_RESET",
        entity: "Payment",
        entityId: "71",
        oldValues: { status: PaymentStatus.PAID },
        newValues: { status: PaymentStatus.PENDING, applicationId: 42 },
      }),
    });
  });
});
