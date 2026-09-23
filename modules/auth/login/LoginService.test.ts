import { beforeEach, describe, expect, it, vi } from "vitest";

const findUserWithPassword = vi.hoisted(() => vi.fn());
const consume = vi.hoisted(() => vi.fn());

vi.mock("./repository", () => ({ loginRepository: { findUserWithPassword } }));
vi.mock("../security", () => ({ securityService: { isAccountLocked: vi.fn(() => false), handleLoginFailure: vi.fn(), handleLoginSuccess: vi.fn() } }));
vi.mock("../session", () => ({ sessionService: { createSession: vi.fn().mockResolvedValue({ id: "session-1" }) } }));
vi.mock("../errors", () => ({ AuthenticationError: class AuthenticationError extends Error {}, SecurityError: class SecurityError extends Error {} }));
vi.mock("../rate-limit/VerificationTokenRateLimiter", () => ({ verificationTokenRateLimiter: { consume } }));

import { LoginService } from "./service";

describe("LoginService account activation compatibility", () => {
  beforeEach(() => {
    findUserWithPassword.mockReset();
    consume.mockReset();
    consume.mockResolvedValue(true);
  });

  it("rejects a PENDING user even if it has a valid password credential", async () => {
    findUserWithPassword.mockResolvedValueOnce({ id: 1, status: "PENDING", lockedUntil: null, credentials: [{ secret: "$2b$12$QhJ2U.OwTq7fSe2vr4uy.uZUSqQelXoDywWLAmJEziPCd1Oh4Myae" }] });
    await expect(new LoginService().authenticate({ email: "ana@example.com", password: "SecurePass1" }, {})).rejects.toThrow("cuenta no se encuentra activa");
  });

  it("bloquea el intento cuando se agota el límite por IP", async () => {
    consume.mockResolvedValueOnce(false);
    await expect(new LoginService().authenticate({ email: "ana@example.com", password: "SecurePass1" }, { ipAddress: "1.2.3.4" }))
      .rejects.toThrow("Demasiados intentos de acceso");
  });

  it("aplica el límite por IP antes de consultar credenciales", async () => {
    consume.mockResolvedValueOnce(false);
    await expect(new LoginService().authenticate({ email: "ana@example.com", password: "SecurePass1" }, { ipAddress: "1.2.3.4, 5.6.7.8" }))
      .rejects.toThrow("Demasiados intentos de acceso");
    expect(findUserWithPassword).not.toHaveBeenCalled();
    expect(consume).toHaveBeenCalledWith("login:ip", "1.2.3.4", 20, 15);
  });
});
