import { describe, expect, it } from "vitest";
import {
  evaluateAcademicPeriod,
  formatAcademicPeriod,
  parseAcademicPeriod,
  resolveCurrentAcademicPeriod,
} from "../Services/AcademicCalendarPolicy";

describe("AcademicCalendarPolicy", () => {
  it("interpreta periodos con guion, espacio y texto académico", () => {
    expect(parseAcademicPeriod("2022-II")).toEqual({ year: 2022, term: 2 });
    expect(parseAcademicPeriod("2022-2")).toEqual({ year: 2022, term: 2 });
    expect(parseAcademicPeriod("Semestre Académico 2026-I")).toEqual({ year: 2026, term: 1 });
  });

  it("no interpreta un año suelto como periodo", () => {
    expect(parseAcademicPeriod("2022")).toBeNull();
    expect(parseAcademicPeriod("periodo anual 2022")).toBeNull();
    expect(parseAcademicPeriod(null)).toBeNull();
  });

  it("respeta el override institucional", () => {
    const reference = new Date("2026-11-16T12:00:00.000Z");
    expect(resolveCurrentAcademicPeriod(reference, "2026-I")).toEqual({ year: 2026, term: 1 });
  });

  it("usa el calendario peruano por defecto", () => {
    expect(resolveCurrentAcademicPeriod(new Date("2026-11-16T12:00:00.000Z"))).toEqual({ year: 2026, term: 2 });
    expect(resolveCurrentAcademicPeriod(new Date("2026-05-16T12:00:00.000Z"))).toEqual({ year: 2026, term: 1 });
    expect(resolveCurrentAcademicPeriod(new Date("2026-01-16T12:00:00.000Z"))).toEqual({ year: 2025, term: 2 });
  });

  it("acepta el periodo actual y el anterior dentro de la tolerancia", () => {
    const policy = { currentPeriod: { year: 2026, term: 2 } as const, maxPreviousSemesters: 1 };
    expect(evaluateAcademicPeriod({ year: 2026, term: 2 }, policy)).toBe("VALID");
    expect(evaluateAcademicPeriod({ year: 2026, term: 1 }, policy)).toBe("VALID");
    expect(evaluateAcademicPeriod({ year: 2025, term: 2 }, policy)).toBe("EXPIRED");
    expect(evaluateAcademicPeriod({ year: 2027, term: 1 }, policy)).toBe("FUTURE");
    expect(evaluateAcademicPeriod(null, policy)).toBe("UNKNOWN");
  });

  it("formatea el periodo de forma estable", () => {
    expect(formatAcademicPeriod({ year: 2026, term: 1 })).toBe("2026-I");
    expect(formatAcademicPeriod({ year: 2026, term: 2 })).toBe("2026-II");
  });
});
