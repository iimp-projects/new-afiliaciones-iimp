import { NextRequest, NextResponse } from "next/server";
import { ExportAsociadosService } from "@/modules/afiliaciones/asociados/Services/ExportAsociadosService";
import { apiAuthorizationStatus, requireApiPermission } from "@/modules/auth/context/api-authorization";

export async function GET(request: NextRequest) {
  try {
    await requireApiPermission("read", "associates");
    const searchParams = request.nextUrl.searchParams;

    const service = new ExportAsociadosService();
    const buffer = await service.execute({
      search: searchParams.get("q") || undefined,
      membershipType: searchParams.get("type") || undefined,
      sort: searchParams.get("sort") || undefined,
    });

    const filename = `Padron_Asociados_${new Date().toISOString().slice(0, 10)}.xlsx`;

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error: unknown) {
    console.error("[Asociados Export API Error]:", error);
    return NextResponse.json(
      { success: false, message: apiAuthorizationStatus(error) < 500 ? "No autorizado." : "Error al exportar el padrón de asociados." },
      { status: apiAuthorizationStatus(error) },
    );
  }
}
