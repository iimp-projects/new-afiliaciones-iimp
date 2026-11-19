import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { permissionsData } from "../prisma/seed/auth/data/permissions.data";
import { rolePermissionsData } from "../prisma/seed/auth/data/role-permissions.data";

async function main() {
  const prisma = new PrismaClient();
  try {
    const quotaPermissions = permissionsData.filter((permission) => permission.subject === "quotas");
    for (const permission of quotaPermissions) {
      await prisma.permission.upsert({
        where: { action_subject: { action: permission.action, subject: permission.subject } },
        create: { action: permission.action, subject: permission.subject, description: permission.description },
        update: { description: permission.description, isActive: true },
      });
    }
    let links = 0;
    for (const [slug, entries] of Object.entries(rolePermissionsData)) {
      const quotaEntries = entries.filter(([, subject]) => subject === "quotas");
      if (quotaEntries.length === 0) continue;
      const role = await prisma.role.findUnique({ where: { slug } });
      if (!role) continue;
      for (const [action, subject] of quotaEntries) {
        const permission = await prisma.permission.findUnique({ where: { action_subject: { action, subject } } });
        if (!permission) continue;
        await prisma.rolePermission.upsert({
          where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } },
          create: { roleId: role.id, permissionId: permission.id },
          update: {},
        });
        links += 1;
      }
    }
    console.log(JSON.stringify({ permissions: quotaPermissions.length, roleLinks: links }, null, 1));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
