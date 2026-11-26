import { NextResponse } from "next/server";
import { requireApiPermission } from "@/modules/auth/context/api-authorization";
import { movementsQuerySchema } from "@/modules/afiliaciones/control-accesos/Validators/access.schemas";
import { accessQueryService } from "@/modules/afiliaciones/control-accesos/Services/AccessQueryService";
import { parseRangeDate } from "@/modules/afiliaciones/control-accesos/Utils/dateRange";
import { accessApiError } from "@/modules/afiliaciones/control-accesos/Utils/apiError";

export async function GET(request: Request) {
  try {
    await requireApiPermission("read", "access_control");
    const parsed = movementsQuerySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
    if (!parsed.success) {
      return NextResponse.json({ success: false, message: "Parámetros inválidos.", errors: parsed.error.flatten() }, { status: 400 });
    }
    const { page, pageSize, from, to, ...rest } = parsed.data;
    const data = await accessQueryService.movements(
      { ...rest, from: parseRangeDate(from), to: parseRangeDate(to, true) },
      page,
      pageSize,
    );
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return accessApiError(error);
  }
}
