import { prisma } from '@/lib/prisma';
import { seedLogger, hashSeedPassword, SEED_CONSTANTS } from '@/lib/seed';
import { usersData } from './data/users.data';
import { CredentialType, UserStatus } from '@prisma/client';

export const seedUsers = async (): Promise<void> => {
  seedLogger.info('  -> Ejecutando upsert de Usuarios (desde users.data.ts)...');

  // 1. Hashear contraseña por defecto (O(1))
  const defaultPasswordHash = await hashSeedPassword(SEED_CONSTANTS.SYSTEM.DEFAULT_PASSWORD);

  // 2. Extraer catálogo de roles para evitar consultas repetitivas (N+1)
  const existingRoles = await prisma.role.findMany({
    select: { id: true, slug: true },
  });
  const roleMap = new Map(existingRoles.map((r) => [r.slug, r.id]));

  let processedCount = 0;

  // 3. Iteración y transacciones aisladas para garantizar integridad y limpieza
  for (const data of usersData) {
    try {
      const roleId = roleMap.get(data.role);

      if (!roleId) {
        seedLogger.warn(`      [Omitido] Rol no encontrado en DB: '${data.role}' para el usuario ${data.email}`);
        continue;
      }

      await prisma.$transaction(async (tx) => {
        // 3.1 Idempotencia: Upsert de Person
        const person = await tx.person.upsert({
          where: {
            documentType_documentNumber: {
              documentType: data.person.documentType,
              documentNumber: data.person.documentNumber,
            },
          },
          update: {
            firstName: data.person.firstName,
            paternalLastName: data.person.paternalLastName,
            maternalLastName: data.person.maternalLastName,
          },
          create: {
            documentType: data.person.documentType,
            documentNumber: data.person.documentNumber,
            firstName: data.person.firstName,
            paternalLastName: data.person.paternalLastName,
            maternalLastName: data.person.maternalLastName,
          },
        });

        // 3.2 Idempotencia: Upsert de User
        const user = await tx.user.upsert({
          where: { email: data.email },
          update: {
            roleId,
            personId: person.id,
            type: data.type,
            status: UserStatus.ACTIVE,
          },
          create: {
            email: data.email,
            emailVerified: new Date(),
            status: UserStatus.ACTIVE,
            type: data.type,
            roleId,
            personId: person.id,
          },
        });

        // 3.3 Idempotencia: Credential
        const existingCredential = await tx.credential.findFirst({
          where: { 
            userId: user.id, 
            type: CredentialType.PASSWORD 
          },
        });

        if (!existingCredential) {
          await tx.credential.create({
            data: {
              userId: user.id,
              type: CredentialType.PASSWORD,
              secret: defaultPasswordHash,
              isActive: true,
            },
          });
        }
      });

      processedCount++;
    } catch (error) {
      seedLogger.error(`      [Error] Fallo al procesar usuario: ${data.email}`, error);
    }
  }

  seedLogger.success(`  -> ${processedCount} usuarios procesados correctamente.`);
};