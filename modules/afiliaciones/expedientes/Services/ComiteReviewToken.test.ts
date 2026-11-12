import { beforeEach, describe, expect, it } from "vitest";
import jwt from "jsonwebtoken";
import {
  COMITE_REVIEW_AUDIENCE,
  COMITE_REVIEW_ISSUER,
  COMITE_REVIEW_PURPOSE,
  signComiteReviewToken,
  verifyComiteReviewToken,
} from "./ComiteReviewToken";

const SECRET = "test-comite-review-secret";
const payload = { applicationId: 7, committeeUserId: 42 };

describe("ComiteReviewToken", () => {
  beforeEach(() => {
    process.env.JWT_SECRET = SECRET;
  });

  it("emite y verifica un token con issuer, audience y purpose", () => {
    const token = signComiteReviewToken(payload);
    const decoded = jwt.decode(token) as Record<string, unknown>;

    expect(decoded.iss).toBe(COMITE_REVIEW_ISSUER);
    expect(decoded.aud).toBe(COMITE_REVIEW_AUDIENCE);
    expect(decoded.purpose).toBe(COMITE_REVIEW_PURPOSE);
    expect(verifyComiteReviewToken(token)).toEqual(payload);
  });

  it("rechaza un token expirado", () => {
    const token = jwt.sign({ ...payload, purpose: COMITE_REVIEW_PURPOSE }, SECRET, {
      expiresIn: -10,
      issuer: COMITE_REVIEW_ISSUER,
      audience: COMITE_REVIEW_AUDIENCE,
    });

    expect(() => verifyComiteReviewToken(token)).toThrow();
  });

  it("rechaza un token destinado a otro flujo", () => {
    const token = jwt.sign({ ...payload, purpose: "endorsement-review" }, SECRET, {
      expiresIn: "7d",
      issuer: COMITE_REVIEW_ISSUER,
      audience: COMITE_REVIEW_AUDIENCE,
    });

    expect(() => verifyComiteReviewToken(token)).toThrow(/no corresponde/);
  });

  it("rechaza un token sin identificadores válidos", () => {
    const token = jwt.sign(
      { applicationId: "7", committeeUserId: 42, purpose: COMITE_REVIEW_PURPOSE },
      SECRET,
      { expiresIn: "7d", issuer: COMITE_REVIEW_ISSUER, audience: COMITE_REVIEW_AUDIENCE },
    );

    expect(() => verifyComiteReviewToken(token)).toThrow(/formato correcto/);
  });
});
