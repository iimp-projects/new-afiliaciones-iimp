import { NextResponse } from "next/server";
import { requireApiPermission } from "@/modules/auth/context/api-authorization";
import { contextService } from "@/modules/auth/context/service";
import { getAppBaseUrl } from "@/lib/config/env";
import { validateAccessSchema } from "@/modules/afiliaciones/control-accesos/Validators/access.schemas";
import { accessValidationService } from "@/modules/afiliaciones/control-accesos/Services/AccessValidationService";
import { accessRequestKey, accessScanRateLimiter } from "@/modules/afiliaciones/control-accesos/Services/accessRateLimiter";
import { accessApiError } from "@/modules/afiliaciones/control-accesos/Utils/apiError";

export async function POST(request: Request) {
  try {
    const user = await requireApiPermission("operate", "access_control");
    const decision = accessScanRateLimiter.consume(accessRequestKey(request, user.id), 60, 60_000);
    if (!decision.allowed) {
      return NextResponse.json(
        { success: false, message: "Demasiadas solicitudes. Espere un momento." },
        { status: 429, headers: { "Retry-After": String(Math.ceil(decision.retryAfterMs / 1000)) } },
      );
    }

    const body = await request.json().catch(() => null);
    const parsed = validateAccessSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, message: "Datos inválidos.", errors: parsed.error.flatten() }, { status: 400 });
    }

    const canManage = await contextService.hasPermission("manage", "access_control");
    const data = await accessValidationService.validate(parsed.data, {
      userId: user.id,
      canManage,
      allowedBaseUrls: [getAppBaseUrl(process.env, { allowDevDefault: true })],
    });

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return accessApiError(error);
  }
}
