import { AuthorizationError } from "../../../auth/errors";
import { contextService } from "../../../auth/context/service";
import { ZodError } from "zod";
import { SystemSettingsError } from "../Services/SystemSettingsService";

export async function requireSystemSettingsSuperAdmin() {
  const user = await contextService.getCurrentUser();
  if (!user || user.role.slug !== "SUPER_ADMIN") {
    throw new AuthorizationError("Se requiere el rol SUPER_ADMIN.");
  }
  return user;
}

export function systemSettingsErrorResponse(error: unknown) {
  if (error instanceof AuthorizationError) {
    return Response.json({ success: false, message: "No autorizado." }, { status: 403 });
  }
  if (error instanceof ZodError) {
    return Response.json({ success: false, message: "Solicitud inválida.", errors: error.flatten() }, { status: 400 });
  }
  if (error instanceof SystemSettingsError) {
    return Response.json({ success: false, message: error.message }, { status: error.status });
  }
  console.error("[SystemSettings API Error]", error);
  return Response.json({ success: false, message: "Error interno del servidor." }, { status: 500 });
}

export function parsePositiveId(value: string) {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) throw new SystemSettingsError("Identificador inválido.");
  return id;
}
