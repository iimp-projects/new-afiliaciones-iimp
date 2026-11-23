import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { contextService } from "@/modules/auth/context/service";
import { isAffiliateUser } from "@/modules/auth/context/types";
import { applicationStates } from "@/modules/afiliaciones/postulacion/Models/ApplicationAction";
import { EndorsementHistoryService } from "@/modules/afiliaciones/endorsements/Services/EndorsementHistoryService";

export const dynamic = "force-dynamic";

const calendarDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(10),
  search: z.string().trim().max(120).optional(),
  status: z.enum(applicationStates).optional(),
  from: calendarDate.optional(),
  to: calendarDate.optional(),
});

const startOfDay = (value?: string) =>
  value ? new Date(`${value}T00:00:00.000Z`) : undefined;
const endOfDay = (value?: string) =>
  value ? new Date(`${value}T23:59:59.999Z`) : undefined;

/**
 * GET /api/mi-cuenta/avales
 *
 * Solo devuelve los avales otorgados por el asociado autenticado. El backend
 * valida la sesión y el rol de afiliado; la identidad del avalista se resuelve
 * en el servidor (userId → personId), nunca desde el cliente.
 */
export async function GET(request: NextRequest) {
  const user = await contextService.getCurrentUser();
  if (!user || user.status !== "ACTIVE" || user.mustChangePassword || !isAffiliateUser(user)) {
    return NextResponse.json({ success: false, message: "No autorizado." }, { status: 403 });
  }

  const parsed = querySchema.safeParse(
    Object.fromEntries(request.nextUrl.searchParams.entries()),
  );
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: "Filtros inválidos." }, { status: 400 });
  }

  const { page, pageSize, search, status, from, to } = parsed.data;

  try {
    const data = await new EndorsementHistoryService().getForUser(user.id, {
      page,
      pageSize,
      search: search?.length ? search : undefined,
      status,
      from: startOfDay(from),
      to: endOfDay(to),
    });
    return NextResponse.json({ success: true, data });
  } catch {
    return NextResponse.json(
      { success: false, message: "No fue posible consultar tus avales." },
      { status: 500 },
    );
  }
}
