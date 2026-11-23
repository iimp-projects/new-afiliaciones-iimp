import { NextRequest, NextResponse } from "next/server";
import { ExportAsociadosService } from "@/modules/afiliaciones/asociados/Services/ExportAsociadosService";
import { AsociadosDocumentsZipService } from "@/modules/afiliaciones/asociados/Services/AsociadosDocumentsZipService";
import { apiAuthorizationStatus, requireApiPermission } from "@/modules/auth/context/api-authorization";

export async function GET(request: NextRequest) {
  try {
    await requireApiPermission("read", "associates");
    await requireApiPermission("read", "documents");

    const searchParams = request.nextUrl.searchParams;
    const exportService = new ExportAsociadosService();
    const zipService = new AsociadosDocumentsZipService(exportService);
    const result = await zipService.execute({
      search: searchParams.get("q") || undefined,
      membershipType: searchParams.get("type") || undefined,
      sort: searchParams.get("sort") || undefined,
    });

    return new NextResponse(new Uint8Array(result.buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${result.fileName}"`,
        "X-Asociados-Exportados": String(result.expedientes),
        "X-Documentos-Exportados": String(result.documents),
      },
    });
  } catch (error: unknown) {
    console.error("[Asociados Documents Zip API Error]:", error);
    return NextResponse.json(
      {
        success: false,
        message:
          apiAuthorizationStatus(error) < 500
            ? "No autorizado."
            : "Error al descargar los documentos de los asociados.",
      },
      { status: apiAuthorizationStatus(error) },
    );
  }
}
