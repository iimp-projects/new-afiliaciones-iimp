import { contextService } from "@/modules/auth/context/service";
import { EmailCampaignService } from "@/modules/communications/Services/EmailCampaignService";
import { CampaignService } from "@/modules/communications/Services/CampaignService";
import { RecipientRepository } from "@/modules/communications/Repositories/RecipientRepository";
import { CorreosMasivosView } from "@/modules/communications/Views/CorreosMasivosView";

export const metadata = { title: "Correos Masivos | Intranet IIMP" };

export default async function CorreosMasivosPage() {
  await contextService.requireRole(["SUPER_ADMIN"]);
  const [overview, campaigns, recipients, lists] = await Promise.all([
    new EmailCampaignService().getOverview(),
    new CampaignService().listCampaigns(),
    new RecipientRepository().listRecipients(),
    new RecipientRepository().listLists(),
  ]);
  return <CorreosMasivosView overview={overview} campaigns={campaigns} recipients={recipients} lists={lists} />;
}
