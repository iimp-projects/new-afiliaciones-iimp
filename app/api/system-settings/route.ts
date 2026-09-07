import { requireSystemSettingsSuperAdmin, systemSettingsErrorResponse } from "@/modules/security/system-settings/Api/SystemSettingsAdminApi";
import { SystemSettingsService } from "@/modules/security/system-settings/Services/SystemSettingsService";
import { PaymentConfigurationHealthService } from "@/modules/security/system-settings/Services/PaymentConfigurationHealthService";

export async function GET() {
  try {
    await requireSystemSettingsSuperAdmin();
    const [settings, health] = await Promise.all([
      new SystemSettingsService().listSettings(),
      new PaymentConfigurationHealthService().getHealth(),
    ]);
    const configuredEnvironment = process.env.PAYMENT_ENVIRONMENT?.toUpperCase();
    const environment = configuredEnvironment === "PRODUCTION" ? "PRODUCTION" : "TEST";
    return Response.json({ success: true, data: settings, environment, health });
  } catch (error) {
    return systemSettingsErrorResponse(error);
  }
}
