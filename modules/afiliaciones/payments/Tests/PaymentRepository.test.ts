import { Currency, PaymentGateway, PaymentStatus, Prisma, type PrismaClient } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { PaymentRepository } from "../Repositories/PaymentRepository";

describe("PaymentRepository", () => {
  it("persiste solamente metadata Niubiz estructurada y ya saneada", async () => {
    const update = vi.fn().mockResolvedValue({
      id: 99,
      applicationId: 42,
      totalAmount: new Prisma.Decimal(300),
      currency: Currency.PEN,
      gateway: PaymentGateway.NIUBIZ,
      status: PaymentStatus.PAID,
    });
    const repository = new PaymentRepository({ payment: { update } } as unknown as PrismaClient);
    const gatewayTransactionDate = new Date(Date.UTC(2026, 8, 3, 15, 22, 21));

    const payment = await repository.updatePaymentResult(99, {
      status: PaymentStatus.PAID,
      transactionId: "transaction-1",
      authorizationCode: "123456",
      gatewayTransactionDate,
      cardBrand: "visa",
      maskedCard: "455170******8059",
      paymentChannel: "web",
      failureCode: "400",
      failureReason: "Denegada",
      gatewayErrorCode: "400",
      actionCode: "000",
      cardType: "C",
      traceNumber: "trace-1",
      gatewayPayload: { transactionDate: "260903152221", brand: "visa", maskedCard: "455170******8059" },
    });

    expect(payment).toMatchObject({ id: 99, status: PaymentStatus.PAID, totalAmount: 300 });
    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 99 },
      data: expect.objectContaining({
        gatewayTransactionDate,
        cardBrand: "visa",
        maskedCard: "455170******8059",
        paymentChannel: "web",
        failureCode: null,
        failureReason: null,
        gatewayErrorCode: null,
        failureAt: null,
        actionCode: "000",
        cardType: "C",
        traceNumber: "trace-1",
      }),
    }));
    expect(JSON.stringify(update.mock.calls[0]?.[0])).not.toContain("transactionToken");
  });

  it("persiste fecha y detalles solo para un rechazo definitivo", async () => {
    const update = vi.fn().mockResolvedValue({
      id: 99, applicationId: 42, totalAmount: new Prisma.Decimal(300), currency: Currency.PEN, gateway: PaymentGateway.NIUBIZ, status: PaymentStatus.FAILED,
    });
    const repository = new PaymentRepository({ payment: { update } } as unknown as PrismaClient);

    await repository.updatePaymentResult(99, {
      status: PaymentStatus.FAILED,
      responseCode: "400",
      failureCode: "400",
      failureReason: "Denegada",
      gatewayErrorCode: "400",
      gatewayPayload: { actionDescription: "Denegada" },
    });

    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        failureCode: "400",
        failureReason: "Denegada",
        gatewayErrorCode: "400",
        failureAt: expect.any(Date),
      }),
    }));
  });
});
