import { notFound } from "next/navigation";
import { contextService } from "@/modules/auth/context/service";
import { getSmtpConfig } from "@/lib/config/env";
import { CampaignService } from "@/modules/communications/Services/CampaignService";
import { CampaignSendService } from "@/modules/communications/Services/CampaignSendService";
import { EmailDeliveryRepository } from "@/modules/communications/Repositories/EmailDeliveryRepository";
import { CampaignWorkspace } from "@/modules/communications/Views/CampaignWorkspace";

export const metadata = { title: "Campaña | Correos Masivos | Intranet IIMP" };

export default async function CampanaPage({ params }: { params: Promise<{ id: string }> }) {
  await contextService.requireRole(["SUPER_ADMIN"]);
  const { id } = await params;
  const campaignId = Number(id);
  if (!Number.isInteger(campaignId) || campaignId <= 0) notFound();

  const service = new CampaignService();
  const deliveryRepository = new EmailDeliveryRepository();
  const [campaign, selection, previewRecipients, campaignRecipients, stats] = await Promise.all([
    service.getCampaign(campaignId),
    service.getSelection(campaignId),
    service.getPreviewRecipients(campaignId),
    deliveryRepository.getCampaignRecipientsForWorkspace(campaignId),
    deliveryRepository.getCampaignStats(campaignId),
  ]);
  if (!campaign) notFound();

  let senderEmail: string | null = null;
  try {
    senderEmail = getSmtpConfig(process.env).from;
  } catch {
    senderEmail = campaign.senderEmail;
  }

  const sendProgress = await new CampaignSendService().getProgress(campaignId);
  const initialPause = { paused: sendProgress.paused, pauseReason: sendProgress.pauseReason, resumeAt: sendProgress.resumeAt };

  return <CampaignWorkspace campaign={campaign} selection={selection} previewRecipients={previewRecipients} campaignRecipients={campaignRecipients} stats={stats} senderEmail={senderEmail} initialPause={initialPause} />;
}
