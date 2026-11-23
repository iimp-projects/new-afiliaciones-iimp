import { describe, expect, it } from "vitest";
import { buildAdminAssociateDataInitial, isStudentAssociate } from "../Components/AdminAssociateDataDialog";

const user = {
  id: 10,
  role: { slug: "ASOCIADO_ACTIVO", name: "Asociado Activo" },
  person: {
    id: 7,
    firstName: "Ana",
    paternalLastName: "Pérez",
    maternalLastName: null,
    documentType: "DNI",
    documentNumber: "12345678",
    birthDate: "1990-01-01T00:00:00.000Z",
    gender: "FEMALE",
    nationalityId: 1,
    contacts: [
      { id: 1, isPrimary: true, phoneNumber: "999999999", email: "ana@example.com" },
      { id: 2, isPrimary: false, email: "ana2@example.com" },
    ],
    addresses: [
      {
        id: 1,
        isPrimary: true,
        street: "Av. Prueba 123",
        reference: null,
        countryId: 1,
        zipCode: "15024",
        foreignRegion: null,
        foreignCity: null,
        district: { id: 5, province: { id: 6, department: { id: 7 } } },
      },
    ],
    academicInfos: [{
      studyLevel: "BACHELOR",
      degreeId: 1,
      universityId: 2,
      specialtyId: 3,
      degreeTitle: null,
      professionalAssociation: "CIP",
      licenseNumber: "123",
      graduationYear: 2015,
      termOrSemester: null,
    }],
    employmentInfos: [{
      companyId: 4,
      positionId: 5,
      area: "Operaciones",
      workingAddress: "Av. Trabajo 456",
      workPhone: "988888888",
      workExtension: "12",
      workEmail: "ana@empresa.com",
    }],
    applications: [{ status: "COMPLETED", affiliateType: "ACTIVE" }],
  },
};

describe("AdminAssociateDataDialog helpers", () => {
  it("construye el formulario desde el payload del drawer", () => {
    const initial = buildAdminAssociateDataInitial(user);
    expect(initial.identity.firstName).toBe("Ana");
    expect(initial.identity.birthDate).toBe("1990-01-01");
    expect(initial.contact.primaryEmail).toBe("ana@example.com");
    expect(initial.contact.secondaryEmail).toBe("ana2@example.com");
    expect(initial.address.districtId).toBe(5);
    expect(initial.address.departmentId).toBe(7);
    expect(initial.academic?.studyLevel).toBe("BACHELOR");
    expect(initial.employment?.companyId).toBe(4);
  });

  it("reconoce estudiantes por rol o por tipo de afiliación", () => {
    expect(isStudentAssociate(user)).toBe(false);
    expect(isStudentAssociate({ ...user, role: { slug: "ASOCIADO_ESTUDIANTE" } })).toBe(true);
    expect(isStudentAssociate({ ...user, role: { slug: "OTRO" }, person: { ...user.person, applications: [{ status: "COMPLETED", affiliateType: "STUDENT" }] } })).toBe(true);
  });
});
