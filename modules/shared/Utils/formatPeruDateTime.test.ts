import { describe, expect, it } from "vitest";
import { formatCalendarDate, formatPeruDate, formatPeruDateTime, formatPeruTime } from "./formatPeruDateTime";

describe("formatPeruDate / formatPeruTime (America/Lima)", () => {
  it("convierte 2026-09-30T14:49:00Z a 30/09/2026 y 09:49 a. m.", () => {
    expect(formatPeruDate("2026-09-30T14:49:00Z")).toBe("30/09/2026");
    expect(formatPeruTime("2026-09-30T14:49:00Z")).toBe("09:49 a. m.");
  });

  it("cambio de día: 2026-09-30T02:30:00Z corresponde a 29/09/2026 09:30 p. m. en Lima", () => {
    expect(formatPeruDate("2026-09-30T02:30:00Z")).toBe("29/09/2026");
    expect(formatPeruTime("2026-09-30T02:30:00Z")).toBe("09:30 p. m.");
  });

  it("meridiem p. m. correcto (mediodía)", () => {
    expect(formatPeruTime("2026-09-30T17:00:00Z")).toBe("12:00 p. m.");
  });

  it("medianoche Lima (00:xx a. m.)", () => {
    expect(formatPeruTime("2026-09-30T05:05:00Z")).toBe("12:05 a. m.");
  });

  it("formato combinado", () => {
    expect(formatPeruDateTime("2026-09-30T14:49:00Z")).toBe("30/09/2026 09:49 a. m.");
  });

  it("acepta Date y devuelve fallback ante valores inválidos", () => {
    expect(formatPeruDate(new Date("2026-09-30T14:49:00Z"))).toBe("30/09/2026");
    expect(formatPeruDate("not-a-date")).toBe("No disponible");
    expect(formatPeruTime("not-a-date")).toBe("No disponible");
  });
});

describe("formatCalendarDate (DATE-only, sin conversión de zona)", () => {
  it("preserva 1997-01-10 como 10/01/1997", () => {
    expect(formatCalendarDate("1997-01-10")).toBe("10/01/1997");
  });

  it("no desplaza el día para un ISO timestamp a medianoche UTC", () => {
    expect(formatCalendarDate("1997-01-10T00:00:00.000Z")).toBe("10/01/1997");
  });

  it("no desplaza el día para un objeto Date", () => {
    expect(formatCalendarDate(new Date("1997-01-10T00:00:00.000Z"))).toBe("10/01/1997");
  });

  it("devuelve fallback ante valores vacíos o inválidos", () => {
    expect(formatCalendarDate(null)).toBe("No disponible");
    expect(formatCalendarDate(undefined)).toBe("No disponible");
    expect(formatCalendarDate("")).toBe("No disponible");
  });
});
