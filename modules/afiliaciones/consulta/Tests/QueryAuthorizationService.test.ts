import jwt from "jsonwebtoken";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { queryAuthorization } from "../Services/QueryAuthorizationService";

const SECRET = "test-only-query-secret";

function expiredToken(applicationId = 7): string {
  return jwt.sign(
    { applicationId, applicationIds: [applicationId], purpose: "QUERY_ACCESS" },
    SECRET,
    { algorithm: "HS256", expiresIn: -60, audience: "iimp-consulta" },
  );
}

describe("QueryAuthorizationService — ciclo de vida de iimp_application_access", () => {
  beforeEach(() => {
    vi.stubEnv("AUTH_SECRET", SECRET);
    vi.useRealTimers();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.useRealTimers();
  });

  it("VALID_TOKEN_WORKS: un token válido resuelve sus applicationIds", () => {
    const token = queryAuthorization.createAccess([7, 8], 7);
    expect(queryAuthorization.allowedIds(token)).toEqual([7, 8]);
    expect(queryAuthorization.resolveAccess(token)).toEqual({ status: "VALID", applicationIds: [7, 8], applicationId: 7 });
  });

  it("VALID_TOKEN_RENEWS: un token válido se renueva manteniendo el alcance", () => {
    const token = queryAuthorization.createAccess([7, 8], 7);
    const renewed = queryAuthorization.renewAccess(token);
    expect(renewed).not.toBeNull();
    expect(queryAuthorization.allowedIds(renewed!)).toEqual([7, 8]);
  });

  it("RENEWED_TOKEN_EXTENDS_SESSION: la actividad legítima alarga la expiración", () => {
    vi.useFakeTimers();
    const t0 = new Date("2026-09-29T12:00:00Z");
    vi.setSystemTime(t0);
    const original = queryAuthorization.createAccess([7], 7);
    const originalExp = (jwt.decode(original) as { exp: number }).exp;

    vi.setSystemTime(new Date(t0.getTime() + 5 * 60 * 1000));
    const renewed = queryAuthorization.renewAccess(original);
    expect(renewed).not.toBeNull();
    const renewedExp = (jwt.decode(renewed!) as { exp: number }).exp;
    expect(renewedExp).toBeGreaterThan(originalExp);
    expect(queryAuthorization.resolveAccess(renewed!).status).toBe("VALID");
  });

  it("EXPIRED_TOKEN_REJECTED: un token expirado no autoriza", () => {
    const token = expiredToken();
    expect(queryAuthorization.resolveAccess(token).status).toBe("EXPIRED");
    expect(queryAuthorization.allowedIds(token)).toEqual([]);
  });

  it("EXPIRED_TOKEN_NOT_RENEWED: un token expirado nunca se revive", () => {
    expect(queryAuthorization.renewAccess(expiredToken())).toBeNull();
  });

  it("INVALID_SIGNATURE_REJECTED: firma distinta no autoriza ni renueva", () => {
    const forged = jwt.sign(
      { applicationId: 7, applicationIds: [7], purpose: "QUERY_ACCESS" },
      "otro-secreto-distinto",
      { algorithm: "HS256", audience: "iimp-consulta" },
    );
    expect(queryAuthorization.resolveAccess(forged).status).toBe("INVALID");
    expect(queryAuthorization.allowedIds(forged)).toEqual([]);
    expect(queryAuthorization.renewAccess(forged)).toBeNull();
  });

  it("INVALID_PURPOSE_REJECTED: purpose distinto a QUERY_ACCESS no autoriza", () => {
    const wrongPurpose = jwt.sign(
      { applicationId: 7, applicationIds: [7], purpose: "QUERY_CHALLENGE" },
      SECRET,
      { algorithm: "HS256", audience: "iimp-consulta" },
    );
    expect(queryAuthorization.resolveAccess(wrongPurpose).status).toBe("INVALID");
    expect(queryAuthorization.allowedIds(wrongPurpose)).toEqual([]);
  });

  it("WRONG_APPLICATION_REJECTED: un token no autoriza applicationIds ajenos", () => {
    const token = queryAuthorization.createAccess([7], 7);
    expect(queryAuthorization.allowedIds(token)).toEqual([7]);
    expect(queryAuthorization.allowedIds(token)).not.toContain(999);
  });

  it("MISSING: sin token no hay acceso ni renovación", () => {
    expect(queryAuthorization.resolveAccess(undefined).status).toBe("MISSING");
    expect(queryAuthorization.allowedIds(undefined)).toEqual([]);
    expect(queryAuthorization.renewAccess(undefined)).toBeNull();
  });
});
