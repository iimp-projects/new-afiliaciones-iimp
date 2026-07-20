import type { Prisma } from "@prisma/client";

export const academicDegreesData: Prisma.AcademicDegreeCreateManyInput[] = [
  { name: "Bachiller", isActive: true },
  { name: "Título Profesional", isActive: true },
  { name: "Licenciado", isActive: true },
  { name: "Ingeniero", isActive: true },
  { name: "Magíster", isActive: true },
  { name: "MBA", isActive: true },
  { name: "Doctor", isActive: true },
  { name: "Postdoctorado", isActive: true },
  { name: "Especialización", isActive: true },
  { name: "Diplomado", isActive: true },
];
