import { PaymentGateway, PaymentStatus } from "@prisma/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PaymentConfirmationEmailService } from "../Services/PaymentConfirmationEmailService";

process.env.NEXT_PUBLIC_APP_URL ??= "https://portal.example";

const details = {
  id: 77, applicationId: 42, totalAmount: 300, currency: "PEN" as const, gateway: PaymentGateway.NIUBIZ, status: PaymentStatus.PAID,
  transactionId: "transaction-77", paymentDate: new Date("2026-09-03T12:00:00Z"), gatewayTransactionDate: new Date("2026-09-03T12:00:00Z"), paymentChannel: "web", paymentMethod: "CARD", cardBrand: "VISA", cardType: "C", maskedCard: "************1234", authorizationCode: "AUTH-77", traceNumber: "TRACE-77",
  application: { status: "COMPLETED", applicationCode: "EXP-77", trackingCode: "TRACK-77", createdAt: new Date("2026-09-01T12:00:00Z"), submittedAt: new Date("2026-09-02T12:00:00Z"), draftData: { personalInformation: { birthDate: "1990-01-01", address: "Av. Prueba 123" } }, email: "applicant@example.com", phone: "999999999", documentType: "DNI", documentNumber: "12345678", affiliateType: "ACTIVE", person: { firstName: "Ana", paternalLastName: "Pérez", maternalLastName: null } },
  billing: { taxId: "20123456789", businessName: "Empresa SAC", billingAddress: "Av. Prueba 123", billingEmail: "billing@example.com", invoice: null },
};
const enabledSettings = { getPaymentConfirmationEmailSettings: vi.fn().mockResolvedValue({ enabled: true, subject: "Asunto de prueba" }) };

function confirmationStore(overrides: Record<string, unknown> = {}) {
  return {
    findByIdempotencyKey: vi.fn().mockResolvedValue(null),
    createOrGetIdempotent: vi.fn().mockResolvedValue({ id: 21, created: true }),
    tryMarkSending: vi.fn().mockResolvedValue(true),
    markAccepted: vi.fn().mockResolvedValue(undefined),
    recordFailure: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe("PaymentConfirmationEmailService", () => {
  it("reenvía la confirmación aunque ya se haya enviado antes", async () => {
    const repository = { findPaymentConfirmationDetails: vi.fn().mockResolvedValue({ ...details, confirmationEmailSentAt: new Date() }), markConfirmationEmailSent: vi.fn().mockResolvedValue(true) };
    const mailService = { sendMail: vi.fn().mockResolvedValue(undefined) };
    await new PaymentConfirmationEmailService(repository, mailService as never, enabledSettings as never, confirmationStore() as never).resend(details.id);
    expect(mailService.sendMail).toHaveBeenCalledWith(expect.objectContaining({ to: details.application.email }));
    expect(repository.markConfirmationEmailSent).toHaveBeenCalledWith(details.id);
  });

  it("no reenvía si el pago no está aprobado", async () => {
    const repository = { findPaymentConfirmationDetails: vi.fn().mockResolvedValue({ ...details, status: PaymentStatus.FAILED }), markConfirmationEmailSent: vi.fn() };
    const mailService = { sendMail: vi.fn() };
    await expect(new PaymentConfirmationEmailService(repository, mailService as never, enabledSettings as never, confirmationStore() as never).resend(details.id)).rejects.toThrow();
    expect(mailService.sendMail).not.toHaveBeenCalled();
  });

  it("envía y marca la confirmación solo después del envío exitoso", async () => {
    const repository = { findPaymentConfirmationDetails: vi.fn().mockResolvedValue(details), markConfirmationEmailSent: vi.fn().mockResolvedValue(true) };
    const mailService = { sendMail: vi.fn().mockResolvedValue(undefined) };
    await new PaymentConfirmationEmailService(repository, mailService as never, enabledSettings as never, confirmationStore() as never).sendIfNeeded(details.id);
    expect(mailService.sendMail).toHaveBeenCalledWith(expect.objectContaining({ to: details.application.email, subject: "Asunto de prueba", html: expect.stringContaining("EXP-77") }));
    expect(repository.markConfirmationEmailSent).toHaveBeenCalledWith(details.id);
  });

  it("no expone el código de seguimiento al postulante", async () => {
    const repository = { findPaymentConfirmationDetails: vi.fn().mockResolvedValue(details), markConfirmationEmailSent: vi.fn().mockResolvedValue(true) };
    const mailService = { sendMail: vi.fn().mockResolvedValue(undefined) };
    await new PaymentConfirmationEmailService(repository, mailService as never, enabledSettings as never, confirmationStore() as never).sendIfNeeded(details.id);
    const html = mailService.sendMail.mock.calls[0][0].html as string;
    expect(html).not.toContain("TRACK-77");
    expect(html).not.toContain("CÓDIGO DE SEGUIMIENTO");
    expect(html).not.toContain("código de seguimiento");
  });

  it("mantiene confirmationEmailSentAt sin marcar cuando MailService falla", async () => {
    const repository = { findPaymentConfirmationDetails: vi.fn().mockResolvedValue(details), markConfirmationEmailSent: vi.fn() };
    const mailService = { sendMail: vi.fn().mockRejectedValue(new Error("SMTP unavailable")) };
    await new PaymentConfirmationEmailService(repository, mailService as never, enabledSettings as never, confirmationStore() as never).sendIfNeeded(details.id);
    expect(repository.markConfirmationEmailSent).not.toHaveBeenCalled();
  });

  it("no reenvía cuando la confirmación ya está marcada", async () => {
    const repository = { findPaymentConfirmationDetails: vi.fn().mockResolvedValue({ ...details, confirmationEmailSentAt: new Date() }), markConfirmationEmailSent: vi.fn() };
    const mailService = { sendMail: vi.fn() };
    await new PaymentConfirmationEmailService(repository, mailService as never, enabledSettings as never, confirmationStore() as never).sendIfNeeded(details.id);
    expect(mailService.sendMail).not.toHaveBeenCalled();
    expect(repository.markConfirmationEmailSent).not.toHaveBeenCalled();
  });

  it("no envía ni marca el correo cuando la configuración lo deshabilita", async () => {
    const repository = { findPaymentConfirmationDetails: vi.fn().mockResolvedValue(details), markConfirmationEmailSent: vi.fn() };
    const mailService = { sendMail: vi.fn() };
    const settings = { getPaymentConfirmationEmailSettings: vi.fn().mockResolvedValue({ enabled: false, subject: undefined }) };
    await new PaymentConfirmationEmailService(repository, mailService as never, settings as never).sendIfNeeded(details.id);
    expect(mailService.sendMail).not.toHaveBeenCalled();
    expect(repository.markConfirmationEmailSent).not.toHaveBeenCalled();
  });

  it("incluye enlaces de comprobante solamente cuando existen", async () => {
    const invoice = { type: "FACTURA", serie: "F001", number: "00000077", issueDate: new Date("2026-09-03T12:00:00Z"), pdfUrl: "https://files.example/77.pdf", xmlUrl: "https://files.example/77.xml", sunatCdrUrl: "https://files.example/77.cdr" };
    const repository = { findPaymentConfirmationDetails: vi.fn().mockResolvedValue({ ...details, billing: { ...details.billing, invoice } }), markConfirmationEmailSent: vi.fn().mockResolvedValue(true) };
    const mailService = { sendMail: vi.fn().mockResolvedValue(undefined) };
    await new PaymentConfirmationEmailService(repository, mailService as never, enabledSettings as never, confirmationStore() as never).sendIfNeeded(details.id);
    const html = mailService.sendMail.mock.calls[0][0].html as string;
    expect(html).toContain("DESCARGAR PDF");
    expect(html).toContain("DESCARGAR XML");
    expect(html).toContain("DESCARGAR CDR");
  });

  it("WALLET/YAPE: muestra Yape y oculta la metadata de tarjeta", async () => {
    const repository = { findPaymentConfirmationDetails: vi.fn().mockResolvedValue({ ...details, paymentMethod: "WALLET", paymentBrand: "YAPE" }), markConfirmationEmailSent: vi.fn().mockResolvedValue(true) };
    const mailService = { sendMail: vi.fn().mockResolvedValue(undefined) };
    await new PaymentConfirmationEmailService(repository, mailService as never, enabledSettings as never, confirmationStore() as never).sendIfNeeded(details.id);
    const html = mailService.sendMail.mock.calls[0][0].html as string;
    expect(html).toContain("Yape");
    expect(html).not.toContain("Marca de tarjeta");
    expect(html).not.toContain("Tipo de tarjeta");
    expect(html).not.toContain("Tarjeta enmascarada");
    expect(html).not.toContain("VISA");
  });

  it("UNKNOWN: muestra No identificado y no interpreta metadata histórica como tarjeta", async () => {
    const repository = { findPaymentConfirmationDetails: vi.fn().mockResolvedValue({ ...details, paymentMethod: "UNKNOWN" }), markConfirmationEmailSent: vi.fn().mockResolvedValue(true) };
    const mailService = { sendMail: vi.fn().mockResolvedValue(undefined) };
    await new PaymentConfirmationEmailService(repository, mailService as never, enabledSettings as never, confirmationStore() as never).sendIfNeeded(details.id);
    const html = mailService.sendMail.mock.calls[0][0].html as string;
    expect(html).toContain("No identificado");
    expect(html).not.toContain("Marca de tarjeta");
    expect(html).not.toContain("Tipo de tarjeta");
    expect(html).not.toContain("Tarjeta enmascarada");
  });

  it("compone un único documento HTML con un solo encabezado institucional", async () => {
    const repository = { findPaymentConfirmationDetails: vi.fn().mockResolvedValue(details), markConfirmationEmailSent: vi.fn().mockResolvedValue(true) };
    const mailService = { sendMail: vi.fn().mockResolvedValue(undefined) };
    await new PaymentConfirmationEmailService(repository, mailService as never, enabledSettings as never, confirmationStore() as never).sendIfNeeded(details.id);
    const html = mailService.sendMail.mock.calls[0][0].html as string;
    expect(html.match(/<!doctype html>/gi)).toHaveLength(1);
    expect(html.match(/<html[\s>]/gi)).toHaveLength(1);
    expect(html.match(/<body[\s>]/gi)).toHaveLength(1);
    expect(html.match(/<img\b/gi)).toHaveLength(1);
    expect(html).toContain("¡Bienvenido(a) al IIMP!");
    expect(html).not.toContain("Pago confirmado");
  });

  it("incluye los datos del asociado y el detalle del pago", async () => {
    const repository = { findPaymentConfirmationDetails: vi.fn().mockResolvedValue(details), markConfirmationEmailSent: vi.fn().mockResolvedValue(true) };
    const mailService = { sendMail: vi.fn().mockResolvedValue(undefined) };
    await new PaymentConfirmationEmailService(repository, mailService as never, enabledSettings as never, confirmationStore() as never).sendIfNeeded(details.id);
    const html = mailService.sendMail.mock.calls[0][0].html as string;
    for (const expected of ["DATOS DEL ASOCIADO", "DETALLE DEL PAGO", "Nombre completo", "Ana Pérez", "DNI 12345678", "EXP-77", "transaction-77", "TRACE-77", "AUTH-77", "PAGADO"]) {
      expect(html).toContain(expected);
    }
  });

  it("no reenvía si el registro idempotente ya fue aceptado", async () => {
    const repository = { findPaymentConfirmationDetails: vi.fn().mockResolvedValue(details), markConfirmationEmailSent: vi.fn().mockResolvedValue(true) };
    const mailService = { sendMail: vi.fn() };
    const store = confirmationStore({ findByIdempotencyKey: vi.fn().mockResolvedValue({ id: 21, status: "ACCEPTED" }) });
    await new PaymentConfirmationEmailService(repository, mailService as never, enabledSettings as never, store as never).sendIfNeeded(details.id);
    expect(mailService.sendMail).not.toHaveBeenCalled();
    expect(store.tryMarkSending).not.toHaveBeenCalled();
    expect(repository.markConfirmationEmailSent).toHaveBeenCalledWith(details.id);
  });
});

describe("PaymentConfirmationEmailService — pago rechazado y copias", () => {
  const originalPaymentEnvironment = process.env.PAYMENT_ENVIRONMENT;

  afterEach(() => {
    if (originalPaymentEnvironment === undefined) delete process.env.PAYMENT_ENVIRONMENT;
    else process.env.PAYMENT_ENVIRONMENT = originalPaymentEnvironment;
  });

  const failedDetails = {
    ...details,
    status: PaymentStatus.FAILED,
    failureCode: "116",
    failureReason: "Fondos insuficientes",
  };

  function transactionalEmails(overrides: Record<string, unknown> = {}) {
    return {
      findByIdempotencyKey: vi.fn().mockResolvedValue(null),
      createOrGetIdempotent: vi.fn().mockResolvedValue({ id: 11, created: true }),
      tryMarkSending: vi.fn().mockResolvedValue(true),
      markAccepted: vi.fn().mockResolvedValue(undefined),
      recordFailure: vi.fn().mockResolvedValue(undefined),
      ...overrides,
    };
  }

  it("envía la incidencia al postulante con copias en PRODUCTION y motivo amigable", async () => {
    process.env.PAYMENT_ENVIRONMENT = "PRODUCTION";
    const repository = { findPaymentConfirmationDetails: vi.fn().mockResolvedValue(failedDetails), markConfirmationEmailSent: vi.fn() };
    const mailService = { sendMail: vi.fn().mockResolvedValue({ messageId: "incident-1" }) };
    const store = transactionalEmails();

    await new PaymentConfirmationEmailService(repository, mailService as never, enabledSettings as never, store as never).sendIncidentIfNeeded(details.id);

    const mail = mailService.sendMail.mock.calls[0][0] as { to: string; cc: string[]; bcc: string[]; subject: string; html: string };
    expect(mail.to).toBe(details.application.email);
    expect(mail.cc).toEqual(expect.arrayContaining(["asociados@iimp.org.pe", "billing@example.com"]));
    expect(mail.bcc).toEqual(expect.arrayContaining(["john.moron@iimp.org.pe", "sistemas.iimp.ia@gmail.com"]));
    expect(mail.subject).toBe("IIMP | Incidencia en el pago de tu afiliación");
    expect(mail.html).toContain("EXP-77");
    expect(mail.html).toContain("No cuentas con fondos suficientes");
    expect(store.markAccepted).toHaveBeenCalledWith(11, "incident-1");
  });

  it("no envía incidencia para un pago aprobado", async () => {
    const repository = { findPaymentConfirmationDetails: vi.fn().mockResolvedValue(details), markConfirmationEmailSent: vi.fn() };
    const mailService = { sendMail: vi.fn() };
    const store = transactionalEmails();

    await new PaymentConfirmationEmailService(repository, mailService as never, enabledSettings as never, store as never).sendIncidentIfNeeded(details.id);

    expect(mailService.sendMail).not.toHaveBeenCalled();
    expect(store.createOrGetIdempotent).not.toHaveBeenCalled();
  });

  it("no duplica la incidencia cuando ya fue aceptada", async () => {
    process.env.PAYMENT_ENVIRONMENT = "PRODUCTION";
    const repository = { findPaymentConfirmationDetails: vi.fn().mockResolvedValue(failedDetails), markConfirmationEmailSent: vi.fn() };
    const mailService = { sendMail: vi.fn() };
    const store = transactionalEmails({ findByIdempotencyKey: vi.fn().mockResolvedValue({ id: 11, status: "ACCEPTED" }) });

    await new PaymentConfirmationEmailService(repository, mailService as never, enabledSettings as never, store as never).sendIncidentIfNeeded(details.id);

    expect(store.tryMarkSending).not.toHaveBeenCalled();
    expect(mailService.sendMail).not.toHaveBeenCalled();
  });

  it("envía la incidencia aunque la confirmación esté deshabilitada", async () => {
    process.env.PAYMENT_ENVIRONMENT = "TEST";
    const repository = { findPaymentConfirmationDetails: vi.fn().mockResolvedValue(failedDetails), markConfirmationEmailSent: vi.fn() };
    const mailService = { sendMail: vi.fn().mockResolvedValue({ messageId: "incident-1" }) };
    const store = transactionalEmails();
    const settings = { getPaymentConfirmationEmailSettings: vi.fn().mockResolvedValue({ enabled: false, subject: undefined }) };

    await new PaymentConfirmationEmailService(repository, mailService as never, settings as never, store as never).sendIncidentIfNeeded(details.id);

    expect(mailService.sendMail).toHaveBeenCalledOnce();
    expect(store.markAccepted).toHaveBeenCalledWith(11, "incident-1");
  });

  it("agrega copias a la confirmación en PRODUCTION", async () => {
    process.env.PAYMENT_ENVIRONMENT = "PRODUCTION";
    const repository = { findPaymentConfirmationDetails: vi.fn().mockResolvedValue(details), markConfirmationEmailSent: vi.fn().mockResolvedValue(true) };
    const mailService = { sendMail: vi.fn().mockResolvedValue(undefined) };

    await new PaymentConfirmationEmailService(repository, mailService as never, enabledSettings as never, confirmationStore() as never).sendIfNeeded(details.id);

    expect(mailService.sendMail).toHaveBeenCalledWith(expect.objectContaining({
      cc: expect.arrayContaining(["asociados@iimp.org.pe", "billing@example.com"]),
      bcc: expect.arrayContaining(["john.moron@iimp.org.pe", "sistemas.iimp.ia@gmail.com"]),
    }));
  });

  it("no agrega copias fuera de PRODUCTION", async () => {
    process.env.PAYMENT_ENVIRONMENT = "TEST";
    const repository = { findPaymentConfirmationDetails: vi.fn().mockResolvedValue(details), markConfirmationEmailSent: vi.fn().mockResolvedValue(true) };
    const mailService = { sendMail: vi.fn().mockResolvedValue(undefined) };

    await new PaymentConfirmationEmailService(repository, mailService as never, enabledSettings as never, confirmationStore() as never).sendIfNeeded(details.id);

    const mail = mailService.sendMail.mock.calls[0][0] as { cc?: string[]; bcc?: string[] };
    expect(mail.cc).toBeUndefined();
    expect(mail.bcc).toBeUndefined();
  });
});
