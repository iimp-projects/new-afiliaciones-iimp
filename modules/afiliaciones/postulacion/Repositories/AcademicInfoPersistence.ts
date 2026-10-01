import { Prisma } from "@prisma/client";
import { ApplicationDraft } from "../Models/ApplicationDraft";

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
