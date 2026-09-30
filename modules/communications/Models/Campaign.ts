import type { EmailCampaignStatus } from "@prisma/client";

export interface CampaignListItem {
  id: number;
  name: string;
  subject: string;
  status: EmailCampaignStatus;
  recipientCount: number;
  createdAt: string;
}

export interface CampaignDetail {
  id: number;
  name: string;
  subject: string;
  senderName: string | null;
  senderEmail: string | null;
  replyTo: string | null;
  htmlContent: string;
  textContent: string | null;
  status: EmailCampaignStatus;
  createdAt: string;
  updatedAt: string;
  createdBy: number | null;
  createdByName: string | null;
  recipientCount: number;
}

export interface CampaignInput {
  name: string;
  subject: string;
  senderName?: string | null;
  senderEmail?: string | null;
  replyTo?: string | null;
  htmlContent: string;
  textContent?: string | null;
}

export interface CampaignRecipientSelection {
  lists: Array<{ id: number; name: string; memberCount: number }>;
  recipients: Array<{ id: number; email: string; name: string | null; company: string | null; listIds: number[]; listNames: string[] }>;
  selectedRecipientIds: number[];
  uniqueSelectedCount: number;
}

export interface CampaignRecipientPreview {
  id: number;
  email: string;
  name: string | null;
  company: string | null;
  position: string | null;
}
