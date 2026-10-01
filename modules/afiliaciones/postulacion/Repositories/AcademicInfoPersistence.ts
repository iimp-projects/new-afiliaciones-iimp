import { Prisma } from "@prisma/client";
import { ApplicationDraft } from "../Models/ApplicationDraft";
import { AcademicStudy } from "../Models/AcademicStudy";
import { ApplicationFlowError } from "../Services/Exceptions/ApplicationFlowError";
import { isLikelyUniversityName, isStudentAllowedSpecialtyCode } from "../StudentAcademicRules";

/**
 * Persistencia compartida de la formación académica de una postulación.
 *
 * Reutiliza la misma lógica para el envío inicial y la subsanación, de modo que
 * `academic_info` permanezca sincronizado con `draftData.academicStudies` sin
 * duplicar la implementación en dos servicios.
 */
export async function persistAcademicInfos(
  tx: Prisma.TransactionClient,
  personId: number,
  draftData: unknown,
  affiliateType: string,
): Promise<void> {
  if (!draftData) {
    return;
  }

  const draft = draftData as unknown as ApplicationDraft;

  if (!draft.academicStudies?.length) {
    return;
  }

  await tx.academicInfo.deleteMany({
    where: {
      personId,
    },
  });

  for (const study of draft.academicStudies) {
    const degree = study.degreeId
      ? await tx.academicDegree.findUnique({
          where: { id: study.degreeId },
          select: { studyLevel: true, isActive: true },
        })
      : null;
    if (study.degreeId && (!degree || !degree.isActive)) {
      throw new Error("El grado académico seleccionado no está disponible.");
    }

    if (affiliateType === "STUDENT") {
      await assertStudentAcademicAllowed(tx, study);
    }

    await tx.academicInfo.create({
      data: {
        personId,
        studyLevel: degree?.studyLevel ?? "OTHER",
        degreeId: study.degreeId ?? null,
        universityId:
          study.institutionId && study.institutionId > 0
            ? study.institutionId
            : null,
        specialtyId: study.specialtyId ?? null,
        degreeTitle: study.degreeTitle,
        professionalAssociation: study.professionalAssociation ?? null,
        licenseNumber: study.registrationNumber ?? null,
        graduationYear: study.graduationYear ?? null,
        termOrSemester:
          affiliateType === "STUDENT" && study.cycle != null
            ? String(study.cycle)
            : null,
      },
    });
  }
}

type AcademicCatalogDb = Pick<Prisma.TransactionClient, "specialty" | "university">;

/**
 * Valida en backend las restricciones de catálogo del flujo ESTUDIANTE:
 *
 *  - La especialidad debe corresponder a uno de los tres códigos canónicos
 *    (ESP-MIN, ESP-GEO, ESP-MET), identificados por `code` y no por `is_active`.
 *  - La institución debe pasar el filtro provisional de universidad (nombre).
 *
 * Se comparte entre el envío inicial y la subsanación, resolviendo los IDs
 * contra la base de datos para que la restricción no dependa del frontend.
 */
export async function assertStudentAcademicAllowed(
  db: AcademicCatalogDb,
  study: AcademicStudy,
): Promise<void> {
  if (study.specialtyId) {
    const specialty = await db.specialty.findUnique({
      where: { id: study.specialtyId },
      select: { code: true },
    });
    if (!specialty || !isStudentAllowedSpecialtyCode(specialty.code)) {
      throw new ApplicationFlowError(
        "INVALID_INPUT",
        "La especialidad seleccionada no está permitida para la modalidad Estudiante.",
        422,
      );
    }
  }

  if (study.institutionId && study.institutionId > 0) {
    const university = await db.university.findUnique({
      where: { id: study.institutionId },
      select: { name: true },
    });
    if (!university || !isLikelyUniversityName(university.name)) {
      throw new ApplicationFlowError(
        "INVALID_INPUT",
        "La institución seleccionada no es una universidad permitida.",
        422,
      );
    }
  } else if (study.otherInstitution) {
    if (!isLikelyUniversityName(study.otherInstitution)) {
      throw new ApplicationFlowError(
        "INVALID_INPUT",
        "La institución indicada no es una universidad permitida.",
        422,
      );
    }
  }
}
