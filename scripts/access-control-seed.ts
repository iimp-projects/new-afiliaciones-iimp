import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const permissions = [
  { action: "read", subject: "access_control", description: "Consultar sedes, presencia y movimientos de control de accesos." },
  { action: "operate", subject: "access_control", description: "Validar credenciales y registrar ingresos/salidas." },
  { action: "manage", subject: "access_control", description: "Administrar sedes, puntos, políticas y operadores." },
  { action: "export", subject: "access_control", description: "Exportar reportes de control de accesos." },
] as const;

const roleMatrix: Record<string, ReadonlyArray<readonly [string, string]>> = {
  SYSTEM_ADMIN: [
    ["read", "access_control"],
    ["operate", "access_control"],
    ["manage", "access_control"],
    ["export", "access_control"],
  ],
  ATENCION_ASOCIADO: [
    ["read", "access_control"],
    ["operate", "access_control"],
  ],
  LOGISTICA: [
    ["read", "access_control"],
    ["operate", "access_control"],
  ],
  OPERACIONES: [
    ["read", "access_control"],
    ["operate", "access_control"],
  ],
  AUDITOR: [
    ["read", "access_control"],
    ["export", "access_control"],
  ],
};

async function main() {
  for (const permission of permissions) {
    await prisma.permission.upsert({
      where: { action_subject: { action: permission.action, subject: permission.subject } },
      update: { description: permission.description, isActive: true },
      create: permission,
    });
  }

  for (const [slug, list] of Object.entries(roleMatrix)) {
    const role = await prisma.role.findUnique({ where: { slug } });
    if (!role) continue;
    for (const [action, subject] of list) {
      const permission = await prisma.permission.findUnique({ where: { action_subject: { action, subject } } });
      if (!permission) continue;
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } },
        update: {},
        create: { roleId: role.id, permissionId: permission.id },
      });
    }
  }

  const site = await prisma.accessSite.upsert({
    where: { code: "SEDE_PRINCIPAL" },
    update: {},
    create: {
      code: "SEDE_PRINCIPAL",
      name: "Sede Principal IIMP",
      address: "Calle Los Canarios 155-157, La Molina, Lima",
      description: "Sede creada para pruebas locales del control de accesos.",
    },
  });

  await prisma.accessPoint.upsert({
    where: { siteId_code: { siteId: site.id, code: "RECEPCION" } },
    update: {},
    create: {
      siteId: site.id,
      code: "RECEPCION",
      name: "Recepción principal",
      movementMode: "BOTH",
    },
  });

  const policy = await prisma.accessPolicy.findFirst({ where: { siteId: site.id, isActive: true } });
  if (!policy) {
    await prisma.accessPolicy.create({
      data: {
        siteId: site.id,
        name: "Política institucional (local)",
        requireActiveMembership: true,
        requireValidCard: true,
        quotaRestrictionEnabled: false,
        allowManualLookup: true,
      },
    });
  }

  console.log("Access control local seed completed.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
