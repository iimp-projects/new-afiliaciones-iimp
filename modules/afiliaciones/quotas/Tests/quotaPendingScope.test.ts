import { describe, expect, it } from "vitest";
import { currentQuotaYear, isCountedPending, isUpcomingQuota } from "../Services/quotaPendingScope";

describe("quotaPendingScope", () => {
  const reference = new Date("2026-11-19T12:00:00Z");

  it("clasifica un pendiente de un año futuro como próxima cuota", () => {
    expect(isUpcomingQuota("PENDIENTE", 2027, reference)).toBe(true);
    expect(isCountedPending("PENDIENTE", 2027, reference)).toBe(false);
  });

  it("cuenta como pendiente el año vigente y los anteriores", () => {
    expect(isCountedPending("PENDIENTE", 2026, reference)).toBe(true);
    expect(isCountedPending("PENDIENTE", 2005, reference)).toBe(true);
  });

  it("una cuota facturada nunca es pendiente ni próxima cuota", () => {
    expect(isCountedPending("FACTURADO", 2026, reference)).toBe(false);
    expect(isUpcomingQuota("FACTURADO", 2027, reference)).toBe(false);
  });

  it("resuelve el año calendario en America/Lima", () => {
    expect(currentQuotaYear(new Date("2027-01-01T02:00:00Z"))).toBe(2026);
  });
});
