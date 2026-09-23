import { NextRequest, NextResponse } from "next/server";
import { ExpedienteRepository } from "@/modules/afiliaciones/expedientes/Repositories/ExpedienteRepository";
import { ExpedienteMapper } from "@/modules/afiliaciones/expedientes/Mappers/ExpedienteMapper";
import { prisma } from "@/lib/prisma";
import { OperationalAlertStatus } from "@prisma/client";
import { apiAuthorizationStatus, requireApiPermission } from "@/modules/auth/context/api-authorization";

export async function GET(request: NextRequest) {
  try {
    const currentUser = await requireApiPermission("read", "memberships");
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "8");

    const search = searchParams.get("search") || undefined;
    const status = searchParams.get("status") || undefined;
    const modality = searchParams.get("modality") || undefined;

    // Filtros de Áreas
    const logisticValidation = searchParams.get("logisticValidation") || undefined;
    const associateValidation = searchParams.get("associateValidation") || undefined;
    const comiteValidation = searchParams.get("comiteValidation") || undefined;
    const legalValidation = searchParams.get("legalValidation") || undefined;
    const comunicacionesValidation = searchParams.get("comunicacionesValidation") || undefined;

    const paymentStatus = searchParams.get("paymentStatus") || undefined;
    const orderBy = searchParams.get("orderBy") || undefined;
    const dateFrom = searchParams.get("dateFrom") || undefined;
    const dateTo = searchParams.get("dateTo") || undefined;

    // 1. Identificamos el rol
    const isComite = currentUser?.role?.slug === "COMITE_EVALUADOR";

    // SOLUCIÓN PAGINACIÓN: Si es el comité, traemos 1000 registros de la BD 
    // para que el filtro en memoria no corte expedientes válidos ocultos en otras páginas.
    const dbPage = isComite ? 1 : page;
    const dbPageSize = isComite ? 1000 : pageSize; 

    const repository = new ExpedienteRepository();
    const result = await repository.getPaginated({
      page: dbPage,
      pageSize: dbPageSize,
      search,
      status,
      modality,
      logisticValidation,
      associateValidation,
      comiteValidation,           
      legalValidation,            
      comunicacionesValidation,   
      paymentStatus,              
      orderBy,
      dateFrom,
      dateTo,
    });

    let expedientesFiltrados = result.data;
    let finalTotal = result.meta.total;

    // 2. EL FILTRO MÁGICO PARA EL COMITÉ (A prueba de errores y estados subsanados)
    if (isComite) {
      expedientesFiltrados = expedientesFiltrados.filter((app: any) => {
        const isStudent = String(app.affiliateType).toUpperCase() === "STUDENT";

        const logistica = app.validations?.find((v: any) => String(v.department?.code).toUpperCase() === "LOGISTICA");
        const asociados = app.validations?.find((v: any) => String(v.department?.code).toUpperCase() === "ASOCIADOS");

        // SOLUCIÓN ESTADO: Aceptamos "APPROVED" (Aprobado directo) o "RESOLVED" (Subsanado)
        const logisticaOk = logistica?.status === "APPROVED" || logistica?.status === "RESOLVED";
        const asociadosOk = asociados?.status === "APPROVED" || asociados?.status === "RESOLVED";

        const avalesAprobados = app.approvals?.filter((a: any) => a.status === "APPROVED").length || 0;
        const avalesListos = isStudent || avalesAprobados >= 2;

        return logisticaOk && asociadosOk && avalesListos;
      });

      // Recalculamos la paginación en memoria para el frontend
      finalTotal = expedientesFiltrados.length;
      const startIndex = (page - 1) * pageSize;
      expedientesFiltrados = expedientesFiltrados.slice(startIndex, startIndex + pageSize);
    }

    const applicationIds = expedientesFiltrados.map((application) => application.id);
    const alertGroups = applicationIds.length ? await prisma.operationalAlertTracking.groupBy({ by: ["applicationId", "severity"], where: { applicationId: { in: applicationIds }, status: { in: [OperationalAlertStatus.ACTIVE, OperationalAlertStatus.IN_PROGRESS] } }, _count: { _all: true } }) : [];
    const alertsByApplication = new Map<number, { total: number; critical: number; warning: number; highestSeverity: "CRITICAL" | "WARNING" | null }>();
    for (const id of applicationIds) alertsByApplication.set(id, { total: 0, critical: 0, warning: 0, highestSeverity: null });
    for (const group of alertGroups) { const summary = alertsByApplication.get(group.applicationId)!; const count = group._count._all; summary.total += count; if (group.severity === "CRITICAL") { summary.critical += count; summary.highestSeverity = "CRITICAL"; } else if (group.severity === "WARNING") { summary.warning += count; if (!summary.highestSeverity) summary.highestSeverity = "WARNING"; } }

    // 3. Mapeamos la data resultante
    const mappedData = await Promise.all(
      expedientesFiltrados.map((app) => ExpedienteMapper.toCardData({ ...app, operationalAlerts: alertsByApplication.get(app.id) })),
    );

    return NextResponse.json(
      {
        success: true,
        data: mappedData,
        meta: { 
          total: finalTotal,
          page,
          pageSize,
          totalPages: Math.ceil(finalTotal / pageSize)
        }, 
      },
      { status: 200 },
    );
  } catch (error: unknown) {
    console.error("[Expedientes API Error]:", error);
    return NextResponse.json(
      { success: false, message: apiAuthorizationStatus(error) < 500 ? "No autorizado." : "Error al obtener los expedientes." },
      { status: apiAuthorizationStatus(error) },
    );
  }
}
