import { prisma } from "@/lib/prisma";
import { benefitsData } from "./data/benefits.data";

export async function seedBenefits() {
  for (const benefit of benefitsData) {
    await prisma.benefit.upsert({
      where: {
        slug: benefit.slug,
      },
      update: benefit,
      create: benefit,
    });
  }
}