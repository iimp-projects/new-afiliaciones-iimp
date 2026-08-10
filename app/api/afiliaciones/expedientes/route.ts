import { NextRequest, NextResponse } from "next/server";
import { ExpedienteRepository } from "@/modules/afiliaciones/expedientes/Repositories/ExpedienteRepository";
import { ExpedienteMapper } from "@/modules/afiliaciones/expedientes/Mappers/ExpedienteMapper";
import { contextService } from "@/modules/auth/context/service";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "8");
    const search = searchParams.get("search") || undefined;
    const status = searchParams.get("status") || undefined;
    const modality = searchParams.get("modality") || undefined;
    const logisticValidation = searchParams.get("logisticValidation") || undefined;
    const associateValidation = searchParams.get("associateValidation") || undefined;
    const orderBy = searchParams.get("orderBy") || undefined;
    const dateFrom = searchParams.get("dateFrom") || undefined;
    const dateTo = searchParams.get("dateTo") || undefined;

    // 1. Identificamos quién está pidiendo la lista
    const currentUser = await contextService.getCurrentUser().catch(() => null);

    const repository = new ExpedienteRepository();
    const result = await repository.getPaginated({
      page, pageSize, search, status, modality,
      logisticValidation, associateValidation, orderBy, dateFrom, dateTo
    });

    // 2. EL FILTRO MÁGICO PARA EL COMITÉ
    let expedientesFiltrados = result.data;

    if (currentUser?.role.slug === 'COMITE_EVALUADOR') {
        expedientesFiltrados = expedientesFiltrados.filter((app: any) => {
            const isStudent = app.affiliateType === 'STUDENT';
            
            // Buscamos el estado de cada área
            const logistica = app.validations.find((v: any) => v.department.code === 'LOGISTICA');
            const asociados = app.validations.find((v: any) => v.department.code === 'ASOCIADOS');
            
            const logisticaAprobada = logistica?.status === 'APPROVED';
            const asociadosAprobado = asociados?.status === 'APPROVED';
            
            // Verificamos avales (Estudiantes no necesitan, activos necesitan 2)
            const avalesAprobados = app.approvals?.filter((a: any) => a.status === 'APPROVED').length || 0;
            const avalesListos = isStudent || avalesAprobados >= 2;

            // SOLO pasará si los 3 filtros se cumplen
            return logisticaAprobada && asociadosAprobado && avalesListos;
        });
    }

    // 3. Mapeamos la data resultante
    const mappedData = await Promise.all(
      expedientesFiltrados.map((app) => ExpedienteMapper.toCardData(app)),
    );

    return NextResponse.json(
      {
        success: true,
        data: mappedData,
        meta: { ...result.meta, total: expedientesFiltrados.length }, // Ajustamos el total
      },
      { status: 200 },
    );
  } catch (error: any) {
    console.error("[Expedientes API Error]:", error);
    return NextResponse.json(
      { success: false, message: "Error al obtener los expedientes." },
      { status: 500 },
    );
  }
}