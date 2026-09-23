import { PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "@/lib/prisma";
import { academicDegreesData } from "./data/academic-degrees.data";

const normalizeName = (value: string) => value
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .trim()
  .toLocaleLowerCase("es-PE");

export async function seedAcademicDegrees(prisma: PrismaClient = defaultPrisma) {
  await prisma.$transaction(async (tx) => {
    const existingDegrees = await tx.academicDegree.findMany({
      select: { id: true, code: true, name: true, isActive: true },
      orderBy: { id: "asc" },
    });

    for (const degree of academicDegreesData) {
      const existingByCode = existingDegrees.find((item) => item.code === degree.code);
      const equivalentByName = existingByCode ?? existingDegrees.find(
        (item) => normalizeName(item.name) === normalizeName(degree.name)
      );

      if (equivalentByName) {
        if (equivalentByName.code && equivalentByName.code !== degree.code) {
          throw new Error(`Academic degree code conflict for ${degree.name}.`);
        }

        if (equivalentByName.code !== degree.code || !equivalentByName.isActive) {
          await tx.academicDegree.update({
            where: { id: equivalentByName.id },
            data: { code: degree.code, isActive: true },
          });
          equivalentByName.code = degree.code;
          equivalentByName.isActive = true;
        }
        continue;
      }

      const created = await tx.academicDegree.create({
        data: { ...degree, isActive: true },
        select: { id: true, code: true, name: true, isActive: true },
      });
      existingDegrees.push(created);
    }
  });
}
