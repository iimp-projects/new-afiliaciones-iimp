import { NextRequest, NextResponse } from "next/server";
import { ExpedienteRepository } from "@/modules/afiliaciones/expedientes/Repositories/ExpedienteRepository";
import { ExportExpedientesService } from "@/modules/afiliaciones/expedientes/Services/ExportExpedientesService";
import { apiAuthorizationStatus, requireApiPermission } from "@/modules/auth/context/api-authorization";

export async function GET(request: NextRequest) {
  try {
    const currentUser = await requireApiPermission("read", "applications");
    const searchParams = request.nextUrl.searchParams;

    const filters = {
      search: searchParams.get("search") || undefined,
      status: searchParams.get("status") || undefined,
      modality: searchParams.get("modality") || undefined,
      logisticValidation: searchParams.get("logisticValidation") || undefined,
      associateValidation: searchParams.get("associateValidation") || undefined,
      comiteValidation: searchParams.get("comiteValidation") || undefined,
      legalValidation: searchParams.get("legalValidation") || undefined,
      comunicacionesValidation: searchParams.get("comunicacionesValidation") || undefined,
      paymentStatus: searchParams.get("paymentStatus") || undefined,
      orderBy: searchParams.get("orderBy") || undefined,
      dateFrom: searchParams.get("dateFrom") || undefined,
      dateTo: searchParams.get("dateTo") || undefined,
    };

    const isComite = currentUser?.role?.slug === "COMITE_EVALUADOR";

    const repository = new ExpedienteRepository();
    const service = new ExportExpedientesService(repository);
    const buffer = await service.execute(filters, { isComite });

    const filename = `Expedientes_Afiliacion_${new Date().toISOString().slice(0, 10)}.xlsx`;

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error: unknown) {
    console.error("[Expedientes Export API Error]:", error);
    return NextResponse.json(
      { success: false, message: apiAuthorizationStatus(error) < 500 ? "No autorizado." : "Error al exportar los expedientes." },
      { status: apiAuthorizationStatus(error) },
    );
  }
}
