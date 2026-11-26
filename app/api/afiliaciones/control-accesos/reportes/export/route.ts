import { NextResponse } from "next/server";
import { requireApiPermission } from "@/modules/auth/context/api-authorization";
import { exportQuerySchema } from "@/modules/afiliaciones/control-accesos/Validators/access.schemas";
import { accessExportService } from "@/modules/afiliaciones/control-accesos/Services/AccessExportService";
import { parseRangeDate } from "@/modules/afiliaciones/control-accesos/Utils/dateRange";
import { accessApiError } from "@/modules/afiliaciones/control-accesos/Utils/apiError";

export async function GET(request: Request) {
  try {
    const user = await requireApiPermission("export", "access_control");
    const parsed = exportQuerySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
    if (!parsed.success) {
      return NextResponse.json({ success: false, message: "Parámetros inválidos.", errors: parsed.error.flatten() }, { status: 400 });
    }
    const result = await accessExportService.exportMovements(
      {
        siteId: parsed.data.siteId,
        from: parseRangeDate(parsed.data.from),
        to: parseRangeDate(parsed.data.to, true),
      },
      user.id,
    );
    return new NextResponse(new Uint8Array(result.buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${result.filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return accessApiError(error);
  }
}
