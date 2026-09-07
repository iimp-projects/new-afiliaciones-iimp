import { createSystemSettingValueSchema } from "@/modules/security/system-settings/DTOs/SystemSettingsDTO";
import { requireSystemSettingsSuperAdmin, systemSettingsErrorResponse } from "@/modules/security/system-settings/Api/SystemSettingsAdminApi";
import { SystemSettingsService } from "@/modules/security/system-settings/Services/SystemSettingsService";

export async function POST(request: Request, context: { params: Promise<{ key: string }> }) {
  try {
    const user = await requireSystemSettingsSuperAdmin();
    const { key } = await context.params;
    const body = createSystemSettingValueSchema.parse(await request.json());
    const value = await new SystemSettingsService().createValue({ ...body, key, updatedById: user.id });
    return Response.json({ success: true, data: value }, { status: 201 });
  } catch (error) {
    return systemSettingsErrorResponse(error);
  }
}
