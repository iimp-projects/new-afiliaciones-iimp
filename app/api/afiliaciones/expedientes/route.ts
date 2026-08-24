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

    // Filtros de Áreas
    const logisticValidation = searchParams.get("logisticValidation") || undefined;
    const associateValidation = searchParams.get("associateValidation") || undefined;
    const comiteValidation = searchParams.get("comiteValidation") || undefined;
    const legalValidation = searchParams.get("legalValidation") || undefined;
    const comunicacionesValidation = searchParams.get("comunicacionesValidation") || undefined;

    // Filtros Extras
    const paymentStatus = searchParams.get("paymentStatus") || undefined;
    const orderBy = searchParams.get("orderBy") || undefined;
    const dateFrom = searchParams.get("dateFrom") || undefined;
    const dateTo = searchParams.get("dateTo") || undefined;

    // 1. Identificamos quién está pidiendo la lista
    const currentUser = await contextService.getCurrentUser().catch(() => null);

    const repository = new ExpedienteRepository();
    const result = await repository.getPaginated({
      page,
      pageSize,
      search,
      status,
      modality,
      logisticValidation,
      associateValidation,
      comiteValidation,           // <-- ¡FALTABA ESTO!
      legalValidation,            // <-- ¡FALTABA ESTO!
      comunicacionesValidation,   // <-- ¡FALTABA ESTO!
      paymentStatus,              // <-- ¡FALTABA ESTO!
      orderBy,
      dateFrom,
      dateTo,
    });

    // 2. EL FILTRO MÁGICO PARA EL COMITÉ
    let expedientesFiltrados = result.data;

    if (currentUser?.role.slug === "COMITE_EVALUADOR") {
      expedientesFiltrados = expedientesFiltrados.filter((app: any) => {
        const isStudent = app.affiliateType === "STUDENT";

        // Buscamos el estado de cada área
        const logistica = app.validations.find((v: any) => v.department.code === "LOGISTICA");
        const asociados = app.validations.find((v: any) => v.department.code === "ASOCIADOS");
        const legal = app.validations.find((v: any) => v.department.code === "LEGAL");
        const comunicaciones = app.validations.find((v: any) => v.department.code === "COMUNICACIONES");

        // Verificamos si están aprobadas
        const logisticaAprobada = logistica?.status === "APPROVED";
        const asociadosAprobado = asociados?.status === "APPROVED";
        const legalAprobada = legal?.status === "APPROVED";
        const comunicacionesAprobada = comunicaciones?.status === "APPROVED";

        // Verificamos avales
        const avalesAprobados = app.approvals?.filter((a: any) => a.status === "APPROVED").length || 0;
        const avalesListos = isStudent || avalesAprobados >= 2;

        // SOLO pasará si TODAS las áreas paralelas previas ya aprobaron
        return (
          logisticaAprobada &&
          asociadosAprobado &&
          legalAprobada &&
          comunicacionesAprobada &&
          avalesListos
        );
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
        meta: { 
          ...result.meta, 
          // SOLUCIÓN AL BUG DEL "8": El total real lo trae result.meta.total, solo lo sobrescribimos si es el Comité.
          total: currentUser?.role.slug === "COMITE_EVALUADOR" 
            ? expedientesFiltrados.length 
            : result.meta.total 
        }, 
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