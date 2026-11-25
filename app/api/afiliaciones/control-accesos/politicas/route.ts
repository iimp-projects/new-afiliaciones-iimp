import { NextResponse } from "next/server";
import { requireApiPermission } from "@/modules/auth/context/api-authorization";
import { policySchema } from "@/modules/afiliaciones/control-accesos/Validators/access.schemas";
import { accessQueryService } from "@/modules/afiliaciones/control-accesos/Services/AccessQueryService";
import { prismaAccessRepository } from "@/modules/afiliaciones/control-accesos/Repositories/PrismaAccessRepository";
import { accessApiError } from "@/modules/afiliaciones/control-accesos/Utils/apiError";

export async function GET() {
  try {
    await requireApiPermission("read", "access_control");
    const data = await accessQueryService.policies();
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return accessApiError(error);
  }
}

export async function PUT(request: Request) {
  try {
    await requireApiPermission("manage", "access_control");
    const body = await request.json().catch(() => null);
    const parsed = policySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, message: "Datos inválidos.", errors: parsed.error.flatten() }, { status: 400 });
    }
    const data = await prismaAccessRepository.upsertPolicy({
      siteId: parsed.data.siteId,
      name: parsed.data.name,
      allowedMembershipCategories: parsed.data.allowedMembershipCategories ?? null,
      requireActiveMembership: parsed.data.requireActiveMembership,
      requireValidCard: parsed.data.requireValidCard,
      quotaRestrictionEnabled: parsed.data.quotaRestrictionEnabled,
      maxPendingQuotas: parsed.data.maxPendingQuotas ?? null,
      allowManualLookup: parsed.data.allowManualLookup,
    });
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return accessApiError(error);
  }
}
