import { NextResponse } from "next/server";
import { requireApiPermission } from "@/modules/auth/context/api-authorization";
import { dashboardQuerySchema } from "@/modules/afiliaciones/control-accesos/Validators/access.schemas";
import { accessQueryService } from "@/modules/afiliaciones/control-accesos/Services/AccessQueryService";
import { accessApiError } from "@/modules/afiliaciones/control-accesos/Utils/apiError";

export async function GET(request: Request) {
  try {
    await requireApiPermission("read", "access_control");
    const parsed = dashboardQuerySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
    if (!parsed.success) {
      return NextResponse.json({ success: false, message: "Parámetros inválidos.", errors: parsed.error.flatten() }, { status: 400 });
    }
    const data = await accessQueryService.dashboard(parsed.data.siteId);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return accessApiError(error);
  }
}
