import type { Prisma } from "@prisma/client";

export const specialtyCategoriesData: Prisma.SpecialtyCategoryCreateManyInput[] = [
  { name: "Ingeniería", isActive: true },
  { name: "Minería", isActive: true },
  { name: "Geología", isActive: true },
  { name: "Metalurgia", isActive: true },
  { name: "Ambiental", isActive: true },
  { name: "Sistemas", isActive: true },
  { name: "Administración", isActive: true },
  { name: "Economía", isActive: true },
  { name: "Derecho", isActive: true },
  { name: "Investigación", isActive: true },
];
