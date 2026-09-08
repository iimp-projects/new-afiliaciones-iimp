import type { Prisma } from "@prisma/client";

export const academicDegreesData: Prisma.AcademicDegreeCreateManyInput[] = [
  { code: "BACH", name: "Bachiller", isActive: true, studyLevel: "BACHELOR" },
  { code: "TIT", name: "Título Profesional", isActive: true, studyLevel: "BACHELOR" },
  { code: "LIC", name: "Licenciado", isActive: true, studyLevel: "BACHELOR" },
  { code: "ING", name: "Ingeniero", isActive: true, studyLevel: "BACHELOR" },
  { code: "MAG", name: "Magíster", isActive: true, studyLevel: "MASTER" },
  { code: "MBA", name: "MBA", isActive: true, studyLevel: "MASTER" },
  { code: "DOC", name: "Doctor", isActive: true, studyLevel: "DOCTORATE" },
  { code: "POST", name: "Postdoctorado", isActive: true, studyLevel: "DOCTORATE" },
  { code: "ESP", name: "Especialización", isActive: true, studyLevel: "OTHER" },
  { code: "DIP", name: "Diplomado", isActive: true, studyLevel: "OTHER" }
];