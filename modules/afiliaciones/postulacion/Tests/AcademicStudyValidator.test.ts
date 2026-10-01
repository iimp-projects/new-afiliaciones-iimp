import { describe, expect, it } from "vitest";
import { AcademicStudyValidator } from "../Validators/AcademicStudyValidator";
import { MembershipType } from "../Types/MembershipType";
import type { AcademicStudy } from "../Models/AcademicStudy";

const validator = new AcademicStudyValidator();

const activeStudy: AcademicStudy = {
  institutionId: 5,
  degreeId: 5,
  specialtyId: 5,
  degreeTitle: "Ingeniero de Minas",
  specialty: "",
  admissionYear: 2015,
  graduationYear: 2020,
};

describe("AcademicStudyValidator — Asociado Activo", () => {
  it("acepta una formación académica completa", () => {
    expect(validator.validate(activeStudy, MembershipType.ACTIVE).valid).toBe(true);
  });

  it.each([
    ["sin universidad/instituto", { institutionId: undefined }, "institutionId"],
    ["sin grado académico", { degreeId: undefined }, "degreeId"],
    ["sin especialidad", { specialtyId: undefined, specialty: "" }, "specialty"],
    ["sin título obtenido", { degreeTitle: "" }, "degreeTitle"],
    ["sin año de ingreso", { admissionYear: undefined }, "admissionYear"],
    ["sin año de egreso", { graduationYear: undefined }, "graduationYear"],
  ])("rechaza %s", (_name, patch, field) => {
    const result = validator.validate({ ...activeStudy, ...patch }, MembershipType.ACTIVE);
    expect(result.errors.some((error) => error.field === field)).toBe(true);
  });

  it("valida ambos años presentes", () => {
    expect(validator.validate(activeStudy, MembershipType.ACTIVE).valid).toBe(true);
  });

  it("rechaza año de ingreso fuera de rango (futuro)", () => {
    const futureYear = new Date().getFullYear() + 1;
    const result = validator.validate({ ...activeStudy, admissionYear: futureYear }, MembershipType.ACTIVE);
    expect(result.errors.some((error) => error.field === "admissionYear")).toBe(true);
  });

  it("rechaza egreso anterior al ingreso", () => {
    const result = validator.validate({ ...activeStudy, admissionYear: 2020, graduationYear: 2015 }, MembershipType.ACTIVE);
    expect(result.errors.some((error) => error.field === "graduationYear")).toBe(true);
  });
});

describe("AcademicStudyValidator — Asociado Estudiante (regresión)", () => {
  const studentStudy: AcademicStudy = {
    institutionId: 5,
    degreeTitle: "",
    specialty: "",
    cycle: 7,
    universityLetter: { name: "constancia.pdf", type: "application/pdf", url: "http://x" } as unknown as File,
    studentTermsAccepted: true,
  };

  it("no exige grado, título, especialidad ni años", () => {
    expect(validator.validate(studentStudy, MembershipType.STUDENT).valid).toBe(true);
  });

  it("no exige año de ingreso ni de egreso", () => {
    const result = validator.validate(studentStudy, MembershipType.STUDENT);
    expect(result.errors.some((error) => error.field === "admissionYear")).toBe(false);
    expect(result.errors.some((error) => error.field === "graduationYear")).toBe(false);
  });
});

describe("AcademicStudyValidator — Ciclo (solo Estudiante)", () => {
  const baseStudent: AcademicStudy = {
    institutionId: 5,
    degreeTitle: "",
    specialty: "",
    universityLetter: { name: "constancia.pdf", type: "application/pdf", url: "http://x" } as unknown as File,
    studentTermsAccepted: true,
  };

  it("rechaza ciclo vacío", () => {
    const result = validator.validate(baseStudent, MembershipType.STUDENT);
    expect(result.errors.some((error) => error.field === "cycle" && error.code === "REQ")).toBe(true);
  });

  it.each([7, 8, 9, 10])("acepta el ciclo %i", (cycle) => {
    const result = validator.validate({ ...baseStudent, cycle }, MembershipType.STUDENT);
    expect(result.valid).toBe(true);
  });

  it.each([0, 5, 6, 11, -1, 1.5, "8"])("rechaza el ciclo fuera de 7, 8, 9 y 10 (%s)", (cycle) => {
    const result = validator.validate({ ...baseStudent, cycle: cycle as unknown as number }, MembershipType.STUDENT);
    expect(result.errors.some((error) => error.field === "cycle")).toBe(true);
  });

  it("no exige ciclo para Asociado Activo", () => {
    const activeWithCycle = { ...activeStudy, cycle: 9 };
    const result = validator.validate(activeWithCycle, MembershipType.ACTIVE);
    expect(result.errors.some((error) => error.field === "cycle")).toBe(false);
    expect(result.valid).toBe(true);
  });
});
