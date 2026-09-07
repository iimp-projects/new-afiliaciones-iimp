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
    const mail = { sendMail: vi.fn() }, sms = { sendSms: vi.fn() }, whatsapp = { sendWhatsApp: vi.fn() };
    const service = new OtpRecoveryService(repository, mail as never, sms as never, whatsapp as never);
    await service.generateAndSendOtp(7, channel, "APPLICATION_QUERY");
    const created = db.verificationCode.create.mock.calls[0][0].data;
    expect(created.code).toMatch(/^APPLICATION_QUERY:\d{6}$/);
    expect(created.expiresAt.getTime() - Date.now()).toBeGreaterThan(14 * 60 * 1000);
    if (channel === "EMAIL") expect(mail.sendMail).toHaveBeenCalledWith(expect.objectContaining({ to: "maria@example.com", html: expect.stringContaining(created.code.split(":")[1]) }));
    if (channel === "SMS") expect(sms.sendSms).toHaveBeenCalledWith("999111812", expect.stringContaining(created.code.split(":")[1]));
    if (channel === "WHATSAPP") expect(whatsapp.sendWhatsApp).toHaveBeenCalledWith("999111812", created.code.split(":")[1]);
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
  it("does not simulate a successful WhatsApp delivery when unconfigured", async () => {
    vi.stubEnv("WHATSAPP_API_TOKEN", "");
    await expect(new WhatsAppService().sendWhatsApp("999111812", "123456")).rejects.toThrow("No pudimos enviar");
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
  });
  it("resolves the application only from the signed challenge", () => {
    expect(parseOtpRequest({ purpose: "APPLICATION_QUERY", context: queryAuthorization.create(7, "QUERY_CHALLENGE"), channel: "SMS" }, "send")).toMatchObject({ identifier: 7, purpose: "APPLICATION_QUERY" });
    expect(parseOtpRequest({ trackingCode: "APP-123", channel: "EMAIL" }, "send")).toMatchObject({ identifier: "APP-123", purpose: "RESUME_APPLICATION" });
  });
  it("does not grant access with trackingCode, a challenge, or an altered token", () => {
    expect(queryAuthorization.verify("APP-123", "QUERY_ACCESS")).toBeNull();
    expect(queryAuthorization.verify(queryAuthorization.create(7, "QUERY_CHALLENGE"), "QUERY_ACCESS")).toBeNull();
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
  it("looks up by document type and number without exposing full contact details", async () => {
    const result = await new QueryVerificationService().lookup({ documentType: "CE", documentNumber: "12345678" });
    expect(db.membershipApplication.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { documentType: "CE", documentNumber: "12345678", deletedAt: null } }));
    expect(JSON.stringify(result)).not.toContain("maria@example.com");
    expect(JSON.stringify(result)).not.toContain("999111812");
  });
  it("looks up all applications without requiring a tracking code", async () => {
    db.membershipApplication.findMany.mockResolvedValue([{ id: 7, email: "m@example.com", phone: "" }]);
    const result = await new QueryVerificationService().lookup({ documentType: "DNI", documentNumber: "12345678" });
    expect(queryAuthorization.verify(result.context, "QUERY_CHALLENGE")).toBe(7);
    expect(db.membershipApplication.findMany).toHaveBeenLastCalledWith(expect.objectContaining({
      where: { documentType: "DNI", documentNumber: "12345678", deletedAt: null },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    }));
  });
  it("rejects trackingCode as a query lookup parameter", async () => {
    await expect(new QueryVerificationService().lookup({ documentType: "DNI", documentNumber: "12345678", trackingCode: "APP-7" })).rejects.toThrow("Revisa el tipo y número de documento");
    expect(db.membershipApplication.findMany).not.toHaveBeenCalled();
  });
});
