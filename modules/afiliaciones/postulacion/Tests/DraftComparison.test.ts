import { describe, expect, it } from "vitest";
import { findUnauthorizedChange, normalizeForComparison } from "../DraftComparison";

/**
 * Borrador Legacy real de un estudiante (equivalente a LEGACY-8109):
 * especialidad histórica "Ingeniería de Metalurgia y Materiales" (specialtyId
 * 575) con `employmentInformation` en `null` (no normalizada).
 */
function legacyStudentDraft(): Record<string, unknown> {
  return {
    endorsements: {
      firstEndorsement: null,
      secondEndorsement: null,
      declarationAccepted: true,
      declarationDocumentId: null,
    },
    membershipType: "STUDENT",
    academicStudies: [
      {
        specialty: "Ingeniería de Metalurgia y Materiales",
        degreeTitle: null,
        specialtyId: 575,
        admissionYear: 2022,
        institutionId: 11,
        graduationYear: null,
        termOrSemester: null,
        otherInstitution: null,
        registrationNumber: null,
        professionalAssociation: null,
      },
    ],
    personalInformation: {
      names: "Nombre",
      phone: "999999999",
      gender: "MALE",
      address: "Av. Siempre Viva",
      birthDate: "1990-01-01",
      countryId: 1,
      districtId: 1493,
      provinceId: 104,
      departmentId: 12,
      documentType: "DNI",
      primaryEmail: "a@b.com",
      documentNumber: "12345678",
      fatherLastName: "Perez",
      motherLastName: "Gomez",
      secondaryEmail: null,
      identityVerified: false,
    },
    employmentInformation: {
      area: null,
      companyId: null,
      workEmail: null,
      workPhone: null,
      positionId: null,
      companyName: null,
      isUnemployed: true,
      positionName: null,
      workExtension: null,
      workingAddress: null,
    },
  };
}

function withUniversityLetter(draft: Record<string, unknown>, value: unknown): Record<string, unknown> {
  return {
    ...draft,
    academicStudies: [
      {
        ...(draft.academicStudies as unknown[])[0] as Record<string, unknown>,
        universityLetter: value,
      },
    ],
  };
}

const OBSERVED = new Set<string>(["academicStudies.0.universityLetter"]);

describe("normalizeForComparison", () => {
  it("trata null, undefined y cadena vacía como equivalentes", () => {
    expect(normalizeForComparison(null)).toBe(normalizeForComparison(""));
    expect(normalizeForComparison(undefined)).toBe(normalizeForComparison(null));
    expect(normalizeForComparison({ a: null })).toEqual(normalizeForComparison({ a: "" }));
    expect(normalizeForComparison({ a: undefined })).toEqual(normalizeForComparison({ a: null }));
  });

  it("trata clave vacía y clave ausente como equivalentes", () => {
    expect(normalizeForComparison({ a: null })).toEqual(normalizeForComparison({}));
    expect(normalizeForComparison({ a: null, b: 1 })).toEqual(normalizeForComparison({ b: 1 }));
  });

  it("conserva valores reales distintos", () => {
    expect(normalizeForComparison("algo")).not.toEqual(normalizeForComparison(null));
    expect(normalizeForComparison(575)).not.toEqual(normalizeForComparison(600));
    expect(normalizeForComparison(true)).not.toEqual(normalizeForComparison(false));
  });
});

describe("findUnauthorizedChange — subsanación documental de un estudiante Legacy", () => {
  it("permite reemplazar la carta universitaria observada", () => {
    const current = legacyStudentDraft();
    const proposed = withUniversityLetter(current, { url: "https://x/carta.pdf", name: "carta.pdf", type: "application/pdf" });
    expect(findUnauthorizedChange(current, proposed, OBSERVED)).toBeNull();
  });

  it("permite el reemplazo aunque el documento previo no existía", () => {
    const current = legacyStudentDraft();
    const proposed = withUniversityLetter(current, { url: "u", name: "n", type: "t" });
    expect(findUnauthorizedChange(current, proposed, OBSERVED)).toBeNull();
  });

  it("no considera cambios los campos académicos históricos sin modificar", () => {
    const current = legacyStudentDraft();
    // specialtyId/specialty/termOrSemester permanecen idénticos.
    const proposed = withUniversityLetter(current, { url: "u", name: "n", type: "t" });
    expect(findUnauthorizedChange(current, proposed, OBSERVED)).toBeNull();
  });

  it("tolera diferencias de normalización (null vs vacío) que no son cambios reales", () => {
    const current = legacyStudentDraft();
    const proposed = {
      ...withUniversityLetter(current, { url: "u", name: "n", type: "t" }),
      employmentInformation: {
        ...(current.employmentInformation as Record<string, unknown>),
        area: "",
        companyName: "",
        workEmail: "",
        workPhone: "",
        workingAddress: "",
      },
    };
    expect(findUnauthorizedChange(current, proposed, OBSERVED)).toBeNull();
  });

  it("tolera claves vacías que se omiten o normalizan sin representar cambios", () => {
    const current = legacyStudentDraft();
    const proposed = {
      ...withUniversityLetter(current, { url: "u", name: "n", type: "t" }),
      employmentInformation: {
        isUnemployed: true,
        positionName: "",
        workExtension: "",
      },
    };
    expect(findUnauthorizedChange(current, proposed, OBSERVED)).toBeNull();
  });

  it("rechaza modificar specialtyId sin autorización", () => {
    const current = legacyStudentDraft();
    const proposed = withUniversityLetter(
      {
        ...current,
        academicStudies: [
          { ...(current.academicStudies as unknown[])[0] as Record<string, unknown>, specialtyId: 600 },
        ],
      },
      { url: "u", name: "n", type: "t" },
    );
    expect(findUnauthorizedChange(current, proposed, OBSERVED)?.path).toBe("academicStudies.0.specialtyId");
  });

  it("rechaza modificar specialty (nombre) sin autorización", () => {
    const current = legacyStudentDraft();
    const proposed = withUniversityLetter(
      {
        ...current,
        academicStudies: [
          { ...(current.academicStudies as unknown[])[0] as Record<string, unknown>, specialty: "Derecho" },
        ],
      },
      { url: "u", name: "n", type: "t" },
    );
    expect(findUnauthorizedChange(current, proposed, OBSERVED)?.path).toBe("academicStudies.0.specialty");
  });

  it("rechaza modificar otros campos no observados", () => {
    const current = legacyStudentDraft();
    const proposed = withUniversityLetter(
      {
        ...current,
        personalInformation: {
          ...(current.personalInformation as Record<string, unknown>),
          names: "Otro Nombre",
        },
      },
      { url: "u", name: "n", type: "t" },
    );
    expect(findUnauthorizedChange(current, proposed, OBSERVED)?.path).toBe("personalInformation.names");
  });

  it("rechaza añadir un campo de estudios no observado", () => {
    const current = legacyStudentDraft();
    const proposed = withUniversityLetter(
      {
        ...current,
        academicStudies: [
          { ...(current.academicStudies as unknown[])[0] as Record<string, unknown>, cycle: 7 },
        ],
      },
      { url: "u", name: "n", type: "t" },
    );
    expect(findUnauthorizedChange(current, proposed, OBSERVED)?.path).toBe("academicStudies.0.cycle");
  });
});

describe("findUnauthorizedChange — regresión de postulaciones nuevas", () => {
  it("rechaza cambios en campos no observados (mismo comportamiento que antes)", () => {
    const current = { personalInformation: { phone: "999999999" }, academicStudies: [] };
    const proposed = { personalInformation: { phone: "888888888" }, academicStudies: [] };
    expect(findUnauthorizedChange(current, proposed, OBSERVED)?.path).toBe("personalInformation.phone");
  });

  it("no marca diferencias cuando el borrador no cambia", () => {
    const current = legacyStudentDraft();
    expect(findUnauthorizedChange(current, current, OBSERVED)).toBeNull();
  });
});
