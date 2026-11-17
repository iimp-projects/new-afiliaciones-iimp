import { NextRequest, NextResponse } from "next/server";
import { ExpedienteRepository } from "@/modules/afiliaciones/expedientes/Repositories/ExpedienteRepository";
import { ExportExpedientesService } from "@/modules/afiliaciones/expedientes/Services/ExportExpedientesService";
import { parseExpedienteExportFilters } from "@/modules/afiliaciones/expedientes/Services/ExpedienteExportFilters";
import { apiAuthorizationStatus, requireApiPermission } from "@/modules/auth/context/api-authorization";

export async function GET(request: NextRequest) {
  try {
    const currentUser = await requireApiPermission("read", "applications");
    await requireApiPermission("read", "documents");
    const searchParams = request.nextUrl.searchParams;

    const filters = parseExpedienteExportFilters(searchParams);

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
