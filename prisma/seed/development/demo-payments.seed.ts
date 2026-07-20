import { prisma } from '@/lib/prisma';
import { seedLogger } from '@/lib/seed';

export const seedDemoPayments = async (): Promise<void> => {
  seedLogger.info('  -> Creando Pagos Demo...');

  const application = await prisma.membershipApplication.findUnique({
    where: { applicationCode: 'APP-2026-0001' },
  });

  if (!application) return;

  // Como Payment no tiene key única salvo ID o relaciones complejas, usamos findFirst
  const existingPayment = await prisma.payment.findFirst({
    where: { applicationId: application.id, transactionId: 'TXN-DEMO-001' },
  });

  if (!existingPayment) {
    await prisma.payment.create({
      data: {
        applicationId: application.id,
        gateway: 'NIUBIZ',
        transactionId: 'TXN-DEMO-001',
        totalAmount: 150.00,
        currency: 'PEN',
        status: 'PAID',
        paymentDate: new Date(),
      },
    });
  }

  seedLogger.success('  -> Pagos Demo procesados correctamente.');
};