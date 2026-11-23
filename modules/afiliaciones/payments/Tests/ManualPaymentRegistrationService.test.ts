import { ApplicationStatus, DocumentCategory, PaymentGateway, PaymentMethod, PaymentStatus } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = {
  membershipApplication: { findUnique: vi.fn() },
  payment: { findFirst: vi.fn() },
  $transaction: vi.fn(),
};

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/modules/shared/Services/S3StorageService", () => ({
  S3StorageService: class {
    async uploadFile() { return "afiliaciones/applications/10/documents/voucher.pdf"; }
  },
}));

const { ManualPaymentError, ManualPaymentRegistrationService } = await import("../Services/ManualPaymentRegistrationService");

const amounts = { resolve: vi.fn().mockResolvedValue({ registrationAmount: 150, membershipFeeAmount: 150, totalAmount: 300, currency: "PEN" }) };
const repository = { findActivePaymentIntegrationSource: vi.fn().mockResolvedValue(null) };
const calculator = { recalculate: vi.fn().mockResolvedValue(ApplicationStatus.COMPLETED) };
const integration = { prepareActivePayment: vi.fn(), processAfterCommit: vi.fn() };
const provisioning = { provisionCompletedApplication: vi.fn().mockResolvedValue({ activationRequired: true }) };
const confirmationEmail = { sendIfNeeded: vi.fn().mockResolvedValue(undefined) };
const storage = { uploadFile: vi.fn().mockResolvedValue("afiliaciones/applications/10/documents/voucher.pdf") };

const tx = {
  payment: { create: vi.fn().mockResolvedValue({ id: 99 }) },
  applicationDocument: { create: vi.fn().mockResolvedValue({ id: "doc-1" }) },
  auditLog: { create: vi.fn().mockResolvedValue({ id: 1 }) },
};

const service = () => new ManualPaymentRegistrationService(
  amounts as never,
  repository as never,
  calculator as never,
  integration as never,
  provisioning as never,
  confirmationEmail as never,
  storage as never,
);

const input = {
  applicationId: 10,
  actorUserId: 7,
  method: PaymentMethod.BANK_TRANSFER,
  reference: "OP-123456",
  comment: "Pago en banco",
  paidAt: new Date("2026-11-20T12:00:00.000Z"),
  proof: { buffer: Buffer.from("%PDF-1.4"), fileName: "voucher.pdf", mimeType: "application/pdf", sizeBytes: 8 },
};

describe("ManualPaymentRegistrationService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.$transaction.mockImplementation(async (callback: (client: typeof tx) => unknown) => callback(tx));
    prismaMock.payment.findFirst.mockResolvedValue(null);
    prismaMock.membershipApplication.findUnique.mockResolvedValue({ id: 10, status: ApplicationStatus.READY_FOR_PAYMENT, deletedAt: null });
  });

  it("registra un pago manual, completa el expediente y envía correos", async () => {
    const result = await service().register(input);

    expect(result.paymentId).toBe(99);
    expect(result.applicationStatus).toBe(ApplicationStatus.COMPLETED);
    expect(tx.payment.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        status: PaymentStatus.PAID,
        gateway: PaymentGateway.BANK_TRANSFER,
        paymentMethod: PaymentMethod.BANK_TRANSFER,
        transactionId: "OP-123456",
      }),
    }));
    expect(tx.applicationDocument.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ category: DocumentCategory.PAYMENT_VOUCHER, fileName: "voucher.pdf" }),
    }));
    expect(calculator.recalculate).toHaveBeenCalled();
    expect(provisioning.provisionCompletedApplication).toHaveBeenCalledWith(10);
    expect(confirmationEmail.sendIfNeeded).toHaveBeenCalledWith(99);
  });

  it("rechaza expedientes que no están aptos para pago", async () => {
    prismaMock.membershipApplication.findUnique.mockResolvedValue({ id: 10, status: ApplicationStatus.PENDING, deletedAt: null });

    await expect(service().register(input)).rejects.toMatchObject({ status: 409 });
    expect(storage.uploadFile).not.toHaveBeenCalled();
  });

  it("no permite registrar un segundo pago al mismo expediente", async () => {
    prismaMock.payment.findFirst.mockResolvedValueOnce({ id: 88 });

    await expect(service().register(input)).rejects.toBeInstanceOf(ManualPaymentError);
    expect(tx.payment.create).not.toHaveBeenCalled();
  });
});
