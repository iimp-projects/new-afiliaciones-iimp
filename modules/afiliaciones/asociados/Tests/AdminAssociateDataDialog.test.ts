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

  it("prioriza los datos capturados en el borrador de postulación", () => {
    const initial = buildAdminAssociateDataInitial({
      ...user,
      draftData: {
        personalInformation: {
          names: "Ana María",
          fatherLastName: "Pérez",
          motherLastName: "Soto",
          documentType: "CE",
          documentNumber: "123456789",
          birthDate: "1991-02-03",
          gender: "FEMALE",
          phone: "911111111",
          primaryEmail: "ana.postulacion@example.com",
          secondaryEmail: "",
          countryId: 2,
          departmentId: null,
          provinceId: null,
          districtId: null,
          address: "Av. Borrador 789",
          postalCode: "20000",
          foreignRegion: "Lima",
          foreignCity: "Lima",
        },
        academicStudies: [{
          degreeId: 9,
          specialtyId: 8,
          institutionId: 7,
          degreeTitle: "Bachiller",
          specialty: "Ingeniería",
          professionalAssociation: "CIP",
          registrationNumber: "98765",
          graduationYear: 2018,
          cycle: 8,
        }],
        employmentInformation: {
          employmentStatus: "SELF_EMPLOYED",
          companyTaxId: "20123456789",
          companyName: "Consultora Demo",
          positionName: "Consultor",
          area: "Proyectos",
          workingAddress: "Av. Trabajo 100",
          workPhone: "922222222",
          workEmail: "consultor@example.com",
        },
      },
    });
    expect(initial.identity.firstName).toBe("Ana María");
    expect(initial.identity.maternalLastName).toBe("Soto");
    expect(initial.identity.documentType).toBe("CE");
    expect(initial.contact.primaryEmail).toBe("ana.postulacion@example.com");
    expect(initial.address.countryId).toBe(2);
    expect(initial.academic?.universityId).toBe(7);
    expect(initial.academic?.licenseNumber).toBe("98765");
    expect(initial.academic?.termOrSemester).toBe("8");
    expect(initial.employment?.employmentStatus).toBe("SELF_EMPLOYED");
    expect(initial.employment?.companyTaxId).toBe("20123456789");
    expect(initial.employment?.companyName).toBe("Consultora Demo");
    expect(initial.employment?.positionName).toBe("Consultor");
  });

  it("reconoce estudiantes por rol o por tipo de afiliación", () => {
    expect(isStudentAssociate(user)).toBe(false);
    expect(isStudentAssociate({ ...user, role: { slug: "ASOCIADO_ESTUDIANTE" } })).toBe(true);
    expect(isStudentAssociate({ ...user, role: { slug: "OTRO" }, person: { ...user.person, applications: [{ status: "COMPLETED", affiliateType: "STUDENT" }] } })).toBe(true);
  });
});
