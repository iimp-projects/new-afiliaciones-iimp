import { describe, expect, it, vi } from "vitest";
import { assertStudentAcademicAllowed, persistAcademicInfos } from "../Repositories/AcademicInfoPersistence";
import { UpdateDraftService } from "../Services/UpdateDraftService";
import { UpdateDraftDTO } from "../DTOs/update-draft.dto";

function transaction() {
  return {
    academicInfo: {
      deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
      create: vi.fn().mockResolvedValue({ id: 1 }),
    },
    academicDegree: {
      findUnique: vi.fn().mockResolvedValue({ studyLevel: "BACHELOR", isActive: true }),
    },
    specialty: {
      findUnique: vi.fn().mockResolvedValue({ code: "ESP-GEO" }),
    },
    university: {
      findUnique: vi.fn().mockResolvedValue({ name: "Universidad Nacional de Ingeniería" }),
    },
  };
}

const fullStudy = {
  institutionId: 5,
  degreeId: 3,
  specialtyId: 2,
  degreeTitle: "Ingeniero de Minas",
  professionalAssociation: "CIP",
  registrationNumber: "123456",
  graduationYear: 2020,
};

const draftWith = (study: Record<string, unknown>) => ({ academicStudies: [study] });

describe("persistAcademicInfos — sincronización academic_info", () => {
  it("Caso 1: estudiante con cycle=7 persiste termOrSemester='7'", async () => {
    const tx = transaction();
    await persistAcademicInfos(tx as never, 42, draftWith({ ...fullStudy, cycle: 7 }), "STUDENT");

    expect(tx.academicInfo.deleteMany).toHaveBeenCalledWith({ where: { personId: 42 } });
    expect(tx.academicInfo.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ termOrSemester: "7" }) }),
    );
  });

  it("Caso 2: subsanación cycle 7 → 8 persiste termOrSemester='8'", async () => {
    const tx = transaction();
    await persistAcademicInfos(tx as never, 42, draftWith({ ...fullStudy, cycle: 8 }), "STUDENT");

    expect(tx.academicInfo.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ termOrSemester: "8" }) }),
    );
  });

  it("Caso 3: subsanación de otro campo académico no corrompe ni elimina cycle", async () => {
    const tx = transaction();
    await persistAcademicInfos(
      tx as never,
      42,
      draftWith({ ...fullStudy, cycle: 7, degreeTitle: "Magíster en Gestión Minera" }),
      "STUDENT",
    );

    expect(tx.academicInfo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          termOrSemester: "7",
          degreeTitle: "Magíster en Gestión Minera",
          universityId: 5,
          specialtyId: 2,
          professionalAssociation: "CIP",
          licenseNumber: "123456",
          graduationYear: 2020,
        }),
      }),
    );
  });

  it("Caso 4: Asociado Activo no persiste termOrSemester como ciclo", async () => {
    const tx = transaction();
    await persistAcademicInfos(tx as never, 42, draftWith({ ...fullStudy, cycle: 9 }), "ACTIVE");

    expect(tx.academicInfo.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ termOrSemester: null }) }),
    );
  });

  it("usa la estrategia delete/create (reemplazo completo) sin dejar valores anteriores", async () => {
    const tx = transaction();
    await persistAcademicInfos(tx as never, 42, draftWith({ ...fullStudy, cycle: 10 }), "STUDENT");

    expect(tx.academicInfo.deleteMany).toHaveBeenCalledTimes(1);
    expect(tx.academicInfo.create).toHaveBeenCalledTimes(1);
  });

  it("no escribe academic_info cuando no hay estudios académicos", async () => {
    const tx = transaction();
    await persistAcademicInfos(tx as never, 42, { academicStudies: [] }, "STUDENT");

    expect(tx.academicInfo.deleteMany).not.toHaveBeenCalled();
    expect(tx.academicInfo.create).not.toHaveBeenCalled();
  });

  it("rechaza un grado académico inactivo antes de crear el registro", async () => {
    const tx = transaction();
    tx.academicDegree.findUnique.mockResolvedValue({ studyLevel: "BACHELOR", isActive: false });

    await expect(
      persistAcademicInfos(tx as never, 42, draftWith({ ...fullStudy, cycle: 7 }), "STUDENT"),
    ).rejects.toThrow("El grado académico seleccionado no está disponible.");
    expect(tx.academicInfo.create).not.toHaveBeenCalled();
  });
});

describe("validateAcademicSync — validación académica en subsanación (Estudiante)", () => {
  const fullStudentStudy = {
    institutionId: 5,
    specialtyId: 2,
    specialty: "",
    degreeTitle: "",
    admissionYear: 2020,
    cycle: 7,
    universityLetter: { name: "constancia.pdf", type: "application/pdf", url: "http://x" },
    studentTermsAccepted: true,
  };

  const validate = (draftData: unknown, affiliateType = "STUDENT") =>
    (
      new UpdateDraftService({} as never) as unknown as {
        validateAcademicSync(dto: UpdateDraftDTO, application: { affiliateType: string }): void;
      }
    ).validateAcademicSync({ draftData } as unknown as UpdateDraftDTO, { affiliateType } as never);

  it("acepta especialidad + ciclo + año de ingreso válidos", () => {
    expect(() => validate(draftWith(fullStudentStudy))).not.toThrow();
  });

  it.each([7, 8, 9, 10])("acepta el ciclo válido %i", (cycle) => {
    expect(() => validate(draftWith({ ...fullStudentStudy, cycle }))).not.toThrow();
  });

  it.each([6, 11, 1.5, "8"])("rechaza el ciclo inválido %s", (cycle) => {
    expect(() => validate(draftWith({ ...fullStudentStudy, cycle }))).toThrow();
  });

  it("rechaza especialidad vacía", () => {
    expect(() => validate(draftWith({ ...fullStudentStudy, specialtyId: undefined, specialty: "" }))).toThrow();
  });

  it("rechaza ciclo vacío", () => {
    expect(() => validate(draftWith({ ...fullStudentStudy, cycle: undefined }))).toThrow();
  });

  it("rechaza año de ingreso vacío", () => {
    expect(() => validate(draftWith({ ...fullStudentStudy, admissionYear: undefined }))).toThrow();
  });

  it("rechaza año de ingreso inválido (futuro)", () => {
    const futureYear = new Date().getFullYear() + 1;
    expect(() => validate(draftWith({ ...fullStudentStudy, admissionYear: futureYear }))).toThrow();
  });

  it("no valida para Asociado Activo", () => {
    expect(() => validate(draftWith({ ...fullStudy, cycle: 6 }), "ACTIVE")).not.toThrow();
  });

  it("no falla cuando no hay estudios académicos", () => {
    expect(() => validate({ academicStudies: [] })).not.toThrow();
  });
});

describe("assertStudentAcademicAllowed — catálogo Estudiante (backend)", () => {
  const catalogDb = (overrides: { specialtyCode?: string | null; universityName?: string | null }) => ({
    specialty: {
      findUnique: vi.fn().mockResolvedValue(
        overrides.specialtyCode === undefined ? { code: "ESP-MIN" } : overrides.specialtyCode === null ? null : { code: overrides.specialtyCode },
      ),
    },
    university: {
      findUnique: vi.fn().mockResolvedValue(
        overrides.universityName === undefined ? { name: "Universidad Nacional de Ingeniería" } : overrides.universityName === null ? null : { name: overrides.universityName },
      ),
    },
  });

  const study = (patch: Record<string, unknown>) => ({
    institutionId: 2,
    specialtyId: 1,
    ...patch,
  });

  it.each(["ESP-MIN", "ESP-GEO", "ESP-MET"])("acepta la especialidad canónica %s", async (code) => {
    await expect(assertStudentAcademicAllowed(catalogDb({ specialtyCode: code }) as never, study({}) as never)).resolves.toBeUndefined();
  });

  it("rechaza una especialidad distinta de las tres permitidas", async () => {
    await expect(assertStudentAcademicAllowed(catalogDb({ specialtyCode: "ESP-CIVIL" }) as never, study({}) as never)).rejects.toThrow("especialidad");
  });

  it("rechaza una especialidad inexistente", async () => {
    await expect(assertStudentAcademicAllowed(catalogDb({ specialtyCode: null }) as never, study({}) as never)).rejects.toThrow("especialidad");
  });

  it("acepta una universidad válida", async () => {
    await expect(assertStudentAcademicAllowed(catalogDb({ universityName: "Pontificia Universidad Católica del Perú" }) as never, study({}) as never)).resolves.toBeUndefined();
  });

  it.each(["SENATI", "TECSUP", "CIBERTEC", "Instituto Superior Tecnológico Público Espinar", "IESTP República Federal de Alemania"])(
    "rechaza la institución no universitaria %s",
    async (name) => {
      await expect(assertStudentAcademicAllowed(catalogDb({ universityName: name }) as never, study({}) as never)).rejects.toThrow("institución");
    },
  );

  it("rechaza la institución libre (Otra) cuando no es una universidad", async () => {
    await expect(
      assertStudentAcademicAllowed(catalogDb({}) as never, study({ institutionId: 0, otherInstitution: "SENATI" }) as never),
    ).rejects.toThrow("institución");
  });

  it("acepta la institución libre (Otra) cuando es una universidad", async () => {
    await expect(
      assertStudentAcademicAllowed(catalogDb({}) as never, study({ institutionId: 0, otherInstitution: "Universidad Nacional de Ingeniería" }) as never),
    ).resolves.toBeUndefined();
  });
});

describe("persistAcademicInfos — catálogo Estudiante en la persistencia", () => {
  it("rechaza especialidad no permitida antes de crear academic_info", async () => {
    const tx = transaction();
    tx.specialty.findUnique.mockResolvedValue({ code: "ESP-CIVIL" });

    await expect(
      persistAcademicInfos(tx as never, 42, { academicStudies: [{ ...fullStudy, cycle: 7 }] }, "STUDENT"),
    ).rejects.toThrow("especialidad");
    expect(tx.academicInfo.create).not.toHaveBeenCalled();
  });

  it("rechaza institución no universitaria (SENATI) antes de crear academic_info", async () => {
    const tx = transaction();
    tx.university.findUnique.mockResolvedValue({ name: "SENATI" });

    await expect(
      persistAcademicInfos(tx as never, 42, { academicStudies: [{ ...fullStudy, cycle: 7 }] }, "STUDENT"),
    ).rejects.toThrow("institución");
    expect(tx.academicInfo.create).not.toHaveBeenCalled();
  });

  it("Asociado Activo no aplica las restricciones de Estudiante", async () => {
    const tx = transaction();
    tx.specialty.findUnique.mockResolvedValue({ code: "ESP-CIVIL" });
    tx.university.findUnique.mockResolvedValue({ name: "SENATI" });

    await expect(
      persistAcademicInfos(tx as never, 42, { academicStudies: [{ ...fullStudy }] }, "ACTIVE"),
    ).resolves.toBeUndefined();
    expect(tx.specialty.findUnique).not.toHaveBeenCalled();
    expect(tx.university.findUnique).not.toHaveBeenCalled();
    expect(tx.academicInfo.create).toHaveBeenCalledTimes(1);
  });
});
