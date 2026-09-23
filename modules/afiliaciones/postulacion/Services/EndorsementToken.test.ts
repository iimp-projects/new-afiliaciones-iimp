import { beforeEach, describe, expect, it } from "vitest";
import jwt from "jsonwebtoken";
import { ENDORSEMENT_AUDIENCE, ENDORSEMENT_ISSUER, ENDORSEMENT_PURPOSE, signEndorsementToken, verifyEndorsementToken } from "./EndorsementToken";

const SECRET = "test-endorsement-secret";
const payload = { applicationId: 7, sponsorPersonId: 42 };

describe("EndorsementToken", () => {
  beforeEach(() => {
    process.env.JWT_SECRET = SECRET;
  });

  it("emite y verifica un token válido con issuer, audience y purpose", () => {
    const token = signEndorsementToken(payload);
    const decoded = jwt.decode(token) as Record<string, unknown>;

    expect(decoded.iss).toBe(ENDORSEMENT_ISSUER);
    expect(decoded.aud).toBe(ENDORSEMENT_AUDIENCE);
    expect(decoded.purpose).toBe(ENDORSEMENT_PURPOSE);
    expect(decoded.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
    expect(verifyEndorsementToken(token)).toEqual(payload);
  });

  it("rechaza un token expirado", () => {
    const token = jwt.sign({ ...payload, purpose: ENDORSEMENT_PURPOSE }, SECRET, {
      expiresIn: -10,
      issuer: ENDORSEMENT_ISSUER,
      audience: ENDORSEMENT_AUDIENCE,
    });

    expect(() => verifyEndorsementToken(token)).toThrow();
  });

  it("rechaza un issuer incorrecto", () => {
    const token = jwt.sign({ ...payload, purpose: ENDORSEMENT_PURPOSE }, SECRET, {
      issuer: "otro-emisor",
      audience: ENDORSEMENT_AUDIENCE,
    });

    expect(() => verifyEndorsementToken(token)).toThrow(/no corresponde/);
  });

  it("rechaza una audience incorrecta", () => {
    const token = jwt.sign({ ...payload, purpose: ENDORSEMENT_PURPOSE }, SECRET, {
      issuer: ENDORSEMENT_ISSUER,
      audience: "otra-audiencia",
    });

    expect(() => verifyEndorsementToken(token)).toThrow(/no corresponde/);
  });

  it("rechaza un purpose incorrecto", () => {
    const token = jwt.sign({ ...payload, purpose: "otro-proposito" }, SECRET, {
      issuer: ENDORSEMENT_ISSUER,
      audience: ENDORSEMENT_AUDIENCE,
    });

    expect(() => verifyEndorsementToken(token)).toThrow(/no corresponde/);
  });

  it("rechaza un token válido destinado a otro flujo", () => {
    const otherFlow = jwt.sign({ ...payload, purpose: "payment-restore" }, SECRET, {
      issuer: ENDORSEMENT_ISSUER,
      audience: ENDORSEMENT_AUDIENCE,
    });

    expect(() => verifyEndorsementToken(otherFlow)).toThrow(/no corresponde/);
  });

  it("acepta un token legacy sin claims para mantener compatibilidad", () => {
    const legacy = jwt.sign(payload, SECRET, { expiresIn: "7d" });
    expect(verifyEndorsementToken(legacy)).toEqual(payload);
  });

  it("rechaza un token con firma inválida", () => {
    const token = jwt.sign({ ...payload, purpose: ENDORSEMENT_PURPOSE }, "otro-secreto", {
      issuer: ENDORSEMENT_ISSUER,
      audience: ENDORSEMENT_AUDIENCE,
    });

    expect(() => verifyEndorsementToken(token)).toThrow();
  });
});
