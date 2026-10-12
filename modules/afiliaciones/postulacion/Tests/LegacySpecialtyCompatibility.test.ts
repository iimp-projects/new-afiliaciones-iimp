import { describe, expect, it, vi } from "vitest";
import {
  isLegacyStudentAllowedSpecialty,
  isLegacyTrackingCode,
  isStudentAllowedSpecialtyCode,
} from "../StudentAcademicRules";
import {
  assertStudentAcademicAllowed,
  persistAcademicInfos,
} from "../Repositories/AcademicInfoPersistence";
import { UpdateDraftService } from "../Services/UpdateDraftService";
import { UpdateDraftDTO } from "../DTOs/update-draft.dto";

describe("isLegacyTrackingCode — identificación de postulaciones migradas", () => {
  it.each(["LEGACY-8109", "LEGACY-1", "LEGACY-42"])("reconoce %s como migrada", (code) => {
    expect(isLegacyTrackingCode(code)).toBe(true);
  });

  it.each([
    "3f1c9e6a-1b2c-4d5e-8f90-abcdef123456",
    "APP-1712345678901",
    "TRK-1234-5678",
    "",
    null,
    undefined,
  ])("no reconoce %s como migrada", (code) => {
    expect(isLegacyTrackingCode(code as string | null | undefined)).toBe(false);
  });
});

describe("isLegacyStudentAllowedSpecialty — familias históricas", () => {
  it.each([
    ["ESP-MIN", "Ingeniería de Minas"],
    ["ESP-GEO", "Ingeniería Geológica"],
    ["ESP-MET", "Ingeniería Metalúrgica"],
    ["ESP-GEOL", "Geología"],
  ])("acepta el código histórico %s", (code) => {
    expect(isLegacyStudentAllowedSpecialty(code, null)).toBe(true);
  });

  it.each([
    "Ingeniería de Metalurgia y Materiales",
    "Ingeniería Metalurgia y materiales",
    "Ingeniera Metalurgia y de Materiales",
    "Metalurgia",
    "Metalurgia Extractiva",
    "Ingeniería Metalúrgica",
    "Ingeniería de Minas",
    "Minería",
    "Ingeniería Minera",
    "Ingeniería Geológica",
    "Geología",
  ])("acepta la denominación histórica %s por nombre", (name) => {
    expect(isLegacyStudentAllowedSpecialty(null, name)).toBe(true);
  });

  it.each([
    ["ESP-DER", "Derecho"],
    ["ESP-CIVIL", "Ingeniería Civil"],
    ["ESP-GEOPHYS", "Geofísica"],
    ["ESP-GEOTEC", "Geotecnia"],
    [null, "Derecho"],
    [null, "Ingeniería Civil"],
    [null, "Administración de Empresas"],
    [null, "Geofísica"],
  ])("rechaza la especialidad fuera de familias (%s, %s)", (code, name) => {
    expect(isLegacyStudentAllowedSpecialty(code, name)).toBe(false);
  });

  it("rechaza códigos y nombres vacíos o nulos", () => {
    expect(isLegacyStudentAllowedSpecialty(null, null)).toBe(false);
    expect(isLegacyStudentAllowedSpecialty(null, "")).toBe(false);
    expect(isLegacyStudentAllowedSpecialty("", "   ")).toBe(false);
  });
});

describe("isLegacyStudentAllowedSpecialty — denominaciones universitarias variadas", () => {
  it.each([
    "Ingeniería de Minas",
    "Ingeniería de Minas y Materiales",
    "Ingeniería de Minas y Resistencia de Materiales",
    "Ingeniería Minera",
    "Minería",
    "Ingeniería Metalúrgica",
    "Ingeniería de Metalurgia y Materiales",
    "Metalurgia",
    "Metalurgia Extractiva",
    "Ingeniería Geológica",
    "Geología",
    "Geología Aplicada",
  ])("acepta la denominación equivalente %s", (name) => {
    expect(isLegacyStudentAllowedSpecialty(null, name)).toBe(true);
  });

  it.each([
    "INGENIERÍA DE MINAS",
    "Ingeniería   Metalúrgica",
    "metalurgia-extractiva",
    "Ingeniería / Metalúrgica",
    "  Geología Aplicada  ",
    "ING. de Minas",
    "Ing. Metalúrgica",
    "Ingeniería, de Minas.",
  ])("normaliza mayúsculas, tildes, espacios y signos en %s", (name) => {
    expect(isLegacyStudentAllowedSpecialty(null, name)).toBe(true);
  });

  it.each([
    "Ingeniería Civil en Metalurgia",
    "Derecho Minero",
    "Administración de Empresas Mineras",
    "Economía Minera",
    "Ingeniería Industrial Minera",
    "Ingeniería Ambiental y Minas",
    "Seguridad Minera",
    "Ingeniería de Petróleo y Minas",
    "Geología de Petróleo",
    "Mineralogía",
  ])("rechaza la carrera principal no relacionada %s", (name) => {
    expect(isLegacyStudentAllowedSpecialty(null, name)).toBe(false);
  });

  it("rechaza abreviaturas ambiguas sin raíz de familia verificable", () => {
    expect(isLegacyStudentAllowedSpecialty(null, "Geol. Aplicada")).toBe(false);
    expect(isLegacyStudentAllowedSpecialty(null, "Min.")).toBe(false);
  });
});

describe("reglas de postulaciones nuevas (sin compatibilidad)", () => {
  it.each(["ESP-MIN", "ESP-GEO", "ESP-MET"])("permite la especialidad canónica %s", (code) => {
    expect(isStudentAllowedSpecialtyCode(code)).toBe(true);
  });

  it.each(["ESP-GEOL", "ESP-GEOPHYS", "ESP-GEOTEC", "ESP-CIVIL", "ESP-DER"])(
    "rechaza la especialidad no canónica %s en postulaciones nuevas",
    (code) => {
      expect(isStudentAllowedSpecialtyCode(code)).toBe(false);
    },
  );
});

describe("assertStudentAcademicAllowed — compatibilidad Legacy vs. nuevas", () => {
  const catalogDb = (overrides: { code?: string | null; name?: string | null; universityName?: string | null }) => ({
    specialty: {
      findUnique: vi.fn().mockResolvedValue(
        overrides.code === undefined && overrides.name === undefined
          ? { code: "ESP-MIN", name: "Ingeniería de Minas" }
          : overrides.code === null && overrides.name === null
            ? null
            : { code: overrides.code ?? null, name: overrides.name ?? null },
      ),
    },
    university: {
      findUnique: vi.fn().mockResolvedValue({ name: overrides.universityName ?? "Universidad Nacional de Ingeniería" }),
    },
  });

  const study = (patch: Record<string, unknown> = {}) => ({ specialtyId: 575, ...patch });

  it("Legacy: conserva Ingeniería de Metalurgia y Materiales (code null, por nombre)", async () => {
    await expect(
      assertStudentAcademicAllowed(
        catalogDb({ code: null, name: "Ingeniería de Metalurgia y Materiales" }) as never,
        study() as never,
        { allowLegacySpecialtyFamily: true },
      ),
    ).resolves.toBeUndefined();
  });

  it("Legacy: conserva Ingeniería de Minas por código", async () => {
    await expect(
      assertStudentAcademicAllowed(
        catalogDb({ code: "ESP-MIN", name: "Ingeniería de Minas" }) as never,
        study() as never,
        { allowLegacySpecialtyFamily: true },
      ),
    ).resolves.toBeUndefined();
  });

  it("Legacy: conserva Geología por nombre (code null)", async () => {
    await expect(
      assertStudentAcademicAllowed(
        catalogDb({ code: null, name: "Geología" }) as never,
        study() as never,
        { allowLegacySpecialtyFamily: true },
      ),
    ).resolves.toBeUndefined();
  });

  it("Legacy: rechaza especialidad fuera de las familias (Derecho)", async () => {
    await expect(
      assertStudentAcademicAllowed(
        catalogDb({ code: null, name: "Derecho" }) as never,
        study() as never,
        { allowLegacySpecialtyFamily: true },
      ),
    ).rejects.toThrow("especialidad");
  });

  it("Nueva: rechaza una especialidad histórica con código no canónico", async () => {
    await expect(
      assertStudentAcademicAllowed(
        catalogDb({ code: "ESP-METAL", name: "Ingeniería Metalúrgica" }) as never,
        study() as never,
      ),
    ).rejects.toThrow("especialidad");
  });

  it("Nueva: acepta la especialidad canónica", async () => {
    await expect(
      assertStudentAcademicAllowed(
        catalogDb({ code: "ESP-MET", name: "Ingeniería Metalúrgica" }) as never,
        study() as never,
      ),
    ).resolves.toBeUndefined();
  });
});

describe("persistAcademicInfos — no bloquea documentos de postulaciones Legacy", () => {
  function legacyTransaction(specialtyCode: string | null, specialtyName: string | null) {
    return {
      academicInfo: { deleteMany: vi.fn().mockResolvedValue({ count: 1 }), create: vi.fn().mockResolvedValue({ id: 1 }) },
      academicDegree: { findUnique: vi.fn().mockResolvedValue({ studyLevel: "BACHELOR", isActive: true }) },
      specialty: { findUnique: vi.fn().mockResolvedValue({ code: specialtyCode, name: specialtyName }) },
      university: { findUnique: vi.fn().mockResolvedValue({ name: "Universidad Nacional de Ingeniería" }) },
    };
  }

  const legacyStudy = {
    institutionId: 5,
    specialtyId: 575,
    degreeTitle: "Ingeniero de Minas",
    admissionYear: 2022,
  };

  it("persiste el documento universitario de LEGACY-8109 sin alterar la especialidad histórica", async () => {
    const tx = legacyTransaction(null, "Ingeniería de Metalurgia y Materiales");
    await persistAcademicInfos(tx as never, 42, { academicStudies: [legacyStudy] }, "STUDENT", {
      allowLegacySpecialtyFamily: true,
    });

    expect(tx.academicInfo.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ specialtyId: 575 }) }),
    );
  });

  it("postulación nueva sigue rechazando una especialidad histórica antes de persistir", async () => {
    const tx = legacyTransaction(null, "Ingeniería de Metalurgia y Materiales");
    await expect(
      persistAcademicInfos(tx as never, 42, { academicStudies: [legacyStudy] }, "STUDENT"),
    ).rejects.toThrow("especialidad");
    expect(tx.academicInfo.create).not.toHaveBeenCalled();
  });
});

describe("validateAcademicSync — subsanación exclusivamente documental", () => {
  const fullStudy = {
    institutionId: 5,
    specialtyId: 575,
    specialty: "Ingeniería de Metalurgia y Materiales",
    degreeTitle: "",
    admissionYear: 2022,
    cycle: 7,
    universityLetter: { name: "constancia.pdf", type: "application/pdf", url: "http://x" },
    studentTermsAccepted: true,
  };

  const validate = (draftData: unknown, application: { affiliateType: string; trackingCode: string }) =>
    (
      new UpdateDraftService({} as never) as unknown as {
        validateAcademicSync(dto: UpdateDraftDTO, application: { affiliateType: string; trackingCode: string }, isLegacy: boolean): void;
      }
    ).validateAcademicSync({ draftData } as unknown as UpdateDraftDTO, application, isLegacyTrackingCode(application.trackingCode));

  it("Legacy: una subsanación documental no revalida la formación académica incompleta", () => {
    expect(() =>
      validate(
        { academicStudies: [{ ...fullStudy, cycle: undefined, universityLetter: undefined, studentTermsAccepted: undefined }] },
        { affiliateType: "STUDENT", trackingCode: "LEGACY-8109" },
      ),
    ).not.toThrow();
  });

  it("Nueva: sigue exigiendo ciclo, carta y términos para estudiantes", () => {
    expect(() =>
      validate(
        { academicStudies: [{ ...fullStudy, cycle: undefined }] },
        { affiliateType: "STUDENT", trackingCode: "uuid-nueva-postulacion" },
      ),
    ).toThrow();
  });
});
