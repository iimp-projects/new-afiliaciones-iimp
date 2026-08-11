import type { Prisma } from "@prisma/client";

export const membershipDepartmentsData: Prisma.MembershipDepartmentCreateManyInput[] = [
  { 
    code: 'AVALES', 
    name: 'Avales Institucionales', 
    displayOrder: 1, 
    isRequired: true, 
    isActive: true 
  },
  { 
    code: 'ASOCIADOS', 
    name: 'Atención al Asociado', 
    displayOrder: 2, 
    isRequired: true, 
    isActive: true 
  },
  { 
    code: 'LOGISTICA', 
    name: 'Logística', 
    displayOrder: 3, 
    isRequired: true, 
    isActive: true 
  },
  { 
    code: 'COMITE', 
    name: 'Comité Evaluador', 
    displayOrder: 4, 
    isRequired: true, 
    isActive: true 
  },
];