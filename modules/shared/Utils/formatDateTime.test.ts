import { describe, expect, it } from "vitest";
import { formatDateTimeEsPe } from "./formatDateTime";

describe("formatDateTimeEsPe", () => {
  it("formatea fecha y hora con espacios regulares (sin U+00A0 / U+202F)", () => {
    const result = formatDateTimeEsPe(new Date("2026-09-29T23:34:00"));
    expect(result).toBe("29 set. 2026, 11:34 p. m.");
    expect(result).not.toMatch(/[\u00a0\u202f]/);
  });

  it("usa meridiem correcto y hora de 12 horas sin cero inicial", () => {
    expect(formatDateTimeEsPe(new Date("2026-09-29T00:05:00"))).toBe("29 set. 2026, 12:05 a. m.");
    expect(formatDateTimeEsPe(new Date("2026-09-29T12:00:00"))).toBe("29 set. 2026, 12:00 p. m.");
  });

  it("acepta cadenas ISO y devuelve fallback ante valores inválidos", () => {
    expect(formatDateTimeEsPe("2026-01-05T09:07:00")).toBe("5 ene. 2026, 9:07 a. m.");
    expect(formatDateTimeEsPe("not-a-date")).toBe("No disponible");
    expect(formatDateTimeEsPe(null)).toBe("No disponible");
    expect(formatDateTimeEsPe(undefined)).toBe("No disponible");
  });
});
