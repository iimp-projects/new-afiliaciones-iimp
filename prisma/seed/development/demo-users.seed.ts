import { prisma } from '@/lib/prisma';
import { seedLogger, SEED_CONSTANTS, hashSeedPassword } from '@/lib/seed';

export const seedDemoUsers = async (): Promise<void> => {
  seedLogger.info('  -> Creando usuarios Demo (Applicant y Validator)...');

  const applicantRole = await prisma.role.findUnique({ where: { slug: SEED_CONSTANTS.ROLES.APPLICANT.slug } });
  if (!applicantRole) return;

  const demoEmail = 'applicant@demo.com';

  const person = await prisma.person.upsert({
    where: { documentType_documentNumber: { documentType: 'DNI', documentNumber: '11111111' } },
    update: {},
    create: {
      documentType: 'DNI',
      documentNumber: '11111111',
      firstName: 'Juan',
      paternalLastName: 'Pérez',
      maternalLastName: 'Demo',
    },
  });

  const user = await prisma.user.upsert({
    where: { email: demoEmail },
    update: { personId: person.id },
    create: {
      email: demoEmail,
      personId: person.id,
      roleId: applicantRole.id,
      status: 'ACTIVE',
      type: 'APPLICANT',
      emailVerified: new Date(),
    },
  });

  const hashedPw = await hashSeedPassword('Demo123!');
  
  const existingCred = await prisma.credential.findFirst({ where: { userId: user.id, type: 'PASSWORD' } });
  if (!existingCred) {
    await prisma.credential.create({
      data: { userId: user.id, type: 'PASSWORD', secret: hashedPw },
    });
  }

  seedLogger.success('  -> Usuarios de demostración creados correctamente.');
};