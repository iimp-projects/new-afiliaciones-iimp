import { PrismaClient } from "@prisma/client";
import { specialtyCategoriesData } from "./data/specialty-categories.data";

export async function seedSpecialtyCategories(prisma: PrismaClient) {
  await prisma.specialtyCategory.createMany({
    data: specialtyCategoriesData,
    skipDuplicates: true,
  });
  console.log("✓ Specialty Categories seeded");
}
