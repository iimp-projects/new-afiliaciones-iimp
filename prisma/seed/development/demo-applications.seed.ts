import { prisma } from '@/lib/prisma';
import { seedLogger } from '@/lib/seed';

export const seedDemoApplications = async (): Promise<void> => {
  seedLogger.info('  -> Creando Postulación Demo...');

  const person = await prisma.person.findUnique({
    where: { documentType_documentNumber: { documentType: 'DNI', documentNumber: '11111111' } },
  });

  if (!person) return;

  const appCode = 'APP-2026-0001';

  await prisma.membershipApplication.upsert({
    where: { applicationCode: appCode },
    update: {},
    create: {
      applicationCode: appCode,
      trackingCode: 'TRK-998877',
      personId: person.id,
      affiliateType: 'REGULAR',
      status: 'SUBMITTED',
      currentStep: 3,
      submittedAt: new Date(),
    },
  });

  seedLogger.success('  -> Postulación Demo procesada correctamente.');
};