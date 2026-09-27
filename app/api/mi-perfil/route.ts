import { NextResponse } from "next/server";
import { contextService } from "@/modules/auth/context/service";
import { internalProfileUpdateSchema } from "@/modules/profile/DTOs/internal-profile.schema";
import { InternalProfileService } from "@/modules/profile/Services/InternalProfileService";

const allowedFormFields = new Set(["phone", "avatar"]);

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "No fue posible actualizar el perfil.";
  return NextResponse.json({ success: false, message }, { status: 400 });
}

export async function GET() {
  try {
    const user = await contextService.requireAdministrativeUser();
    const data = await new InternalProfileService().getForCurrentUser(user.id);
    return NextResponse.json({ success: true, data });
  } catch {
    return NextResponse.json({ success: false, message: "No autorizado." }, { status: 403 });
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await contextService.requireAdministrativeUser();
    const formData = await request.formData();
    for (const key of formData.keys()) if (!allowedFormFields.has(key)) return errorResponse(new Error("El formulario contiene campos no permitidos."));

    const input = internalProfileUpdateSchema.parse({ phone: formData.get("phone") });
    const avatar = formData.get("avatar");
    if (avatar !== null && !(avatar instanceof File)) return errorResponse(new Error("El avatar no es válido."));

    const data = await new InternalProfileService().updateForCurrentUser(user.id, input, avatar);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return errorResponse(error);
  }
}
