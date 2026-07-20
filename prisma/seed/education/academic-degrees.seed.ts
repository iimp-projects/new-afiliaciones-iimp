import { PrismaClient } from "@prisma/client";
import { academicDegreesData } from "./data/academic-degrees.data";

export async function seedAcademicDegrees(prisma: PrismaClient) {
  await prisma.academicDegree.createMany({
    data: academicDegreesData,
    skipDuplicates: true,
  });
  console.log("✓ Academic Degrees seeded");
}
