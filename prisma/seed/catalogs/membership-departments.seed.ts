import { prisma } from '@/lib/prisma';
import { seedLogger } from '@/lib/seed';
import { membershipDepartmentsData } from './data/membership-departments.data';

export const seedMembershipDepartments = async (): Promise<void> => {
  seedLogger.info('  -> Ejecutando upsert de Departamentos de Evaluación...');
  
  let processedCount = 0;

  for (const dept of membershipDepartmentsData) {
    await prisma.membershipDepartment.upsert({
      where: { code: dept.code },
      update: { 
        name: dept.name, 
        displayOrder: dept.displayOrder, 
        isRequired: dept.isRequired,
        isActive: dept.isActive
      },
      create: {
        code: dept.code,
        name: dept.name,
        displayOrder: dept.displayOrder,
        isRequired: dept.isRequired,
        isActive: dept.isActive ?? true
      },
    });
    processedCount++;
  }

  seedLogger.success(`  -> ${processedCount} departamentos de evaluación procesados correctamente.`);
};