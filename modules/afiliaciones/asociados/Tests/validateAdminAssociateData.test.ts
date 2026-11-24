import { describe, expect, it } from "vitest";
import type { AdminAssociateDataInput } from "../Validators/AdminAssociateDataSchema";
import { validateAdminAssociateData } from "../Validators/validateAdminAssociateData";

const base = {
  identity: {
    firstName: "Ana",
    paternalLastName: "Pérez",
    maternalLastName: "Gómez",
    documentType: "DNI",
    documentNumber: "12345678",
    birthDate: "1990-01-01",
    gender: "FEMALE",
    nationalityId: 1,
  },
  contact: { phone: "999999999", primaryEmail: "ana@example.com", secondaryEmail: null },
  address: {
    street: "Av. Prueba 123",
    reference: null,
    countryId: 1,
    districtId: 321,
    postalCode: null,
    foreignRegion: null,
    foreignCity: null,
  },
  academic: {
    studyLevel: "BACHELOR",
    degreeId: 1,
    universityId: 2,
    specialtyId: 3,
    degreeTitle: "Ingeniero de Minas",
    professionalAssociation: "CIP",
    licenseNumber: "123456",
    graduationYear: 2015,
    termOrSemester: null,
  },
  employment: {
    employmentStatus: "EMPLOYED",
    companyId: 4,
    positionId: 5,
    companyName: "Empresa Demo",
    positionName: "Ingeniero",
    companyTaxId: "20123456789",
    area: "Operaciones",
    workingAddress: "Av. Trabajo 456, Lima",
    workPhone: "988888888",
    workExtension: "12",
    workEmail: "ana@empresa.com",
  },
} as unknown as AdminAssociateDataInput;

const validate = (input: AdminAssociateDataInput, isStudent = false) =>
  validateAdminAssociateData(input, { isStudent, currentYear: 2026 });

describe("validateAdminAssociateData", () => {
  it("acepta una ficha completa válida", () => {
    expect(validate(base)).toEqual({});
  });

  it("acepta apellido materno vacío o nulo", () => {
    expect(validate({ ...base, identity: { ...base.identity, maternalLastName: null } })).toEqual({});
    expect(validate({ ...base, identity: { ...base.identity, maternalLastName: "" } })).toEqual({});
  });

  it("valida el formato cuando se ingresa apellido materno", () => {
    const errors = validate({ ...base, identity: { ...base.identity, maternalLastName: "G0mez" } });
    expect(errors["identity.maternalLastName"]).toBeDefined();
  });

  it("valida nombres, documento, fecha y género", () => {
    const errors = validate({
      ...base,
      identity: {
        ...base.identity,
        firstName: "A1",
        documentNumber: "1234",
        birthDate: "2015-01-01",
        gender: "OTHER",
      },
    });
    expect(errors["identity.firstName"]).toBeDefined();
    expect(errors["identity.documentNumber"]).toContain("8 dígitos");
    expect(errors["identity.birthDate"]).toContain("18 y 100");
    expect(errors["identity.gender"]).toBeDefined();
  });

  it("valida celular, correos y dirección peruana", () => {
    const errors = validate({
      ...base,
      contact: { phone: "99999999", primaryEmail: "correo", secondaryEmail: "otro" },
      address: { ...base.address, street: " ", districtId: null },
    });
    expect(errors["contact.phone"]).toContain("9 dígitos");
    expect(errors["contact.primaryEmail"]).toBeDefined();
    expect(errors["contact.secondaryEmail"]).toBeDefined();
    expect(errors["address.street"]).toBeDefined();
    expect(errors["address.districtId"]).toBeDefined();
  });

  it("exige grado, título y año de egreso al asociado activo", () => {
    const errors = validate({
      ...base,
      academic: { ...base.academic!, degreeId: null, degreeTitle: null, graduationYear: null },
    });
    expect(errors["academic.degreeId"]).toBeDefined();
    expect(errors["academic.degreeTitle"]).toBeDefined();
    expect(errors["academic.graduationYear"]).toBeDefined();
  });

  it("exige ciclo 7 a 10 al estudiante y permite grado vacío", () => {
    const errors = validate({
      ...base,
      academic: { ...base.academic!, degreeId: null, degreeTitle: null, graduationYear: null, termOrSemester: "5" },
    }, true);
    expect(errors["academic.degreeId"]).toBeUndefined();
    expect(errors["academic.termOrSemester"]).toContain("7, 8, 9 o 10");
  });

  it("exige número de colegiatura cuando se registra el colegio", () => {
    const errors = validate({
      ...base,
      academic: { ...base.academic!, licenseNumber: null },
    });
    expect(errors["academic.licenseNumber"]).toBeDefined();
  });

  it("acepta situación laboral sin actividad y no exige datos de empleo", () => {
    const errors = validate({
      ...base,
      employment: {
        employmentStatus: "NOT_WORKING",
        companyId: null,
        positionId: null,
        companyName: null,
        positionName: null,
        companyTaxId: null,
        area: null,
        workingAddress: null,
        workPhone: null,
        workExtension: null,
        workEmail: null,
      },
    });
    expect(errors).toEqual({});
  });

  it("valida los datos laborales", () => {
    const errors = validate({
      ...base,
      employment: {
        ...base.employment!,
        workPhone: "0000",
        workEmail: "correo",
        workExtension: "12A",
        workingAddress: "S/D",
      },
    });
    expect(errors["employment.workPhone"]).toBeDefined();
    expect(errors["employment.workEmail"]).toBeDefined();
    expect(errors["employment.workExtension"]).toBeDefined();
    expect(errors["employment.workingAddress"]).toBeDefined();
  });
});
