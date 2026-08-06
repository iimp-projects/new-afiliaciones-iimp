import type { Prisma } from "@prisma/client";

export const specialtyCategoriesData: Prisma.SpecialtyCategoryCreateManyInput[] = [
  { code: "CAT-ENG", name: "Ingeniería", isActive: true },
  { code: "CAT-MIN", name: "Minería", isActive: true },
  { code: "CAT-GEO", name: "Geología", isActive: true },
  { code: "CAT-MET", name: "Metalurgia", isActive: true },
  { code: "CAT-AMB", name: "Ambiental", isActive: true },
  { code: "CAT-SIS", name: "Sistemas", isActive: true },
  { code: "CAT-ADM", name: "Administración", isActive: true },
  { code: "CAT-ECO", name: "Economía", isActive: true },
  { code: "CAT-DER", name: "Derecho", isActive: true },
  { code: "CAT-INV", name: "Investigación", isActive: true },
  { code: "CAT-SOC", name: "Ciencias Sociales y Humanidades", isActive: true },
  { code: "CAT-SALUD", name: "Ciencias de la Salud", isActive: true },
  { code: "CAT-EDU", name: "Educación y Pedagogía", isActive: true },
  { code: "CAT-OTH", name: "Otra Categoría", isActive: true },
];