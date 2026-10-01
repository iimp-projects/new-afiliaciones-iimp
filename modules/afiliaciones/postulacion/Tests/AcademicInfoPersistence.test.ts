import { describe, expect, it, vi } from "vitest";
import { persistAcademicInfos } from "../Repositories/AcademicInfoPersistence";
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

describe("validateAcademicSync — validación de ciclo en subsanación", () => {
  const validate = (draftData: unknown, affiliateType = "STUDENT") =>
    (
      new UpdateDraftService({} as never) as unknown as {
        validateAcademicSync(dto: UpdateDraftDTO, application: { affiliateType: string }): void;
      }
    ).validateAcademicSync({ draftData } as unknown as UpdateDraftDTO, { affiliateType } as never);

  it.each([7, 8, 9, 10])("acepta el ciclo válido %i", (cycle) => {
    expect(() => validate(draftWith({ ...fullStudy, cycle }))).not.toThrow();
  });

  it.each([6, 11, 1.5, "8"])("rechaza el ciclo inválido %s", (cycle) => {
    expect(() => validate(draftWith({ ...fullStudy, cycle }))).toThrow();
  });

  it("no valida ciclo para Asociado Activo", () => {
    expect(() => validate(draftWith({ ...fullStudy, cycle: 6 }), "ACTIVE")).not.toThrow();
  });

  it("no falla cuando no hay estudios académicos", () => {
    expect(() => validate({ academicStudies: [] })).not.toThrow();
  });
});
