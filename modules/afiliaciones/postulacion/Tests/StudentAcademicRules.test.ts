import { describe, expect, it } from "vitest";
import {
  STUDENT_ALLOWED_SPECIALTY_CODES,
  isLikelyUniversityName,
  isStudentAllowedSpecialtyCode,
} from "../StudentAcademicRules";

describe("StudentAcademicRules — especialidades canónicas", () => {
  it("expone exactamente las tres especialidades permitidas", () => {
    expect([...STUDENT_ALLOWED_SPECIALTY_CODES]).toEqual(["ESP-MIN", "ESP-GEO", "ESP-MET"]);
  });

  it.each(["ESP-MIN", "ESP-GEO", "ESP-MET"])("permite %s", (code) => {
    expect(isStudentAllowedSpecialtyCode(code)).toBe(true);
  });

  it.each(["ESP-CIVIL", "ESP-OTH", "ESP-DER", "", null, undefined])("rechaza %s", (code) => {
    expect(isStudentAllowedSpecialtyCode(code as string | null | undefined)).toBe(false);
  });
});

describe("StudentAcademicRules — filtro provisional de universidad", () => {
  it.each([
    "Universidad Nacional de Ingeniería",
    "Pontificia Universidad Católica del Perú",
    "Universidad Nacional Mayor de San Marcos",
    "Massachusetts Institute of Technology",
    "Harvard University",
  ])("considera universidad a %s", (name) => {
    expect(isLikelyUniversityName(name)).toBe(true);
  });

  it.each([
    "SENATI",
    "TECSUP",
    "SENCICO",
    "CIBERTEC",
    "ISIL (Instituto San Ignacio de Loyola)",
    "CERTUS",
    "IPAE Escuela de Empresarios",
    "Instituto IDAT",
    "CENFOTUR",
    "Instituto Superior Tecnológico Público Espinar",
    "IESTP República Federal de Alemania",
    "ISTP ERASMO ARELLANO GUILLEN",
    "CETPRO CEFOTEM ITEM",
    "Escuela de Posgrado Gerens",
    "COMPAÑÍA MINERA ARES S.A.C:",
    "LIMA CENTRO DE CONVENCIONES",
    "E0000000268",
    "TEST",
  ])("rechaza la institución no universitaria %s", (name) => {
    expect(isLikelyUniversityName(name)).toBe(false);
  });

  it("rechaza nombres vacíos o nulos", () => {
    expect(isLikelyUniversityName("")).toBe(false);
    expect(isLikelyUniversityName("   ")).toBe(false);
    expect(isLikelyUniversityName(null)).toBe(false);
    expect(isLikelyUniversityName(undefined)).toBe(false);
  });
});
