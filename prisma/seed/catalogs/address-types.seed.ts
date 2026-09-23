import { prisma } from "@/lib/prisma";
import { seedLogger } from "@/lib/seed";
import { addressTypesData } from "./data/address-types.data";

export const seedAddressTypes = async (): Promise<void> => {
  seedLogger.info("  -> Ejecutando upsert de Tipos de Direccion...");

  for (const addressType of addressTypesData) {
    if (!addressType.code) {
      throw new Error("El tipo de direccion requiere un codigo.");
    }
    await prisma.addressType.upsert({
      where: { code: addressType.code },
      update: {
        name: addressType.name,
        description: addressType.description,
        isActive: addressType.isActive,
      },
      create: addressType,
    });
  }

  seedLogger.success(`  -> ${addressTypesData.length} tipos de direccion procesados correctamente.`);
};
