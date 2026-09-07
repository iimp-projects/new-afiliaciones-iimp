import { prisma } from "../../../lib/prisma";
import { seedLogger } from "../../../lib/seed";
import { SYSTEM_SETTING_DEFINITIONS, SYSTEM_SETTING_KEYS } from "../../../modules/security/system-settings/Models/SystemSettingKeys";

export async function seedSystemSettings(database: Pick<typeof prisma, "systemSetting"> = prisma): Promise<void> {
  const definitions = Object.entries(SYSTEM_SETTING_KEYS);
  for (const [, key] of definitions) {
    const definition = SYSTEM_SETTING_DEFINITIONS[key];
    await database.systemSetting.upsert({
      where: { key },
      update: {},
      create: {
        key,
        category: definition.category,
        dataType: definition.dataType,
        description: definition.description,
        isActive: true,
      },
    });
  }
  seedLogger.success(`  -> ${definitions.length} definiciones de System Settings procesadas.`);
}
