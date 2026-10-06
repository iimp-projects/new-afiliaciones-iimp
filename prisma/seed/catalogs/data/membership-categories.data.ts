import type { Prisma } from "@prisma/client";

export const membershipCategoriesData: Prisma.MembershipCategoryCreateManyInput[] = [
  { code: "A", name: "Activo", allowsLogin: true, mappedAffiliateType: "ACTIVE", mappedRoleSlug: "ASOCIADO_ACTIVO", isActive: true },
  { code: "E", name: "Estudiante", allowsLogin: true, mappedAffiliateType: "STUDENT", mappedRoleSlug: "ASOCIADO_ESTUDIANTE", isActive: true },
  { code: "X", name: "Separado", allowsLogin: false, mappedAffiliateType: null, mappedRoleSlug: null, isActive: true },
  { code: "R", name: "Renunciante", allowsLogin: false, mappedAffiliateType: null, mappedRoleSlug: null, isActive: true },
  { code: "U", name: "Anulado", allowsLogin: false, mappedAffiliateType: null, mappedRoleSlug: null, isActive: true },
  { code: "F", name: "Fallecido", allowsLogin: false, mappedAffiliateType: null, mappedRoleSlug: null, isActive: true },
  { code: "V", name: "Vitalicio", allowsLogin: false, mappedAffiliateType: null, mappedRoleSlug: null, isActive: true },
  { code: "H", name: "Honorario", allowsLogin: false, mappedAffiliateType: null, mappedRoleSlug: null, isActive: true },
  { code: "T", name: "Adherente", allowsLogin: false, mappedAffiliateType: null, mappedRoleSlug: null, isActive: true },
];
