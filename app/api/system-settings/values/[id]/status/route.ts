import { updateSystemSettingValueStatusSchema } from "@/modules/security/system-settings/DTOs/SystemSettingsDTO";
import { parsePositiveId, requireSystemSettingsSuperAdmin, systemSettingsErrorResponse } from "@/modules/security/system-settings/Api/SystemSettingsAdminApi";
import { SystemSettingsService } from "@/modules/security/system-settings/Services/SystemSettingsService";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireSystemSettingsSuperAdmin();
    const { id: rawId } = await context.params;
    const id = parsePositiveId(rawId);
    const { isActive } = updateSystemSettingValueStatusSchema.parse(await request.json());
    const value = await new SystemSettingsService().setValueStatus(id, isActive, user.id);
    return Response.json({ success: true, data: value });
  } catch (error) {
    return systemSettingsErrorResponse(error);
  }
}
