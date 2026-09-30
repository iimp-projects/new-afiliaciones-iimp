import type { EmailCampaignStatus, EmailSendStatus } from "@prisma/client";

export interface EmailCampaignSummary {
  id: number;
  name: string;
  subject: string;
  status: EmailCampaignStatus;
  createdAt: string;
  updatedAt: string;
}

export interface EmailOverview {
  campaigns: number;
  recipients: number;
  sent: number;
  pending: number;
  errors: number;
  recent: EmailCampaignSummary[];
}

export type { EmailCampaignStatus, EmailSendStatus };
