import { describe, expect, it } from "vitest";
import { isAffiliateUser } from "./types";

describe("affiliate access identity", () => {
  it("recognizes an associate by the formal account type", () => {
    expect(isAffiliateUser({ type: "AFFILIATE", role: { slug: "POSTULANTE" } } as never)).toBe(true);
  });

  it("recognizes legacy associate accounts by their formal associate role", () => {
    expect(isAffiliateUser({ type: "VALIDATOR", role: { slug: "ASOCIADO_ACTIVO" } } as never)).toBe(true);
    expect(isAffiliateUser({ type: "VALIDATOR", role: { slug: "ASOCIADO_ESTUDIANTE" } } as never)).toBe(true);
  });

  it("does not classify administrative roles as associates", () => {
    expect(isAffiliateUser({ type: "SYSTEM_ADMIN", role: { slug: "SUPER_ADMIN" } } as never)).toBe(false);
  });
});
