import { Currency, PaymentGateway, PaymentMethod, PaymentStatus, Prisma, type PrismaClient } from "@prisma/client";
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
        paymentMethod: PaymentMethod.UNKNOWN,
        paymentBrand: null,
      }),
    }));
    expect(JSON.stringify(update.mock.calls[0]?.[0])).not.toContain("transactionToken");
  });

  it("persiste paymentMethod WALLET y paymentBrand YAPE provenientes del resultado del proveedor", async () => {
    const update = vi.fn().mockResolvedValue({
      id: 99,
      applicationId: 42,
      totalAmount: new Prisma.Decimal(300),
      currency: Currency.PEN,
      gateway: PaymentGateway.NIUBIZ,
      status: PaymentStatus.PAID,
    });
    const repository = new PaymentRepository({ payment: { update } } as unknown as PrismaClient);

    await repository.updatePaymentResult(99, {
      status: PaymentStatus.PAID,
      paymentMethod: PaymentMethod.WALLET,
      paymentBrand: "YAPE",
      cardBrand: "visa",
      cardType: "D",
      maskedCard: "455788******3051",
      paymentChannel: "web",
      gatewayPayload: { brand: "visa", maskedCard: "455788******3051", paymentMethod: "WALLET", paymentBrand: "YAPE" },
    });

    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        paymentMethod: PaymentMethod.WALLET,
        paymentBrand: "YAPE",
      }),
    }));
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

  it("incluye la fecha de registro (createdAt) de la persona en el snapshot de aplicación", async () => {
    const createdAt = new Date("2026-01-15T12:00:00Z");
    const findUnique = vi.fn().mockResolvedValue({
      id: 42,
      personId: 7,
      status: "READY_FOR_PAYMENT",
      deletedAt: null,
      email: "applicant@example.com",
      phone: "999999999",
      documentNumber: "12345678",
      person: { firstName: "Ana", paternalLastName: "Pérez", createdAt, addresses: [] },
    });
    const repository = new PaymentRepository({ membershipApplication: { findUnique } } as unknown as PrismaClient);

    const snapshot = await repository.findApplicationById(42);

    expect(snapshot?.person?.createdAt).toEqual(createdAt);
    expect(findUnique).toHaveBeenCalledWith(expect.objectContaining({
      select: expect.objectContaining({
        person: expect.objectContaining({ select: expect.objectContaining({ createdAt: true }) }),
      }),
    }));
  });
});
