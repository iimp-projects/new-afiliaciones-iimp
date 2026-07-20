import { PrismaClient } from "@prisma/client";
import { specialtiesData } from "./data/specialties.data";

export async function seedSpecialties(prisma: PrismaClient) {
  console.log("🌱 Seeding Specialties...");

  await prisma.specialty.createMany({
    data: specialtiesData,
    skipDuplicates: true,
  });

  console.log(`✅ ${specialtiesData.length} especialidades registradas.`);
}