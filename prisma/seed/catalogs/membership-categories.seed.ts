import { prisma } from "@/lib/prisma";
import { seedLogger } from "@/lib/seed";
import { membershipCategoriesData } from "./data/membership-categories.data";

export const seedMembershipCategories = async (): Promise<void> => {
  seedLogger.info("  -> Ejecutando upsert de Categorías de Asociado (SIE)...");

  for (const category of membershipCategoriesData) {
    await prisma.membershipCategory.upsert({
      where: { code: category.code },
      update: {
        name: category.name,
        allowsLogin: category.allowsLogin,
        mappedAffiliateType: category.mappedAffiliateType,
        mappedRoleSlug: category.mappedRoleSlug,
        isActive: category.isActive,
      },
      create: category,
    });
  }

  seedLogger.success(`  -> ${membershipCategoriesData.length} categorías de asociado procesadas correctamente.`);
};
