import { describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  $transaction: vi.fn(),
  verificationToken: { findUnique: vi.fn() },
  user: { findUnique: vi.fn(), findFirst: vi.fn() },
}));
const sendMail = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({ prisma: db }));
vi.mock("@/modules/shared/Services/MailService", () => ({ MailService: class { sendMail = sendMail; } }));

import { AccountActivationError, AccountActivationService, resolveActivationUrl } from "./service";

describe("AccountActivationService", () => {
  it("prioritizes AUTH_URL and removes trailing slashes", () => {
    process.env.AUTH_URL = "https://portal.example///";
    process.env.NEXT_PUBLIC_APP_URL = "https://fallback.example";
    expect(resolveActivationUrl("raw-token")).toBe("https://portal.example/activar-cuenta?token=raw-token");
  });

  it("uses NEXT_PUBLIC_APP_URL only as a fallback", () => {
    delete process.env.AUTH_URL;
    process.env.NEXT_PUBLIC_APP_URL = "https://fallback.example/";
    expect(resolveActivationUrl("raw-token")).toBe("https://fallback.example/activar-cuenta?token=raw-token");
  });

  it("fails explicitly when no application URL is configured", () => {
    delete process.env.AUTH_URL;
    delete process.env.NEXT_PUBLIC_APP_URL;
    expect(() => resolveActivationUrl("raw-token")).toThrow("APP_URL_NOT_CONFIGURED");
  });

  it("stores only a SHA-256 activation token and replaces a previous activation", async () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://portal.example";
    const tx = {
      $executeRaw: vi.fn(),
      user: { findUnique: vi.fn().mockResolvedValue({ id: 7, email: "ana@example.com", status: "PENDING", deletedAt: null, roleId: 2, person: { firstName: "Ana", paternalLastName: "Pérez" }, credentials: [] }) },
      verificationToken: { deleteMany: vi.fn(), create: vi.fn() },
    };
    db.$transaction.mockImplementationOnce((callback: (client: typeof tx) => unknown) => callback(tx));

    await new AccountActivationService().createAndSendActivation(7);

    expect(tx.verificationToken.deleteMany).toHaveBeenCalledWith({ where: { identifier: "account-activation:7" } });
    const stored = tx.verificationToken.create.mock.calls[0][0].data.token;
    expect(stored).toMatch(/^[a-f0-9]{64}$/);
    expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({ to: "ana@example.com", html: expect.stringContaining("activar-cuenta?token=") }));
  });

  it("rejects expired tokens", async () => {
    db.verificationToken.findUnique.mockResolvedValueOnce({ identifier: "account-activation:7", expires: new Date(0) });
    await expect(new AccountActivationService().getActivationDetails("a".repeat(43))).resolves.toBeNull();
  });

  it("does not accept a forgot-password token", async () => {
    db.verificationToken.findUnique.mockResolvedValueOnce({ identifier: "ana@example.com", expires: new Date(Date.now() + 60_000) });
    await expect(new AccountActivationService().getActivationDetails("a".repeat(43))).resolves.toBeNull();
  });

  it("keeps the pending account and the activation token when the email fails", async () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://portal.example";
    const tx = {
      $executeRaw: vi.fn(),
      user: { findUnique: vi.fn().mockResolvedValue({ id: 7, email: "ana@example.com", status: "PENDING", deletedAt: null, roleId: 2, person: { firstName: "Ana", paternalLastName: "Pérez" }, credentials: [] }) },
      verificationToken: { deleteMany: vi.fn(), create: vi.fn() },
    };
    db.$transaction.mockImplementationOnce((callback: (client: typeof tx) => unknown) => callback(tx));
    sendMail.mockClear();
    sendMail.mockRejectedValueOnce(new Error("SMTP unavailable"));

    await expect(new AccountActivationService().createAndSendActivation(7)).resolves.toBeUndefined();

    expect(tx.verificationToken.create).toHaveBeenCalledOnce();
    expect(sendMail).toHaveBeenCalledOnce();
  });

  it("consumes an activation once while creating the password credential", async () => {
    const tx = {
      verificationToken: { findUnique: vi.fn().mockResolvedValue({ identifier: "account-activation:7", expires: new Date(Date.now() + 60_000) }), delete: vi.fn() },
      user: { findUnique: vi.fn().mockResolvedValue({ id: 7, status: "PENDING" }), update: vi.fn() },
      credential: { deleteMany: vi.fn(), create: vi.fn() },
    };
    db.$transaction.mockImplementationOnce((callback: (client: typeof tx) => unknown) => callback(tx));

    await new AccountActivationService().consumeActivation("a".repeat(43), "SecurePass1");

    expect(tx.credential.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ userId: 7, type: "PASSWORD" }) }));
    expect(tx.verificationToken.delete).toHaveBeenCalledOnce();
  });

  it("does not consume an activation twice", async () => {
    db.$transaction.mockImplementationOnce(async (callback: (client: { verificationToken: { findUnique: ReturnType<typeof vi.fn> } }) => unknown) => callback({ verificationToken: { findUnique: vi.fn().mockResolvedValue(null) } }));
    await expect(new AccountActivationService().consumeActivation("a".repeat(43), "SecurePass1")).rejects.toBeInstanceOf(AccountActivationError);
  });
});
