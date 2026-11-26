import { NextResponse } from "next/server";
import { requireApiPermission } from "@/modules/auth/context/api-authorization";
import { searchQuerySchema } from "@/modules/afiliaciones/control-accesos/Validators/access.schemas";
import { accessQueryService } from "@/modules/afiliaciones/control-accesos/Services/AccessQueryService";
import { accessApiError } from "@/modules/afiliaciones/control-accesos/Utils/apiError";

export async function GET(request: Request) {
  try {
    await requireApiPermission("read", "access_control");
    const parsed = searchQuerySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
    if (!parsed.success) {
      return NextResponse.json({ success: false, message: "Parámetros inválidos.", errors: parsed.error.flatten() }, { status: 400 });
    }
    const data = await accessQueryService.search(parsed.data.q, parsed.data.limit);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return accessApiError(error);
  }
}
