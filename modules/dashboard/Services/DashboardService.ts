import { prisma } from "@/lib/prisma";
import { ApplicationStatus, UserType, ValidationStatus, AffiliateType } from "@prisma/client";

export class DashboardService {
  static async getDashboardData(userRoleId: number, roleSlug: string) {
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const currentYear = now.getFullYear();

    // ========================================================
    // 1. KPIs GENERALES (REGLAS DE NEGOCIO CORREGIDAS)
    // ========================================================
    
    // A) ASOCIADOS ACTIVOS: Contamos a los usuarios que históricamente tienen el rol 'ASOCIADO_ACTIVO' 
    // y lo unificamos con las nuevas postulaciones que terminaron con éxito en esa categoría.
    const legacyActiveUsers = await prisma.user.count({
      where: { 
        status: "ACTIVE", 
        role: { slug: "ASOCIADO_ACTIVO" } 
      },
    });
    
    const completedActiveApps = await prisma.membershipApplication.count({
      where: {
        affiliateType: AffiliateType.ACTIVE, // REGLA: Categoría Profesional/Activa
        status: ApplicationStatus.COMPLETED
      }
    });
    
    const totalAssociates = Math.max(legacyActiveUsers, completedActiveApps);

    // B) NUEVAS AFILIACIONES: Solicitudes reales creadas este mes (Ignorando borradores abandonados)
    const newAffiliations = await prisma.membershipApplication.count({
      where: {
        createdAt: { gte: firstDayOfMonth },
        status: { not: ApplicationStatus.DRAFT },
      },
    });

    // C) EXPEDIENTES PENDIENTES: Todo lo que está en flujo de trabajo y requiere revisión o pago
    const pendingAppsCount = await prisma.membershipApplication.count({
      where: {
        status: {
          in: [
            ApplicationStatus.PENDING,
            ApplicationStatus.UNDER_EVALUACION,
            ApplicationStatus.OBSERVED,
            ApplicationStatus.RESOLVED,
            ApplicationStatus.READY_FOR_PAYMENT,
          ],
        },
      },
    });

    // D) TASA DE APROBACIÓN HISTÓRICA
    const completedAppsCount = await prisma.membershipApplication.count({ 
      where: { status: ApplicationStatus.COMPLETED } 
    });
    const rejectedAppsCount = await prisma.membershipApplication.count({ 
      where: { status: ApplicationStatus.REJECTED } 
    });

    const totalProcessed = completedAppsCount + rejectedAppsCount;
    const approvalRate = totalProcessed > 0
        ? ((completedAppsCount / totalProcessed) * 100).toFixed(1)
        : "0.0";

    // ========================================================
    // 2. FLUJO BÁSICO Y ACTIVIDAD RECIENTE
    // ========================================================
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
        application: {
          select: {
            applicationCode: true,
            person: { select: { firstName: true, paternalLastName: true } },
          },
        },
      },
    });

    // ========================================================
    // 3. TAREAS QUE REQUIEREN ATENCIÓN (POR ÁREA)
    // ========================================================
    let myDepartment = null;
    if (roleSlug === "LOGISTICA") myDepartment = "LOGISTICA";
    if (roleSlug === "ATENCION_ASOCIADO") myDepartment = "ASOCIADOS";
    if (roleSlug === "LEGAL") myDepartment = "LEGAL";
    if (roleSlug === "COMUNICACIONES") myDepartment = "COMUNICACIONES";
    if (roleSlug === "COMITE_EVALUADOR") myDepartment = "COMITE";

    let requiresAttention: any[] = [];
    if (myDepartment) {
      requiresAttention = await prisma.membershipValidation.findMany({
        where: {
          department: { code: myDepartment },
          status: ValidationStatus.PENDING,
          application: { status: { notIn: [ApplicationStatus.REJECTED, ApplicationStatus.COMPLETED] } },
        },
        include: {
          application: {
            select: {
              applicationCode: true,
              person: { select: { firstName: true, paternalLastName: true } },
            },
          },
          department: { select: { name: true } },
        },
        take: 5,
        orderBy: { createdAt: "asc" },
      });
    }

    // ========================================================
    // 4. DISTRIBUCIÓN GEOGRÁFICA (Solo postulantes reales)
    // ========================================================
    const allCountries = await prisma.country.findMany();
    const allDepts = await prisma.department.findMany();
    const countryMap = new Map(allCountries.map((c) => [c.id, c.name]));
    const deptMap = new Map(allDepts.map((d) => [d.id, d.name]));

    const persons = await prisma.person.findMany({
      where: {
        OR: [
          { user: { type: { in: [UserType.AFFILIATE, UserType.APPLICANT] } } },
          { applications: { some: { status: { not: ApplicationStatus.DRAFT } } } }
        ]
      },
      include: {
        nationality: true,
        addresses: { include: { district: { include: { province: { include: { department: true } } } } } },
        academicInfos: { include: { specialty: true } },
        applications: {
          select: { draftData: true },
          take: 1,
          orderBy: { id: "desc" },
        },
      },
    });

    const geoPeru: Record<string, number> = {};
    const geoIntl: Record<string, number> = {};
    const specialties: Record<string, number> = {};

    persons.forEach((person) => {
      let country = person.nationality?.name;
      let department = person.addresses[0]?.district?.province?.department?.name;
      let specialty = person.academicInfos[0]?.specialty?.name;

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

      // Fallback estricto si no hay datos geográficos
      if (!country) country = "Perú";
      if (!department) department = "Lima";

      specialty = specialty || "Ingeniería de Minas";

      const cUpper = country.toUpperCase();
      if (cUpper === "PERÚ" || cUpper === "PERU") {
        let deptName = department.toUpperCase();
        if (deptName.includes("LIMA")) deptName = "LIMA";
        if (deptName === "CALLAO") deptName = "CALLAO";
        geoPeru[deptName] = (geoPeru[deptName] || 0) + 1;
      } else {
        geoIntl[cUpper] = (geoIntl[cUpper] || 0) + 1;
      }

      specialties[specialty] = (specialties[specialty] || 0) + 1;
    });

    // ========================================================
    // 5. TENDENCIA MENSUAL (GRÁFICO EXACTO, SIN SIMULADOR)
    // ========================================================
    const appsThisYear = await prisma.membershipApplication.findMany({
      where: {
        createdAt: { gte: new Date(currentYear, 0, 1) },
        status: { not: ApplicationStatus.DRAFT } // No sumamos abandonos
      },
      select: { createdAt: true, status: true, affiliateType: true },
    });

    const months = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
    const monthlyTrend = months.map((m) => ({
      name: m,
      recibidos: 0,
      aprobados: 0,
      estudiantes: 0,
      profesionales: 0,
    }));

    appsThisYear.forEach((app) => {
      const monthIndex = app.createdAt.getMonth();
      monthlyTrend[monthIndex].recibidos += 1;

      // Un aprobado cuenta si ya completó o está a la espera de pago final
      if (app.status === ApplicationStatus.COMPLETED || app.status === ApplicationStatus.READY_FOR_PAYMENT) {
        monthlyTrend[monthIndex].aprobados += 1;
      }

      // Regla exacta de categoría
      if (app.affiliateType === AffiliateType.STUDENT) {
        monthlyTrend[monthIndex].estudiantes += 1;
      } else if (app.affiliateType === AffiliateType.ACTIVE) {
        monthlyTrend[monthIndex].profesionales += 1;
      }
    });

    // ========================================================
    // 6. TIEMPO PROMEDIO DE ATENCIÓN
    // ========================================================
    const completedApps = await prisma.membershipApplication.findMany({
      where: { status: ApplicationStatus.COMPLETED, submittedAt: { not: null } },
      select: { submittedAt: true, updatedAt: true },
      take: 50,
      orderBy: { updatedAt: "desc" },
    });

    let avgTimeMs = 0;
    if (completedApps.length > 0) {
      const totalTime = completedApps.reduce((acc, app) => acc + (app.updatedAt.getTime() - app.submittedAt!.getTime()), 0);
      avgTimeMs = totalTime / completedApps.length;
    }

    return {
      kpis: {
        totalAssociates,
        newAffiliations,
        pendingAppsCount,
        approvalRate,
      },
      flow: flowCounts,
      recentActivity,
      requiresAttention,
      monthlyTrend, 
      distribution: {
        geoPeru: Object.entries(geoPeru).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count),
        geoIntl: Object.entries(geoIntl).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count),
        specialties: Object.entries(specialties).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 5),
      },
      avgTime: {
        days: Math.floor(avgTimeMs / (1000 * 60 * 60 * 24)),
        hours: Math.floor((avgTimeMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
      },
    };
  }
}