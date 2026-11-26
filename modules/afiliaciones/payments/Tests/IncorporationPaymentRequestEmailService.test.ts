import { AffiliateType, ApplicationStatus, DocumentType, PaymentStatus, TransactionalEmailStatus } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { INCORPORATION_PAYMENT_REQUEST_SUBJECT } from "../Templates/IncorporationPaymentRequestTemplate";
import { MANUAL_PAYMENT_METHODS_SUBJECT } from "../Templates/ManualPaymentMethodsEmailTemplate";
import {
  IncorporationPaymentRequestEmailService,
  type IncorporationPaymentRequestEmailServiceOptions,
} from "../Services/IncorporationPaymentRequestEmailService";

const CONSULTA_URL = "https://portal.example.test/consulta";

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
  const paymentMethodsResolver = {
    isCardEnabled: vi.fn().mockResolvedValue(true),
    isYapeEnabled: vi.fn().mockResolvedValue(true),
  };
  const consultaUrlProvider = vi.fn().mockReturnValue(CONSULTA_URL);
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
    paymentMethodsResolver,
    consultaUrlProvider,
    transactionalEmails,
    assetsLoader,
    ...overrides,
  });

  return {
    service,
    repository,
    mailService,
    amountResolver,
    feePeriodResolver,
    paymentMethodsResolver,
    consultaUrlProvider,
    transactionalEmails,
    assetsLoader,
  };
}

function occurrences(value: string, fragment: string): number {
  return value.split(fragment).length - 1;
}

describe("IncorporationPaymentRequestEmailService", () => {
  beforeEach(() => vi.clearAllMocks());

  it("envía el correo de aprobación con importes dinámicos, tipo de membresía y CTA a Consulta", async () => {
    const { service, mailService, transactionalEmails } = setup();

    await expect(service.sendIfEligible(42)).resolves.toEqual({ sent: true });

    expect(mailService.sendMail).toHaveBeenCalledOnce();
    const mail = mailService.sendMail.mock.calls[0][0];
    expect(mail.to).toBe("postulante@example.com");
    expect(mail.subject).toBe(INCORPORATION_PAYMENT_REQUEST_SUBJECT);
    expect(mail.replyTo).toBe("asociados@iimp.org.pe");
    expect(mail.html).toContain("Ana Pérez Gómez");
    expect(mail.html).toContain("Asociado Activo");
    expect(mail.html).toContain("Aprobada");
    expect(mail.html).toContain("Pendiente de pago");
    expect(mail.html).toContain("Derecho de inscripción");
    expect(mail.html).toContain("Primera cuota anual de membresía");
    expect(mail.html).toContain("S/ 150.00");
    expect(mail.html).toContain("S/ 300.00");
    expect(mail.html).toContain("2026");
    expect(mail.html).toContain(`href="${CONSULTA_URL}"`);
    expect(mail.html).toContain("Completar mi afiliación y pagar");
    expect(mail.html).toContain("Visa");
    expect(mail.html).toContain("Mastercard");
    expect(mail.html).toContain("Yape");
    expect(mail.html).toContain("Pagos en línea procesados a través de Niubiz.");
    expect(mail.html).toContain("pago manual");
    expect(mail.html).toContain("max-width:600px");
    expect(mail.html).not.toContain("12345678");
    expect(mail.html).not.toContain("193-2410342-0-88");
    expect(mail.html).not.toContain("002-193-002410342088-11");
    expect(mail.html).not.toContain("qr-yape-iimp");
    expect(mail.html).not.toContain("BANCO DE CRÉDITO");
    expect(occurrences(mail.html, "cid:iimp-logo-incorporacion")).toBe(1);
    expect(occurrences(mail.html, "Todos los derechos reservados")).toBe(1);
    expect(mail.attachments).toEqual([
      expect.objectContaining({
        filename: "logo-iimp.png",
        contentType: "image/png",
        cid: "iimp-logo-incorporacion",
        contentDisposition: "inline",
      }),
    ]);
    expect(transactionalEmails.markAccepted).toHaveBeenCalledWith(9, "message-1");
  });

  it("conserva el correo de métodos de pago manual para el reenvío administrativo", async () => {
    const { service, mailService, transactionalEmails, paymentMethodsResolver } = setup();

    await expect(
      service.sendIfEligible(42, { forceResend: true, mode: "MANUAL_PAYMENT_METHODS" }),
    ).resolves.toEqual({ sent: true });

    const mail = mailService.sendMail.mock.calls[0][0];
    expect(mail.subject).toBe(MANUAL_PAYMENT_METHODS_SUBJECT);
    expect(mail.html).toContain("Banco de Crédito del Perú");
    expect(mail.html).toContain("193-2410342-0-88");
    expect(mail.html).toContain("002-193-002410342088-11");
    expect(mail.html).toContain("REALIZAR PAGO CON TARJETA");
    expect(mail.html).toContain('src="cid:yape-qr-iimp"');
    expect(mail.html).not.toContain("Completar mi afiliación y pagar");
    expect(mail.attachments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ cid: "iimp-logo-metodos-pago" }),
        expect.objectContaining({ cid: "yape-qr-iimp" }),
      ]),
    );
    expect(transactionalEmails.createOrGetIdempotent).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "AFFILIATION_MANUAL_PAYMENT_METHODS",
        templateName: "manual-payment-methods",
        idempotencyKey: expect.stringMatching(/^manual-payment-methods:v1:42:manual:/),
      }),
    );
    expect(paymentMethodsResolver.isCardEnabled).not.toHaveBeenCalled();
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

  it("muestra solo el concepto pendiente y el desglose cuando existe un pago parcial", async () => {
    const { service, repository, mailService } = setup();
    repository.findCandidate.mockResolvedValue({
      ...baseCandidate,
      payments: [{ status: PaymentStatus.PAID, registrationAmount: 150, membershipFeeAmount: null }],
    });

    await expect(service.sendIfEligible(42)).resolves.toEqual({ sent: true });

    const mail = mailService.sendMail.mock.calls[0][0];
    expect(mail.html).toContain("Primera cuota anual de membresía");
    expect(mail.html).not.toContain("Derecho de inscripción");
    expect(mail.html).toContain("Importe ya pagado");
    expect(mail.html).toContain("Total correspondiente");
    expect(mail.html).toContain("S/ 300.00");
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

  it("oculta Yape cuando el medio está deshabilitado", async () => {
    const { service, mailService, paymentMethodsResolver } = setup();
    paymentMethodsResolver.isYapeEnabled.mockResolvedValue(false);

    await service.sendIfEligible(42);

    expect(mailService.sendMail.mock.calls[0][0].html).not.toContain("Yape");
  });

  it("muestra únicamente Yape cuando la tarjeta está deshabilitada", async () => {
    const { service, mailService, paymentMethodsResolver } = setup();
    paymentMethodsResolver.isCardEnabled.mockResolvedValue(false);

    await service.sendIfEligible(42);

    const html = mailService.sendMail.mock.calls[0][0].html;
    expect(html).not.toContain("Visa");
    expect(html).not.toContain("Mastercard");
    expect(html).toContain("Yape");
  });

  it("no bloquea el envío y omite la sección cuando no hay medios de pago habilitados", async () => {
    const { service, mailService, paymentMethodsResolver } = setup();
    paymentMethodsResolver.isCardEnabled.mockResolvedValue(false);
    paymentMethodsResolver.isYapeEnabled.mockResolvedValue(false);

    await expect(service.sendIfEligible(42)).resolves.toEqual({ sent: true });

    const html = mailService.sendMail.mock.calls[0][0].html;
    expect(html).not.toContain("Medios de pago disponibles");
    expect(html).not.toContain("Visa");
    expect(html).not.toContain("Mastercard");
    expect(html).not.toContain("Yape");
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

  it("reenvía manualmente aunque exista un envío automático aceptado", async () => {
    const { service, transactionalEmails, mailService } = setup();
    transactionalEmails.findByIdempotencyKey.mockResolvedValue({
      id: 9,
      status: TransactionalEmailStatus.ACCEPTED,
    });

    await expect(service.sendIfEligible(42, { forceResend: true })).resolves.toEqual({ sent: true });

    expect(transactionalEmails.findByIdempotencyKey).not.toHaveBeenCalled();
    expect(transactionalEmails.createOrGetIdempotent).toHaveBeenCalledWith(
      expect.objectContaining({
        applicationId: 42,
        idempotencyKey: expect.stringMatching(/^incorporation-payment-request:v1:42:manual:/),
      }),
    );
    expect(mailService.sendMail).toHaveBeenCalledOnce();
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
