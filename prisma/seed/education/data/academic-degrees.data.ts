import type { StudyLevel } from "@prisma/client";

export type AcademicDegreeSeed = {
  code: string;
  name: string;
  studyLevel: StudyLevel;
};

export const academicDegreesData: readonly AcademicDegreeSeed[] = [
  { code: "BACH", name: "Bachiller", studyLevel: "BACHELOR" },
  { code: "TECHNICAL", name: "Técnico", studyLevel: "TECHNICAL" },
  { code: "PROFESSIONAL_TITLE", name: "Título profesional", studyLevel: "OTHER" },
  { code: "MAG", name: "Maestría", studyLevel: "MASTER" },
  { code: "DOCTORATE", name: "Doctorado", studyLevel: "DOCTORATE" },
  { code: "OTHER", name: "Otro", studyLevel: "OTHER" },
] as const;
