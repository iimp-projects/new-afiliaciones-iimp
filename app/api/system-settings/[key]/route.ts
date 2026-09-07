import { requireSystemSettingsSuperAdmin, systemSettingsErrorResponse } from "@/modules/security/system-settings/Api/SystemSettingsAdminApi";
import { SystemSettingsService } from "@/modules/security/system-settings/Services/SystemSettingsService";

export async function GET(_request: Request, context: { params: Promise<{ key: string }> }) {
  try {
    await requireSystemSettingsSuperAdmin();
    const { key } = await context.params;
    const setting = await new SystemSettingsService().getSettingDetail(key);
    return Response.json({ success: true, data: setting });
  } catch (error) {
    return systemSettingsErrorResponse(error);
  }
}
