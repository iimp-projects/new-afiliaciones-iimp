import { NextRequest, NextResponse } from "next/server";
import { ExpedienteRepository } from "@/modules/afiliaciones/expedientes/Repositories/ExpedienteRepository";
import { ExportExpedientesService } from "@/modules/afiliaciones/expedientes/Services/ExportExpedientesService";
import { ExpedienteDocumentsZipService } from "@/modules/afiliaciones/expedientes/Services/ExpedienteDocumentsZipService";
import { parseExpedienteExportFilters } from "@/modules/afiliaciones/expedientes/Services/ExpedienteExportFilters";
import { apiAuthorizationStatus, requireApiPermission } from "@/modules/auth/context/api-authorization";

export async function GET(request: NextRequest) {
  try {
    const currentUser = await requireApiPermission("read", "applications");
    await requireApiPermission("read", "documents");

    const filters = parseExpedienteExportFilters(request.nextUrl.searchParams);
    const isComite = currentUser?.role?.slug === "COMITE_EVALUADOR";

    const exportService = new ExportExpedientesService(new ExpedienteRepository());
    const zipService = new ExpedienteDocumentsZipService(exportService);
    const result = await zipService.execute(filters, { isComite });

    return new NextResponse(new Uint8Array(result.buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${result.fileName}"`,
        "X-Expedientes-Exportados": String(result.expedientes),
        "X-Documentos-Exportados": String(result.documents),
      },
    });
  } catch (error: unknown) {
    console.error("[Expedientes Documents Zip API Error]:", error);
    return NextResponse.json(
      {
        success: false,
        message:
          apiAuthorizationStatus(error) < 500
            ? "No autorizado."
            : "Error al descargar los documentos de los expedientes.",
      },
      { status: apiAuthorizationStatus(error) },
    );
  }
}
