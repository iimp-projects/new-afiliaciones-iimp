import { EmailSendStatus } from "@prisma/client";
import { EmailCampaignRepository } from "../Repositories/EmailCampaignRepository";
import type { EmailOverview } from "../Models/EmailCampaign";

export class EmailCampaignService {
  constructor(private readonly repository = new EmailCampaignRepository()) {}

  async getOverview(): Promise<EmailOverview> {
    const [campaigns, recipients, sent, pending, errors, recent] = await Promise.all([
      this.repository.countCampaigns(),
      this.repository.countRecipients(),
      this.repository.countDeliveriesByStatus(EmailSendStatus.SENT),
      this.repository.countDeliveriesByStatus(EmailSendStatus.PENDING),
      this.repository.countDeliveriesByStatus(EmailSendStatus.ERROR),
      this.repository.listRecent(5),
    ]);

    return { campaigns, recipients, sent, pending, errors, recent };
  }
}
