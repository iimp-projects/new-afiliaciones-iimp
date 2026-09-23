import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  membershipApplication: { findFirst: vi.fn(), findMany: vi.fn() },
  verificationCode: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), updateMany: vi.fn(), update: vi.fn() },
  $queryRaw: vi.fn(),
  $transaction: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({ prisma: db }));
import { VerificationRepository } from "../../postulacion/Repositories/VerificationRepository";
import { OtpRecoveryService } from "../../postulacion/Services/OtpRecoveryService";
import { destinationChannels } from "@/modules/shared/Models/Verification";
import { queryAuthorization } from "../Services/QueryAuthorizationService";
import { parseOtpRequest } from "../../postulacion/Services/OtpRequest";
import { QueryVerificationService } from "../Services/QueryVerificationService";
import { WhatsAppService } from "@/modules/shared/Services/WhatsAppService";

const repository = new VerificationRepository();
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("AUTH_SECRET", "test-only-query-secret");
  vi.stubEnv("WHATSAPP_PHONE_NUMBER_ID", "phone-id");
  vi.stubEnv("WHATSAPP_ACCESS_TOKEN", "token");
  vi.stubEnv("WHATSAPP_GRAPH_API_VERSION", "v26.0");
  vi.stubEnv("SMTP_HOST", "smtp.example.com");
  vi.stubEnv("SMTP_USER", "user");
  vi.stubEnv("SMTP_PASS", "pass");
  vi.stubEnv("SMTP_PORT", "587");
  vi.stubEnv("OTP_WHATSAPP_ENABLED", "true");
  vi.stubEnv("OTP_SMS_ENABLED", "true");
  vi.stubEnv("OTP_EMAIL_ENABLED", "true");
  db.$transaction.mockImplementation(async (action) => action(db));
  db.verificationCode.findMany.mockResolvedValue([]);
  db.membershipApplication.findMany.mockResolvedValue([{ id: 7, email: "maria@example.com", phone: "999111812" }]);
  db.verificationCode.create.mockResolvedValue({ id: 12 });
  db.membershipApplication.findFirst.mockResolvedValue({ id: 7, email: "maria@example.com", phone: "999111812" });
});

describe("registered destinations and shared OTP delivery", () => {
  it("offers WhatsApp, SMS and email masked", () => {
    expect(destinationChannels("maria@example.com", "999111812")).toEqual([
      { channel: "WHATSAPP", destination: "*** *** 812" }, { channel: "SMS", destination: "*** *** 812" }, { channel: "EMAIL", destination: "m***@example.com" },
    ]);
    expect(destinationChannels("", "")).toEqual([]);
    expect(destinationChannels("m@example.com", "").map((item) => item.channel)).toEqual(["EMAIL"]);
    expect(destinationChannels("", "999111812").map((item) => item.channel)).toEqual(["WHATSAPP", "SMS"]);
  });
  it.each(["EMAIL", "SMS", "WHATSAPP"] as const)("sends %s using the existing provider and server destination", async (channel) => {
    const mail = { sendMail: vi.fn() }, sms = { sendSms: vi.fn() }, whatsapp = { sendOtp: vi.fn() };
    const service = new OtpRecoveryService(repository, mail as never, sms as never, whatsapp as never);
    await service.generateAndSendOtp(7, channel, "APPLICATION_QUERY");
    const created = db.verificationCode.create.mock.calls[0][0].data;
    expect(created.code).toMatch(/^APPLICATION_QUERY:\d{6}$/);
    expect(created.expiresAt.getTime() - Date.now()).toBeGreaterThan(14 * 60 * 1000);
    if (channel === "EMAIL") expect(mail.sendMail).toHaveBeenCalledWith(expect.objectContaining({ to: "maria@example.com", html: expect.stringContaining(created.code.split(":")[1]) }));
    if (channel === "SMS") expect(sms.sendSms).toHaveBeenCalledWith("999111812", expect.stringContaining(created.code.split(":")[1]));
    if (channel === "WHATSAPP") expect(whatsapp.sendOtp).toHaveBeenCalledWith({ phone: "999111812", code: created.code.split(":")[1] });
  });
  it("blocks a missing channel before persisting or sending", async () => {
    db.membershipApplication.findFirst.mockResolvedValue({ id: 7, email: "m@example.com", phone: "" });
    await expect(new OtpRecoveryService().generateAndSendOtp(7, "SMS", "APPLICATION_QUERY")).rejects.toThrow("no está disponible");
    expect(db.verificationCode.create).not.toHaveBeenCalled();
  });
  it("invalidates a code when delivery fails", async () => {
    const service = new OtpRecoveryService(repository, { sendMail: vi.fn().mockRejectedValue(new Error("provider details")) } as never);
    await expect(service.generateAndSendOtp(7, "EMAIL", "APPLICATION_QUERY")).rejects.toThrow("No pudimos enviar");
    expect(db.verificationCode.update).toHaveBeenCalledWith({ where: { id: 12 }, data: { verifiedAt: expect.any(Date) } });
  });
  it("logs a sanitized provider category without leaking the provider error", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const service = new OtpRecoveryService(repository, { sendMail: vi.fn().mockRejectedValue(new Error("provider details")) } as never);
    await expect(service.generateAndSendOtp(7, "EMAIL", "APPLICATION_QUERY")).rejects.toThrow("No pudimos enviar");
    expect(errorSpy).toHaveBeenCalledWith(expect.objectContaining({ operation: "OTP_PROVIDER_FAILURE", channel: "EMAIL", provider: "smtp", category: "OTP_PROVIDER_FAILURE" }));
    expect(JSON.stringify(errorSpy.mock.calls)).not.toContain("provider details");
    errorSpy.mockRestore();
  });
  it("classifies a configuration failure as OTP_CONFIGURATION_ERROR", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const configError = Object.assign(new Error("config"), { name: "WhatsAppServiceError", code: "CONFIGURATION_ERROR" });
    const service = new OtpRecoveryService(repository, undefined as never, undefined as never, { sendOtp: vi.fn().mockRejectedValue(configError) } as never);
    await expect(service.generateAndSendOtp(7, "WHATSAPP", "APPLICATION_QUERY")).rejects.toThrow("No pudimos enviar");
    expect(errorSpy).toHaveBeenCalledWith(expect.objectContaining({ operation: "OTP_PROVIDER_FAILURE", channel: "WHATSAPP", provider: "meta", category: "OTP_CONFIGURATION_ERROR" }));
    errorSpy.mockRestore();
  });
  it("logs OTP_RESERVATION_ERROR when the database rejects the reservation", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    db.verificationCode.create.mockRejectedValueOnce(Object.assign(new Error("enum"), { name: "PrismaClientUnknownRequestError" }));
    const service = new OtpRecoveryService(repository, { sendMail: vi.fn() } as never);
    await expect(service.generateAndSendOtp(7, "EMAIL", "APPLICATION_QUERY")).rejects.toThrow("No pudimos enviar");
    expect(errorSpy).toHaveBeenCalledWith(expect.objectContaining({ operation: "OTP_RESERVATION_ERROR", channel: "EMAIL", category: "OTP_DATABASE_ERROR" }));
    errorSpy.mockRestore();
  });
  it("does not simulate a successful WhatsApp delivery when unconfigured", async () => {
    vi.stubEnv("WHATSAPP_ACCESS_TOKEN", "");
    await expect(new WhatsAppService().sendOtp({ phone: "999111812", code: "123456" })).rejects.toMatchObject({ code: "CONFIGURATION_ERROR" });
  });
});

describe("OTP lifetime, attempts and resend", () => {
  const otp = () => ({ id: 12, channel: "EMAIL", destination: "maria@example.com", code: "APPLICATION_QUERY:123456", attempts: 0, expiresAt: new Date(Date.now() + 60000) });
  it("accepts the correct OTP once and consumes it", async () => {
    db.verificationCode.findFirst.mockResolvedValueOnce(otp()).mockResolvedValueOnce(null);
    await expect(repository.consume(7, "123456", "APPLICATION_QUERY")).resolves.toEqual({ channel: "EMAIL", destination: "maria@example.com" });
    await expect(repository.consume(7, "123456", "APPLICATION_QUERY")).rejects.toThrow("No hay códigos");
    expect(db.verificationCode.update).toHaveBeenCalledWith({ where: { id: 12 }, data: { verifiedAt: expect.any(Date) } });
  });
  it("counts incorrect OTP attempts in the committed transaction", async () => {
    db.verificationCode.findFirst.mockResolvedValue(otp());
    await expect(repository.consume(7, "999999", "APPLICATION_QUERY")).rejects.toThrow("no es correcto");
    expect(db.verificationCode.update).toHaveBeenCalledWith({ where: { id: 12 }, data: { attempts: { increment: 1 } } });
  });
  it("rejects expired OTP", async () => {
    db.verificationCode.findFirst.mockResolvedValue({ ...otp(), expiresAt: new Date(0) });
    await expect(repository.consume(7, "123456", "APPLICATION_QUERY")).rejects.toThrow("ha expirado");
    expect(db.verificationCode.update).not.toHaveBeenCalled();
  });
  it("blocks verification after three attempts", async () => {
    db.verificationCode.findFirst.mockResolvedValue({ ...otp(), attempts: 3 });
    await expect(repository.consume(7, "123456", "APPLICATION_QUERY")).rejects.toThrow("demasiados intentos");
  });
  it("blocks resend during cooldown across channels", async () => {
    db.verificationCode.findMany.mockResolvedValue([{ createdAt: new Date(), attempts: 0 }]);
    await expect(repository.reserve(7, "EMAIL", "m@example.com", "123456", "APPLICATION_QUERY")).rejects.toThrow("60 segundos");
    expect(db.verificationCode.create).not.toHaveBeenCalled();
  });
  it("resends after cooldown, retiring the preceding query OTP", async () => {
    db.verificationCode.findMany.mockResolvedValue([{ createdAt: new Date(Date.now() - 61000), attempts: 0 }]);
    await repository.reserve(7, "SMS", "999111812", "123456", "APPLICATION_QUERY");
    expect(db.verificationCode.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ verifiedAt: null, code: { startsWith: "APPLICATION_QUERY:" } }) }));
    expect(db.verificationCode.create).toHaveBeenCalledOnce();
  });
  it.each(["attempts", "send-limit"])("cannot bypass %s by requesting a new OTP", async (limit) => {
    db.verificationCode.findMany.mockResolvedValue(limit === "attempts" ? [{ createdAt: new Date(Date.now() - 61000), attempts: 3 }] : Array(5).fill({ createdAt: new Date(Date.now() - 61000), attempts: 0 }));
    await expect(repository.reserve(7, "SMS", "999111812", "123456", "APPLICATION_QUERY")).rejects.toThrow("demasiados intentos");
  });
  it("does not accept trackingCode as an OTP", async () => {
    await expect(new OtpRecoveryService().verifyOtp(7, "APP-1786118277804", "APPLICATION_QUERY")).rejects.toThrow("no es correcto");
    expect(db.verificationCode.findFirst).not.toHaveBeenCalled();
  });
  it("separates recovery verification from query verification", async () => {
    db.verificationCode.findFirst.mockResolvedValue({ ...otp(), code: "123456" });
    await expect(repository.consume(7, "123456", "APPLICATION_QUERY")).rejects.toThrow("no es correcto");
    await expect(repository.consume(7, "123456", "RESUME_APPLICATION")).resolves.toEqual({ channel: "EMAIL", destination: "maria@example.com" });
  });
});

describe("query authorization boundary", () => {
  it("rejects client-supplied destinations and unsigned IDs", () => {
    expect(() => parseOtpRequest({ purpose: "APPLICATION_QUERY", applicationId: 7, channel: "EMAIL" }, "send")).toThrow();
    expect(() => parseOtpRequest({ purpose: "APPLICATION_QUERY", context: queryAuthorization.create(7, "QUERY_CHALLENGE"), channel: "EMAIL", email: "attacker@example.com" }, "send")).toThrow();
    expect(() => parseOtpRequest({ purpose: "APPLICATION_QUERY", context: queryAuthorization.create(7, "QUERY_CHALLENGE"), channel: "EMAIL", phone: "999111812" }, "send")).toThrow();
    expect(() => parseOtpRequest({ purpose: "APPLICATION_QUERY", context: queryAuthorization.create(7, "QUERY_CHALLENGE"), channel: "EMAIL", destination: "x@y.z" }, "send")).toThrow();
  });
  it("resolves identity only from the signed challenge", () => {
    expect(parseOtpRequest({ purpose: "APPLICATION_QUERY", context: queryAuthorization.create(7, "QUERY_CHALLENGE"), channel: "SMS" }, "send")).toMatchObject({ identifier: { kind: "application", applicationId: 7 }, purpose: "APPLICATION_QUERY" });
    expect(parseOtpRequest({ purpose: "APPLICATION_QUERY", context: queryAuthorization.createDocumentChallenge("DNI", "12345678"), channel: "SMS" }, "send")).toMatchObject({ identifier: { kind: "document", documentType: "DNI", documentNumber: "12345678" }, purpose: "APPLICATION_QUERY" });
    expect(parseOtpRequest({ trackingCode: "APP-123", channel: "EMAIL" }, "send")).toMatchObject({ identifier: "APP-123", purpose: "RESUME_APPLICATION" });
  });
  it("does not grant access with trackingCode, a challenge, or an altered token", () => {
    expect(queryAuthorization.verify("APP-123", "QUERY_ACCESS")).toBeNull();
    expect(queryAuthorization.verify(queryAuthorization.create(7, "QUERY_CHALLENGE"), "QUERY_ACCESS")).toBeNull();
    expect(queryAuthorization.verify(queryAuthorization.createDocumentChallenge("DNI", "12345678"), "QUERY_ACCESS")).toBeNull();
    const access = queryAuthorization.create(7, "QUERY_ACCESS");
    expect(queryAuthorization.verify(access, "QUERY_ACCESS")).toBe(7);
    expect(queryAuthorization.verify(`${access}x`, "QUERY_ACCESS")).toBeNull();
  });
  it("expires authorization", () => {
    vi.useFakeTimers();
    const access = queryAuthorization.create(7, "QUERY_ACCESS");
    vi.advanceTimersByTime(15 * 60 * 1000);
    expect(queryAuthorization.verify(access, "QUERY_ACCESS")).toBeNull();
    vi.useRealTimers();
  });
});

describe("public consultation lookup (constant response)", () => {
  it("returns a document-bound challenge without existence flag or contact data", async () => {
    const result = await new QueryVerificationService().lookup({ documentType: "DNI", documentNumber: "12345678" });
    expect(result).toEqual({
      requiresVerification: true,
      context: expect.any(String),
      channels: [{ channel: "WHATSAPP" }, { channel: "SMS" }, { channel: "EMAIL" }],
    });
    expect(result).not.toHaveProperty("hasApplication");
    expect(result).not.toHaveProperty("options");
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain("maria@example.com");
    expect(serialized).not.toContain("999111812");
    expect(queryAuthorization.resolveChallenge(result.context)).toMatchObject({ kind: "document", documentType: "DNI", documentNumber: "12345678" });
    expect(JSON.stringify(queryAuthorization.resolveChallenge(result.context))).not.toContain("applicationId");
  });
  it("never queries the database and returns the same shape for any document", async () => {
    const existing = await new QueryVerificationService().lookup({ documentType: "DNI", documentNumber: "12345678" });
    const nonexistent = await new QueryVerificationService().lookup({ documentType: "CE", documentNumber: "00000000" });
    expect(Object.keys(existing).sort()).toEqual(Object.keys(nonexistent).sort());
    expect(existing.channels).toEqual(nonexistent.channels);
    expect(db.membershipApplication.findMany).not.toHaveBeenCalled();
    expect(db.membershipApplication.findFirst).not.toHaveBeenCalled();
  });
  it("reflects only global provider availability", async () => {
    vi.stubEnv("OTP_EMAIL_ENABLED", "false");
    vi.stubEnv("OTP_WHATSAPP_ENABLED", "false");
    const result = await new QueryVerificationService().lookup({ documentType: "DNI", documentNumber: "12345678" });
    expect(result.channels).toEqual([{ channel: "SMS" }]);
  });
  it("rejects email, trackingCode and extra fields", async () => {
    await expect(new QueryVerificationService().lookup({ documentType: "DNI", documentNumber: "12345678", email: "m@example.com" })).rejects.toThrow("Revisa el tipo y número de documento");
    await expect(new QueryVerificationService().lookup({ documentType: "DNI", documentNumber: "12345678", trackingCode: "APP-7" })).rejects.toThrow("Revisa el tipo y número de documento");
    await expect(new QueryVerificationService().lookup({ documentType: "DNI" })).rejects.toThrow("Revisa el tipo y número de documento");
  });
  it("silently no-ops for a decoy document without sending or persisting", async () => {
    db.membershipApplication.findMany.mockResolvedValue([]);
    const mail = { sendMail: vi.fn() };
    const service = new OtpRecoveryService(repository, mail as never);
    await expect(service.generateAndSendOtp({ kind: "document", documentType: "DNI", documentNumber: "00000000" }, "EMAIL", "APPLICATION_QUERY")).resolves.toBeUndefined();
    expect(mail.sendMail).not.toHaveBeenCalled();
    expect(db.verificationCode.create).not.toHaveBeenCalled();
  });
  it("sends only to the registered destination resolved server-side for a document challenge", async () => {
    db.membershipApplication.findMany.mockResolvedValue([{ id: 7, email: "maria@example.com", phone: "999111812" }]);
    db.membershipApplication.findFirst.mockResolvedValue({ id: 7, email: "maria@example.com", phone: "999111812" });
    const mail = { sendMail: vi.fn() };
    const service = new OtpRecoveryService(repository, mail as never);
    await service.generateAndSendOtp({ kind: "document", documentType: "DNI", documentNumber: "12345678" }, "EMAIL", "APPLICATION_QUERY");
    expect(mail.sendMail).toHaveBeenCalledWith(expect.objectContaining({ to: "maria@example.com" }));
  });
});
