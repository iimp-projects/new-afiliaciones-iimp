import { PaymentGateway, PaymentStatus } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { PaymentConfirmationEmailService } from "../Services/PaymentConfirmationEmailService";

const details = {
  id: 77, applicationId: 42, totalAmount: 300, currency: "PEN" as const, gateway: PaymentGateway.NIUBIZ, status: PaymentStatus.PAID,
  transactionId: "transaction-77", paymentDate: new Date("2026-09-03T12:00:00Z"),
  application: { email: "applicant@example.com", phone: "999999999", documentType: "DNI", documentNumber: "12345678", affiliateType: "ACTIVE", person: { firstName: "Ana", paternalLastName: "Pérez", maternalLastName: null } },
  billing: { taxId: "20123456789", businessName: "Empresa SAC", billingAddress: "Av. Prueba 123", billingEmail: "billing@example.com" },
};
const enabledSettings = { getPaymentConfirmationEmailSettings: vi.fn().mockResolvedValue({ enabled: true, subject: "Asunto de prueba" }) };

describe("PaymentConfirmationEmailService", () => {
  it("envía y marca la confirmación solo después del envío exitoso", async () => {
    const repository = { findPaymentConfirmationDetails: vi.fn().mockResolvedValue(details), markConfirmationEmailSent: vi.fn().mockResolvedValue(true) };
    const mailService = { sendMail: vi.fn().mockResolvedValue(undefined) };
    await new PaymentConfirmationEmailService(repository, mailService as never, enabledSettings as never).sendIfNeeded(details.id);
    expect(mailService.sendMail).toHaveBeenCalledWith(expect.objectContaining({ to: details.application.email, subject: "Asunto de prueba", html: expect.stringContaining("300.00") }));
    expect(repository.markConfirmationEmailSent).toHaveBeenCalledWith(details.id);
  });

  it("mantiene confirmationEmailSentAt sin marcar cuando MailService falla", async () => {
    const repository = { findPaymentConfirmationDetails: vi.fn().mockResolvedValue(details), markConfirmationEmailSent: vi.fn() };
    const mailService = { sendMail: vi.fn().mockRejectedValue(new Error("SMTP unavailable")) };
    await new PaymentConfirmationEmailService(repository, mailService as never, enabledSettings as never).sendIfNeeded(details.id);
    expect(repository.markConfirmationEmailSent).not.toHaveBeenCalled();
  });

  it("no reenvía cuando la confirmación ya está marcada", async () => {
    const repository = { findPaymentConfirmationDetails: vi.fn().mockResolvedValue({ ...details, confirmationEmailSentAt: new Date() }), markConfirmationEmailSent: vi.fn() };
    const mailService = { sendMail: vi.fn() };
    await new PaymentConfirmationEmailService(repository, mailService as never, enabledSettings as never).sendIfNeeded(details.id);
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
});
