import { PrismaClient, DocumentType, UserType, UserStatus } from '@prisma/client';
import { Client } from 'pg';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: "postgresql://postgres:admin@localhost:5432/bd_afiliaciones_dev?schema=public"
    }
  }
});

const oldDb = new Client({
  connectionString: "postgresql://postgres:admin@localhost:5432/bdafiliacion"
});

function mapDocumentType(oldType: string | null): DocumentType {
  if (!oldType) return 'OTHER';
  const type = oldType.trim().toUpperCase();
  if (type === 'DNI' || type === '1') return 'DNI';
  if (type === 'CE' || type === '2' || type === 'C.E') return 'CE';
  if (type === 'PAS' || type === 'PASSPORT' || type === '3') return 'PASSPORT';
  return 'OTHER';
}

async function migrarUsuarios() {
  console.log("🚀 INICIANDO FASE 1: Migración de avst_user y avst_agent...\n");

  let defaultRole = await prisma.role.findUnique({ where: { slug: 'VALIDADOR' } });
  
  if (!defaultRole) {
    defaultRole = await prisma.role.findFirst();
    if (!defaultRole) throw new Error("❌ Debes ejecutar los seeders de Roles antes de migrar usuarios.");
  }

  // =========================================================================
  // PARTE A: MIGRAR TABLA avst_user
  // =========================================================================
  const resUsers = await oldDb.query('SELECT * FROM avst_user');
  console.log(`📦 Procesando ${resUsers.rows.length} registros de 'avst_user'...`);

  let countUsers = 0;
  for (const oldUser of resUsers.rows) {
    const docNumber = oldUser.vusu_nrodoc?.trim();
    if (!docNumber) {
      console.log(`⏭️ Omitiendo avst_user ID ${oldUser.iusu_id} (Sin número de documento)`);
      continue;
    }

    const documentType = mapDocumentType(oldUser.vusu_tipodoc);
    const isActive = oldUser.cusu_est === 1;
    const email = oldUser.vusu_cor?.trim() || `user_${oldUser.iusu_id}@legacy.local`;

    try {
      await prisma.$transaction(async (tx) => {
        const person = await tx.person.upsert({
          where: { documentType_documentNumber: { documentType, documentNumber: docNumber } },
          update: {},
          create: {
            documentType,
            documentNumber: docNumber,
            firstName: oldUser.vusu_nombre || 'Sin Nombre',
            paternalLastName: oldUser.vusu_apellidop || 'Sin Apellido',
            maternalLastName: oldUser.vusu_apellidom || '',
          }
        });

        const existingUserByPerson = await tx.user.findUnique({ where: { personId: person.id } });
        let finalUserId = null;

        if (existingUserByPerson) {
          console.log(`⚠️  El DNI ${docNumber} ya tiene un usuario vinculado (${existingUserByPerson.email}). Omitiendo duplicado (${email}).`);
          finalUserId = existingUserByPerson.id;
        } else {
          const existingUserByEmail = await tx.user.findUnique({ where: { email } });
          const safeEmail = existingUserByEmail ? `duplicado_${oldUser.iusu_id}_${email}` : email;

          const newUser = await tx.user.create({
            data: {
              email: safeEmail,
              name: oldUser.vusu_name || null,
              personId: person.id,
              status: isActive ? UserStatus.ACTIVE : UserStatus.INACTIVE,
              type: UserType.VALIDATOR,
              roleId: defaultRole.id,
              createdAt: oldUser.dusu_fec_cre || new Date(),
            }
          });
          finalUserId = newUser.id;
        }

        if (finalUserId && oldUser.vusu_cla) {
          const credExists = await tx.credential.findFirst({ where: { userId: finalUserId } });
          if (!credExists) {
            await tx.credential.create({
              data: {
                userId: finalUserId,
                type: 'PASSWORD',
                secret: oldUser.vusu_cla,
                isActive: true
              }
            });
          }
        }
      });
      countUsers++;
    } catch (e) {
      console.log(`❌ Error al migrar avst_user ID ${oldUser.iusu_id} (${email}):`, e);
    }
  }
  console.log(`✅ Migrados/Procesados ${countUsers} registros de 'avst_user'.\n`);


  // =========================================================================
  // PARTE B: MIGRAR TABLA avst_agent
  // =========================================================================
  const resAgents = await oldDb.query('SELECT * FROM avst_agent');
  console.log(`📦 Procesando ${resAgents.rows.length} registros de 'avst_agent'...`);

  let countAgents = 0;
  for (const oldAgent of resAgents.rows) {
    const docNumber = oldAgent.vage_nrodoc?.trim();
    if (!docNumber) {
      console.log(`⏭️ Omitiendo avst_agent ID ${oldAgent.iage_id} (Sin número de documento)`);
      continue;
    }

    const documentType = mapDocumentType(oldAgent.vage_tipodoc);
    const isActive = oldAgent.cage_est === 1;
    const email = oldAgent.vage_cor?.trim() || `agent_${oldAgent.iage_id}@legacy.local`;

    try {
      await prisma.$transaction(async (tx) => {
        const person = await tx.person.upsert({
          where: { documentType_documentNumber: { documentType, documentNumber: docNumber } },
          update: {},
          create: {
            documentType,
            documentNumber: docNumber,
            firstName: oldAgent.vage_nombre || 'Sin Nombre',
            paternalLastName: oldAgent.vage_apellidop || 'Sin Apellido',
            maternalLastName: oldAgent.vage_apellidom || '',
          }
        });

        const existingUserByPerson = await tx.user.findUnique({ where: { personId: person.id } });
        let finalUserId = null;

        if (existingUserByPerson) {
          console.log(`⚠️  El DNI ${docNumber} ya tiene un usuario vinculado (${existingUserByPerson.email}). Omitiendo duplicado (${email}).`);
          finalUserId = existingUserByPerson.id;
        } else {
          const existingUserByEmail = await tx.user.findUnique({ where: { email } });
          const safeEmail = existingUserByEmail ? `duplicado_${oldAgent.iage_id}_${email}` : email;

          const newUser = await tx.user.create({
            data: {
              email: safeEmail,
              name: oldAgent.vage_name || null,
              personId: person.id,
              status: isActive ? UserStatus.ACTIVE : UserStatus.INACTIVE,
              type: UserType.VALIDATOR, 
              roleId: defaultRole.id,
              createdAt: oldAgent.dage_fec_cre || new Date(),
            }
          });
          finalUserId = newUser.id;
        }

        if (finalUserId && oldAgent.vage_cla) {
          const credExists = await tx.credential.findFirst({ where: { userId: finalUserId } });
          if (!credExists) {
            await tx.credential.create({
              data: {
                userId: finalUserId,
                type: 'PASSWORD',
                secret: oldAgent.vage_cla,
                isActive: true
              }
            });
          }
        }
      });
      countAgents++;
    } catch (e) {
      console.log(`❌ Error al migrar avst_agent ID ${oldAgent.iage_id} (${email}):`, e);
    }
  }
  console.log(`✅ Migrados/Procesados ${countAgents} registros de 'avst_agent'.\n`);
  
  console.log("🎉 FASE 1 COMPLETADA CON ÉXITO.");
}

async function main() {
  await oldDb.connect();
  console.log("🔌 Conexión establecida con bdafiliacion (Legacy).\n");
  
  try {
    await migrarUsuarios();
  } catch (error) {
    console.error("❌ Error catastrófico durante la migración:", error);
  } finally {
    await oldDb.end();
    await prisma.$disconnect();
    console.log("🔌 Conexiones cerradas.");
  }
}

main();