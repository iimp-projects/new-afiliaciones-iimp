import { describe, expect, it } from "vitest";
import { adminAssociateDataSchema } from "../Validators/AdminAssociateDataSchema";

const base = {
  identity: {
    firstName: "Ana",
    paternalLastName: "Pérez",
    maternalLastName: null,
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
  academic: null,
  employment: null,
};

describe("adminAssociateDataSchema", () => {
  it("acepta la ficha completa sin académico ni laboral", () => {
    expect(adminAssociateDataSchema.safeParse(base).success).toBe(true);
  });

  it("acepta formación académica y datos laborales", () => {
    const result = adminAssociateDataSchema.safeParse({
      ...base,
      academic: {
        studyLevel: "BACHELOR",
        degreeId: 1,
        universityId: 2,
        specialtyId: 3,
        degreeTitle: null,
        professionalAssociation: "CIP",
        licenseNumber: "12345",
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
        workingAddress: "Av. Trabajo 456",
        workPhone: "988888888",
        workExtension: "12",
        workEmail: "ana@empresa.com",
      },
    });
    expect(result.success).toBe(true);
  });

  it("acepta situación laboral sin actividad", () => {
    const result = adminAssociateDataSchema.safeParse({
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
    expect(result.success).toBe(true);
  });

  it("rechaza tipos de documento o nivel de estudio inválidos", () => {
    expect(adminAssociateDataSchema.safeParse({ ...base, identity: { ...base.identity, documentType: "RUC" } }).success).toBe(false);
    expect(adminAssociateDataSchema.safeParse({
      ...base,
      academic: { studyLevel: "POSTDOC", degreeId: null, universityId: null, specialtyId: null, degreeTitle: null, professionalAssociation: null, licenseNumber: null, graduationYear: null, termOrSemester: null },
    }).success).toBe(false);
  });
});
