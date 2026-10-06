import "dotenv/config";
import { prisma } from "../lib/prisma";
import { seedMembershipCategories } from "../prisma/seed/catalogs/membership-categories.seed";

async function main(): Promise<void> {
  await seedMembershipCategories();
  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
