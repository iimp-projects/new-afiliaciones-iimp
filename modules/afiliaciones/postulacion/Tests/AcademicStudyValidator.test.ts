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

describe("AcademicStudyValidator — Estudiante (campos obligatorios)", () => {
  const validStudent: AcademicStudy = {
    institutionId: 5,
    specialtyId: 2,
    specialty: "",
    degreeTitle: "",
    admissionYear: 2020,
    cycle: 7,
    universityLetter: { name: "constancia.pdf", type: "application/pdf", url: "http://x" } as unknown as File,
    studentTermsAccepted: true,
  };

  it("acepta una formación académica completa de estudiante", () => {
    expect(validator.validate(validStudent, MembershipType.STUDENT).valid).toBe(true);
  });

  it("no exige grado, título ni año de egreso", () => {
    const result = validator.validate(validStudent, MembershipType.STUDENT);
    expect(result.errors.some((error) => error.field === "degreeId")).toBe(false);
    expect(result.errors.some((error) => error.field === "degreeTitle")).toBe(false);
    expect(result.errors.some((error) => error.field === "graduationYear")).toBe(false);
  });

  it("rechaza especialidad vacía", () => {
    const result = validator.validate({ ...validStudent, specialtyId: undefined, specialty: "" }, MembershipType.STUDENT);
    expect(result.errors.some((error) => error.field === "specialty")).toBe(true);
  });

  it("acepta especialidad válida", () => {
    expect(validator.validate(validStudent, MembershipType.STUDENT).valid).toBe(true);
  });

  it("rechaza ciclo vacío", () => {
    const result = validator.validate({ ...validStudent, cycle: undefined }, MembershipType.STUDENT);
    expect(result.errors.some((error) => error.field === "cycle" && error.code === "REQ")).toBe(true);
  });

  it.each([7, 8, 9, 10])("acepta el ciclo %i", (cycle) => {
    expect(validator.validate({ ...validStudent, cycle }, MembershipType.STUDENT).valid).toBe(true);
  });

  it.each([0, 5, 6, 11, -1, 1.5, "8"])("rechaza el ciclo inválido %s", (cycle) => {
    const result = validator.validate({ ...validStudent, cycle: cycle as unknown as number }, MembershipType.STUDENT);
    expect(result.errors.some((error) => error.field === "cycle")).toBe(true);
  });

  it("rechaza año de ingreso vacío", () => {
    const result = validator.validate({ ...validStudent, admissionYear: undefined }, MembershipType.STUDENT);
    expect(result.errors.some((error) => error.field === "admissionYear" && error.code === "REQ")).toBe(true);
  });

  it("rechaza año de ingreso inválido (futuro)", () => {
    const futureYear = new Date().getFullYear() + 1;
    const result = validator.validate({ ...validStudent, admissionYear: futureYear }, MembershipType.STUDENT);
    expect(result.errors.some((error) => error.field === "admissionYear")).toBe(true);
  });

  it("acepta año de ingreso válido", () => {
    expect(validator.validate(validStudent, MembershipType.STUDENT).valid).toBe(true);
  });

  it("acepta especialidad + ciclo + año de ingreso válidos", () => {
    expect(validator.validate(validStudent, MembershipType.STUDENT).valid).toBe(true);
  });
});

describe("AcademicStudyValidator — Asociado Activo (sin regresión)", () => {
  it("no exige ciclo para Asociado Activo", () => {
    const activeWithCycle = { ...activeStudy, cycle: 9 };
    const result = validator.validate(activeWithCycle, MembershipType.ACTIVE);
    expect(result.errors.some((error) => error.field === "cycle")).toBe(false);
    expect(result.valid).toBe(true);
  });

  it("mantiene especialidad y año de ingreso obligatorios para Asociado Activo", () => {
    expect(validator.validate(activeStudy, MembershipType.ACTIVE).valid).toBe(true);
  });
});
