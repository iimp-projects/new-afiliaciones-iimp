import { beforeEach, describe, expect, it, vi } from "vitest";
import bcrypt from "bcryptjs";

const findUserWithPassword = vi.hoisted(() => vi.fn());
const consume = vi.hoisted(() => vi.fn());

vi.mock("./repository", () => ({ loginRepository: { findUserWithPassword } }));
vi.mock("../security", () => ({ securityService: { isAccountLocked: vi.fn(() => false), handleLoginFailure: vi.fn(), handleLoginSuccess: vi.fn() } }));
vi.mock("../session", () => ({ sessionService: { createSession: vi.fn().mockResolvedValue({ id: "session-1" }) } }));
vi.mock("../errors", () => ({ AuthenticationError: class AuthenticationError extends Error {}, SecurityError: class SecurityError extends Error {} }));
vi.mock("../rate-limit/VerificationTokenRateLimiter", () => ({ verificationTokenRateLimiter: { consume } }));

import { LoginService } from "./service";

const PASSWORD = "CorrectPass!";
const validHash = bcrypt.hashSync(PASSWORD, 12);

const activeUser = {
  id: 1,
  status: "ACTIVE",
  lockedUntil: null,
  credentials: [{ secret: validHash }],
};

describe("LoginService email normalization", () => {
  beforeEach(() => {
    findUserWithPassword.mockReset();
    consume.mockReset();
    consume.mockResolvedValue(true);
  });

  it("normalizes email to lowercase and trims it before lookup", async () => {
    findUserWithPassword.mockResolvedValueOnce(activeUser);

    await new LoginService().authenticate({ email: "  Usuario@IIMP.org.pe  ", password: PASSWORD }, {});

    expect(findUserWithPassword).toHaveBeenCalledWith("usuario@iimp.org.pe");
  });

  it("authenticates an uppercase email as the same user", async () => {
    findUserWithPassword.mockResolvedValueOnce(activeUser);

    await expect(
      new LoginService().authenticate({ email: "USUARIO@IIMP.ORG.PE", password: PASSWORD }, {}),
    ).resolves.toEqual({ sessionId: "session-1" });
  });

  it("authenticates a mixed-case email as the same user", async () => {
    findUserWithPassword.mockResolvedValueOnce(activeUser);

    await expect(
      new LoginService().authenticate({ email: "Usuario@IIMP.org.pe", password: PASSWORD }, {}),
    ).resolves.toEqual({ sessionId: "session-1" });
  });

  it("still rejects a wrong password", async () => {
    findUserWithPassword.mockResolvedValueOnce(activeUser);

    await expect(
      new LoginService().authenticate({ email: "usuario@iimp.org.pe", password: "WrongPass!" }, {}),
    ).rejects.toThrow("Credenciales inválidas");
  });

  it("still rejects an unknown user", async () => {
    findUserWithPassword.mockResolvedValueOnce(null);

    await expect(
      new LoginService().authenticate({ email: "nadie@iimp.org.pe", password: PASSWORD }, {}),
    ).rejects.toThrow("Credenciales inválidas");
  });
});

describe("LoginService account activation compatibility", () => {
  beforeEach(() => {
    findUserWithPassword.mockReset();
    consume.mockReset();
    consume.mockResolvedValue(true);
  });

  it("rejects a PENDING user even if it has a valid password credential", async () => {
    findUserWithPassword.mockResolvedValueOnce({ id: 1, status: "PENDING", lockedUntil: null, credentials: [{ secret: validHash }] });
    await expect(new LoginService().authenticate({ email: "ana@example.com", password: PASSWORD }, {})).rejects.toThrow("cuenta no se encuentra activa");
  });

  it("rejects an INACTIVE user", async () => {
    findUserWithPassword.mockResolvedValueOnce({ id: 2, status: "INACTIVE", lockedUntil: null, credentials: [{ secret: validHash }] });
    await expect(new LoginService().authenticate({ email: "ana@example.com", password: PASSWORD }, {})).rejects.toThrow("cuenta no se encuentra activa");
  });

  it("rejects a BLOCKED user", async () => {
    findUserWithPassword.mockResolvedValueOnce({ id: 3, status: "BLOCKED", lockedUntil: null, credentials: [{ secret: validHash }] });
    await expect(new LoginService().authenticate({ email: "ana@example.com", password: PASSWORD }, {})).rejects.toThrow("cuenta no se encuentra activa");
  });

  it("bloquea el intento cuando se agota el límite por IP", async () => {
    consume.mockResolvedValueOnce(false);
    await expect(new LoginService().authenticate({ email: "ana@example.com", password: PASSWORD }, { ipAddress: "1.2.3.4" }))
      .rejects.toThrow("Demasiados intentos de acceso");
  });

  it("aplica el límite por IP antes de consultar credenciales", async () => {
    consume.mockResolvedValueOnce(false);
    await expect(new LoginService().authenticate({ email: "ana@example.com", password: PASSWORD }, { ipAddress: "1.2.3.4, 5.6.7.8" }))
      .rejects.toThrow("Demasiados intentos de acceso");
    expect(findUserWithPassword).not.toHaveBeenCalled();
    expect(consume).toHaveBeenCalledWith("login:ip", "1.2.3.4", 20, 15);
  });
});
