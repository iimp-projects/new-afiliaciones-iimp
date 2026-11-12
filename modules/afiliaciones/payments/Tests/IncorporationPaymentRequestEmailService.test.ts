import { AffiliateType, ApplicationStatus, DocumentType, PaymentStatus, TransactionalEmailStatus } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  INCORPORATION_PAYMENT_REQUEST_NIUBIZ_URL,
  INCORPORATION_PAYMENT_REQUEST_SUBJECT,
} from "../Templates/IncorporationPaymentRequestTemplate";
import {
  IncorporationPaymentRequestEmailService,
  type IncorporationPaymentRequestEmailServiceOptions,
} from "../Services/IncorporationPaymentRequestEmailService";

const baseCandidate = {
  id: 42,
  status: ApplicationStatus.READY_FOR_PAYMENT,
  affiliateType: AffiliateType.ACTIVE,
  email: "postulante@example.com",
  deletedAt: null,
  documentType: DocumentType.DNI,
  documentNumber: "12345678",
  person: { firstName: "Ana", paternalLastName: "Pérez", maternalLastName: "Gómez" },
  payments: [] as Array<{ status: PaymentStatus; registrationAmount: number | null; membershipFeeAmount: number | null }>,
};

function setup(overrides: Partial<IncorporationPaymentRequestEmailServiceOptions> = {}) {
  const repository = { findCandidate: vi.fn().mockResolvedValue(baseCandidate) };
  const mailService = { sendMail: vi.fn().mockResolvedValue({ messageId: "message-1" }) };
  const amountResolver = {
    resolve: vi.fn().mockResolvedValue({
      registrationAmount: 150,
      membershipFeeAmount: 150,
      totalAmount: 300,
      currency: "PEN",
    }),
  };
  const feePeriodResolver = { getMonthlyFeePeriod: vi.fn().mockResolvedValue(new Date("2026-01-01T00:00:00Z")) };
  const transactionalEmails = {
    findByIdempotencyKey: vi.fn().mockResolvedValue(null),
    createOrGetIdempotent: vi.fn().mockResolvedValue({ id: 9, created: true }),
    tryMarkSending: vi.fn().mockResolvedValue(true),
    markAccepted: vi.fn().mockResolvedValue(undefined),
    recordFailure: vi.fn().mockResolvedValue(undefined),
  };
  const assetsLoader = vi.fn().mockResolvedValue({ logo: Buffer.from("logo"), qr: Buffer.from("qr") });

  const service = new IncorporationPaymentRequestEmailService({
    repository,
    mailService,
    amountResolver,
    feePeriodResolver,
    transactionalEmails,
    assetsLoader,
    ...overrides,
  });

  return { service, repository, mailService, amountResolver, feePeriodResolver, transactionalEmails, assetsLoader };
}

describe("IncorporationPaymentRequestEmailService", () => {
  beforeEach(() => vi.clearAllMocks());

  it("envía la solicitud de incorporación solo en READY_FOR_PAYMENT con importes dinámicos, Niubiz y QR CID", async () => {
    const { service, mailService, transactionalEmails } = setup();

    await expect(service.sendIfEligible(42)).resolves.toEqual({ sent: true });

    expect(mailService.sendMail).toHaveBeenCalledOnce();
    const mail = mailService.sendMail.mock.calls[0][0];
    expect(mail.to).toBe("postulante@example.com");
    expect(mail.subject).toBe(INCORPORATION_PAYMENT_REQUEST_SUBJECT);
    expect(mail.replyTo).toBe("asociados@iimp.org.pe");
    expect(mail.html).toContain("Ana Pérez Gómez");
    expect(mail.html).toContain("Derecho de inscripción");
    expect(mail.html).toContain("Primera cuota anual de membresía");
    expect(mail.html).toContain("S/ 150.00");
    expect(mail.html).toContain("S/ 300.00");
    expect(mail.html).toContain("2026");
    expect(mail.html).toContain(`href="${INCORPORATION_PAYMENT_REQUEST_NIUBIZ_URL}"`);
    expect(mail.html).toContain('src="cid:yape-qr-iimp"');
    expect(mail.html).toContain('alt="Código QR Yape - Instituto de Ingenieros de Minas del Perú"');
    expect(mail.html).toContain("max-width:600px");
    expect(mail.html).toContain("Puede responder directamente");
    expect(mail.html).not.toContain("no respondas");
    expect(mail.html).not.toContain("ya es asociado activo");
    expect(mail.attachments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          filename: "qr-yape-iimp.png",
          contentType: "image/png",
          cid: "yape-qr-iimp",
          contentDisposition: "inline",
        }),
        expect.objectContaining({
          filename: "logo-iimp.png",
          contentType: "image/png",
          cid: "iimp-logo-incorporacion",
          contentDisposition: "inline",
        }),
      ]),
    );
    expect(transactionalEmails.markAccepted).toHaveBeenCalledWith(9, "message-1");
  });

  it("no envía a asociados estudiantes", async () => {
    const { service, repository, mailService } = setup();
    repository.findCandidate.mockResolvedValue({ ...baseCandidate, affiliateType: AffiliateType.STUDENT });

    await expect(service.sendIfEligible(42)).resolves.toEqual({ sent: false, reason: "STUDENT_EXEMPT" });
    expect(mailService.sendMail).not.toHaveBeenCalled();
  });

  it.each([
    ApplicationStatus.PENDING,
    ApplicationStatus.UNDER_EVALUACION,
    ApplicationStatus.OBSERVED,
    ApplicationStatus.RESOLVED,
    ApplicationStatus.COMPLETED,
    ApplicationStatus.REJECTED,
  ])("no envía cuando el estado es %s", async (status) => {
    const { service, repository, mailService } = setup();
    repository.findCandidate.mockResolvedValue({ ...baseCandidate, status });

    await expect(service.sendIfEligible(42)).resolves.toEqual({ sent: false, reason: "NOT_READY_FOR_PAYMENT" });
    expect(mailService.sendMail).not.toHaveBeenCalled();
  });

  it("no envía si un pago validado carece de desglose (se considera pago completo)", async () => {
    const { service, repository, mailService } = setup();
    repository.findCandidate.mockResolvedValue({
      ...baseCandidate,
      payments: [{ status: PaymentStatus.PAID, registrationAmount: null, membershipFeeAmount: null }],
    });

    await expect(service.sendIfEligible(42)).resolves.toEqual({ sent: false, reason: "ALREADY_PAID" });
    expect(mailService.sendMail).not.toHaveBeenCalled();
  });

  it("cobra únicamente el concepto pendiente cuando la inscripción ya fue pagada", async () => {
    const { service, repository, mailService } = setup();
    repository.findCandidate.mockResolvedValue({
      ...baseCandidate,
      payments: [{ status: PaymentStatus.PAID, registrationAmount: 150, membershipFeeAmount: null }],
    });

    await expect(service.sendIfEligible(42)).resolves.toEqual({ sent: true });

    const mail = mailService.sendMail.mock.calls[0][0];
    expect(mail.html).toContain("Primera cuota anual de membresía");
    expect(mail.html).not.toContain("Derecho de inscripción");
    expect(mail.html).toContain("S/ 150.00");
  });

  it("respeta importes y periodo dinámicos del sistema", async () => {
    const { service, mailService, amountResolver, feePeriodResolver } = setup();
    amountResolver.resolve.mockResolvedValue({
      registrationAmount: 200,
      membershipFeeAmount: 175,
      totalAmount: 375,
      currency: "PEN",
    });
    feePeriodResolver.getMonthlyFeePeriod.mockResolvedValue(new Date("2027-01-01T00:00:00Z"));

    await service.sendIfEligible(42);

    const mail = mailService.sendMail.mock.calls[0][0];
    expect(mail.html).toContain("S/ 200.00");
    expect(mail.html).toContain("S/ 175.00");
    expect(mail.html).toContain("S/ 375.00");
    expect(mail.html).toContain("2027");
  });

  it("no duplica el envío cuando el correo ya fue aceptado", async () => {
    const { service, transactionalEmails, mailService } = setup();
    transactionalEmails.findByIdempotencyKey.mockResolvedValue({
      id: 9,
      status: TransactionalEmailStatus.ACCEPTED,
    });

    await expect(service.sendIfEligible(42)).resolves.toEqual({ sent: false, reason: "DUPLICATE" });
    expect(mailService.sendMail).not.toHaveBeenCalled();
    expect(transactionalEmails.createOrGetIdempotent).not.toHaveBeenCalled();
  });

  it("no envía si otro proceso ya reclamó el registro idempotente", async () => {
    const { service, transactionalEmails, mailService } = setup();
    transactionalEmails.tryMarkSending.mockResolvedValue(false);

    await expect(service.sendIfEligible(42)).resolves.toEqual({ sent: false, reason: "DUPLICATE" });
    expect(mailService.sendMail).not.toHaveBeenCalled();
  });

  it("registra el fallo SMTP y no marca el correo como aceptado", async () => {
    const { service, mailService, transactionalEmails } = setup();
    mailService.sendMail.mockRejectedValue(new Error("SMTP no disponible"));

    await expect(service.sendIfEligible(42)).resolves.toEqual({ sent: false, reason: "SEND_FAILED" });
    expect(transactionalEmails.markAccepted).not.toHaveBeenCalled();
    expect(transactionalEmails.recordFailure).toHaveBeenCalledWith(9, "SMTP no disponible", { exhausted: false });
  });

  it("no envía cuando no hay importes configurables", async () => {
    const { service, amountResolver, mailService } = setup();
    amountResolver.resolve.mockRejectedValue(new Error("Sin cuota vigente"));

    await expect(service.sendIfEligible(42)).resolves.toEqual({ sent: false, reason: "AMOUNTS_UNAVAILABLE" });
    expect(mailService.sendMail).not.toHaveBeenCalled();
  });

  it("no envía si el correo del postulante no es válido", async () => {
    const { service, repository, mailService } = setup();
    repository.findCandidate.mockResolvedValue({ ...baseCandidate, email: "sin-correo" });

    await expect(service.sendIfEligible(42)).resolves.toEqual({ sent: false, reason: "INVALID_EMAIL" });
    expect(mailService.sendMail).not.toHaveBeenCalled();
  });
});
