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
