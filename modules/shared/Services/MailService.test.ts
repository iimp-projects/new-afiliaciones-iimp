import { describe, expect, it, vi } from "vitest";

const sendMail = vi.hoisted(() => vi.fn());
vi.mock("nodemailer", () => ({ default: { createTransport: () => ({ sendMail }) } }));
vi.mock("@/lib/config/env", () => ({
  getSmtpConfig: () => ({ host: "smtp.test", port: 587, secure: false, user: "u", pass: "p", from: "from@test" }),
}));

import { MailService, MailServiceError } from "./MailService";

async function failWith(error: unknown): Promise<MailServiceError> {
  sendMail.mockRejectedValueOnce(error);
  const service = new MailService();
  try {
    await service.sendMail({ to: "x@y.com", subject: "s", html: "h" });
    throw new Error("no lanzó");
  } catch (e) {
    return e as MailServiceError;
  }
}

describe("MailService — clasificación de errores SMTP", () => {
  it("421 Too many messages → RATE_LIMITED", async () => {
    const err = await failWith({ responseCode: 421, response: "4.7.0 Too many messages" });
    expect(err).toBeInstanceOf(MailServiceError);
    expect(err.kind).toBe("RATE_LIMITED");
  });

  it("452 insufficient storage → RATE_LIMITED", async () => {
    const err = await failWith({ responseCode: 452 });
    expect(err.kind).toBe("RATE_LIMITED");
  });

  it("550 daily user sending limit → QUOTA_EXCEEDED", async () => {
    const err = await failWith({ responseCode: 550, response: "5.4.5 Daily user sending limit exceeded" });
    expect(err.kind).toBe("QUOTA_EXCEEDED");
  });

  it("550 sin texto de cuota → PERMANENT", async () => {
    const err = await failWith({ responseCode: 550, response: "5.1.1 recipient rejected" });
    expect(err.kind).toBe("PERMANENT");
  });

  it("535 autenticación → AUTH", async () => {
    const err = await failWith({ responseCode: 535 });
    expect(err.kind).toBe("AUTH");
  });

  it("EAUTH → AUTH", async () => {
    const err = await failWith({ code: "EAUTH" });
    expect(err.kind).toBe("AUTH");
  });

  it("ECONNECTION → CONNECTION", async () => {
    const err = await failWith({ code: "ECONNECTION" });
    expect(err.kind).toBe("CONNECTION");
  });

  it("error genérico → UNKNOWN (mensaje sanitizado)", async () => {
    const err = await failWith(new Error("boom"));
    expect(err.kind).toBe("UNKNOWN");
    expect(err.message).toBe("No se pudo enviar el correo.");
  });
});
