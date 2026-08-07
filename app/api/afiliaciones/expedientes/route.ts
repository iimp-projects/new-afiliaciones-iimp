import { NextRequest, NextResponse } from "next/server";
import { ExpedienteRepository } from "@/modules/afiliaciones/expedientes/Repositories/ExpedienteRepository";
import { ExpedienteMapper } from "@/modules/afiliaciones/expedientes/Mappers/ExpedienteMapper";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "8");
    const search = searchParams.get("search") || undefined;
    const status = searchParams.get("status") || undefined;
    const modality = searchParams.get("modality") || undefined;
    const logisticValidation =
      searchParams.get("logisticValidation") || undefined;
    const associateValidation =
      searchParams.get("associateValidation") || undefined;
    const orderBy = searchParams.get("orderBy") || undefined;
    const dateFrom = searchParams.get("dateFrom") || undefined;
    const dateTo = searchParams.get("dateTo") || undefined;

    const repository = new ExpedienteRepository();
    const result = await repository.getPaginated({
      page,
      pageSize,
      search,
      status,
      modality,
      logisticValidation,
      associateValidation,
      orderBy,
      dateFrom, 
      dateTo
    });

    // Usamos Promise.all porque toCardData ahora es asíncrono
    const mappedData = await Promise.all(
      result.data.map((app) => ExpedienteMapper.toCardData(app)),
    );

    return NextResponse.json(
      {
        success: true,
        data: mappedData,
        meta: result.meta,
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
