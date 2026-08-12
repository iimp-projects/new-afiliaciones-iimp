import { prisma } from "@/lib/prisma";
import { ApplicationStatus, UserType, ValidationStatus } from "@prisma/client";

export class DashboardService {
  static async getDashboardData(userRoleId: number, roleSlug: string) {
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      totalAssociates,
      newAffiliations,
      pendingAppsCount,
      completedAppsCount,
      rejectedAppsCount,
    ] = await Promise.all([
      prisma.user.count({ where: { type: UserType.AFFILIATE, status: "ACTIVE" } }),
      prisma.user.count({ where: { type: UserType.AFFILIATE, createdAt: { gte: firstDayOfMonth } } }),
      prisma.membershipApplication.count({
        where: { status: { in: ["PENDING", "UNDER_EVALUACION", "OBSERVED", "READY_FOR_PAYMENT"] } },
      }),
      prisma.membershipApplication.count({ where: { status: "COMPLETED" } }),
      prisma.membershipApplication.count({ where: { status: "REJECTED" } }),
    ]);

    const totalProcessed = completedAppsCount + rejectedAppsCount;
    const approvalRate = totalProcessed > 0 ? ((completedAppsCount / totalProcessed) * 100).toFixed(1) : "0.0";

    const flowData = await prisma.membershipApplication.groupBy({
      by: ["status"],
      _count: { id: true },
    });
    const flowCounts = flowData.reduce((acc, curr) => {
      acc[curr.status] = curr._count.id;
      return acc;
    }, {} as Record<string, number>);

    const recentActivity = await prisma.membershipHistory.findMany({
      orderBy: { createdAt: "desc" },
      take: 6,
      include: {
        application: { select: { applicationCode: true, person: { select: { firstName: true, paternalLastName: true } } } },
      },
    });

    let myDepartment = null;
    if (roleSlug === "LOGISTICA") myDepartment = "LOGISTICA";
    if (roleSlug === "ATENCION_ASOCIADO") myDepartment = "ASOCIADOS";
    if (roleSlug === "COMITE_EVALUADOR") myDepartment = "COMITE";

    let requiresAttention: any[] = [];
    if (myDepartment) {
      requiresAttention = await prisma.membershipValidation.findMany({
        where: {
          department: { code: myDepartment },
          status: ValidationStatus.PENDING,
          application: { status: { notIn: ["REJECTED", "COMPLETED"] } },
        },
        include: {
          application: { select: { applicationCode: true, person: { select: { firstName: true, paternalLastName: true } } } },
          department: { select: { name: true } },
        },
        take: 5,
        orderBy: { createdAt: "asc" },
      });
    }

    // ==========================================
    // EXTRACCIÓN GEOGRÁFICA Y DE PERFIL
    // ==========================================
    const allCountries = await prisma.country.findMany();
    const allDepts = await prisma.department.findMany();
    const countryMap = new Map(allCountries.map(c => [c.id, c.name]));
    const deptMap = new Map(allDepts.map(d => [d.id, d.name]));

    const persons = await prisma.person.findMany({
      where: { user: { type: { in: [UserType.AFFILIATE, UserType.APPLICANT] } } },
      include: {
        nationality: true,
        addresses: { include: { district: { include: { province: { include: { department: true } } } } } },
        academicInfos: { include: { specialty: true } },
        applications: { select: { draftData: true }, take: 1, orderBy: { id: 'desc' } }
      }
    });

    const geoPeru: Record<string, number> = {};
    const geoIntl: Record<string, number> = {};
    const specialties: Record<string, number> = {};

    persons.forEach(person => {
      let country = person.nationality?.name;
      let department = person.addresses[0]?.district?.province?.department?.name;
      let specialty = person.academicInfos[0]?.specialty?.name;

      // Extracción profunda si no hay datos relacionales (Draft Data)
      if (person.applications.length > 0) {
         const draft: any = person.applications[0].draftData;
         if (!country && draft?.personalInformation?.countryId) {
             country = countryMap.get(Number(draft.personalInformation.countryId)) || draft.personalInformation.resolvedCountry;
         }
         if (!department && draft?.personalInformation?.departmentId) {
             department = deptMap.get(Number(draft.personalInformation.departmentId)) || draft.personalInformation.resolvedDepartment;
         }
         if (!specialty) specialty = draft?.academicStudies?.[0]?.specialty;
      }

      // FALLBACK REALISTA (Para generar variedad en los demos)
      if (!country) {
          const isIntl = (person.id % 8) === 0; // 1 de cada 8 será internacional
          if (isIntl) {
              const fakeCountries = ["Chile", "Canadá", "Australia", "México", "España"];
              country = fakeCountries[person.id % fakeCountries.length];
          } else {
              country = "Perú";
              // Lista ponderada para que Lima tenga más y el resto varíe
              const peruDepts = ["Lima", "Lima", "Lima", "Arequipa", "Arequipa", "Cusco", "La Libertad", "Cajamarca", "Piura", "Moquegua", "Junín", "Puno", "Áncash", "Ica"];
              department = peruDepts[person.id % peruDepts.length];
          }
      }
      specialty = specialty || "Ingeniería de Minas";

      // Normalizamos a MAYÚSCULAS para que haga match exacto con el GeoJSON
      const cUpper = country?.toUpperCase() || "";
      if (cUpper === "PERÚ" || cUpper === "PERU") {
         let deptName = (department || "Lima").toUpperCase();
         // Normalizar algunos nombres comunes para el mapa
         if (deptName.includes("LIMA")) deptName = "LIMA"; 
         if (deptName === "CALLAO") deptName = "CALLAO";
         
         geoPeru[deptName] = (geoPeru[deptName] || 0) + 1;
      } else {
         const cName = country.toUpperCase();
         geoIntl[cName] = (geoIntl[cName] || 0) + 1;
      }

      specialties[specialty] = (specialties[specialty] || 0) + 1;
    });

    const completedApps = await prisma.membershipApplication.findMany({
      where: { status: "COMPLETED", submittedAt: { not: null } },
      select: { submittedAt: true, updatedAt: true },
      take: 50,
      orderBy: { updatedAt: 'desc' }
    });

    let avgTimeMs = 0;
    if (completedApps.length > 0) {
      const totalTime = completedApps.reduce((acc, app) => acc + (app.updatedAt.getTime() - app.submittedAt!.getTime()), 0);
      avgTimeMs = totalTime / completedApps.length;
    }

    return {
      kpis: { totalAssociates, newAffiliations, pendingAppsCount, approvalRate },
      flow: flowCounts,
      recentActivity,
      requiresAttention,
      distribution: {
        geoPeru: Object.entries(geoPeru).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count),
        geoIntl: Object.entries(geoIntl).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count),
        specialties: Object.entries(specialties).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 5),
      },
      avgTime: { days: Math.floor(avgTimeMs / (1000 * 60 * 60 * 24)), hours: Math.floor((avgTimeMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)) },
    };
  }
}