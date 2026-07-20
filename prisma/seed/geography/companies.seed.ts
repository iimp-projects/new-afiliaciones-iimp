import { prisma } from '@/lib/prisma';
import { seedLogger } from '@/lib/seed';

export const seedCompanies = async (): Promise<void> => {
  seedLogger.info('  -> Ejecutando upsert de Empresas...');

  const companies = [
    { taxId: '20100147222', name: 'Compañía Minera Antamina S.A.', industry: 'Minería' },
    { taxId: '20100149004', name: 'Sociedad Minera Cerro Verde S.A.A.', industry: 'Minería' },
  ];

  for (const comp of companies) {
    await prisma.company.upsert({
      where: { taxId: comp.taxId }, // taxId sí es @unique en el schema
      update: { name: comp.name, industry: comp.industry },
      create: { taxId: comp.taxId, name: comp.name, industry: comp.industry, isActive: true },
    });
  }

  seedLogger.success(`  -> ${companies.length} empresas procesadas correctamente.`);
};