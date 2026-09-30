import { EmailCampaignStatus } from "@prisma/client";
import { CampaignRepository } from "../Repositories/CampaignRepository";
import { isValidEmail } from "./Import/EmailProcessing";
import type { CampaignDetail, CampaignInput, CampaignListItem, CampaignRecipientPreview, CampaignRecipientSelection } from "../Models/Campaign";

export class CampaignServiceError extends Error {
  constructor(message: string, readonly status = 400, readonly fields: string[] = []) { super(message); }
}

export interface SetRecipientsInput {
  listIds: number[];
  recipientIds: number[];
}

export class CampaignService {
  constructor(private readonly repository = new CampaignRepository()) {}

  async listCampaigns(): Promise<CampaignListItem[]> {
    return this.repository.listCampaigns();
  }

  async getCampaign(id: number): Promise<CampaignDetail | null> {
    return this.repository.getCampaign(id);
  }

  async createCampaign(input: CampaignInput, actor: { userId: number; email: string }): Promise<{ id: number }> {
    if (!input.name.trim()) throw new CampaignServiceError("El nombre de la campaña es obligatorio.", 422, ["name"]);
    if (!input.subject.trim()) throw new CampaignServiceError("El asunto es obligatorio.", 422, ["subject"]);
    if (input.replyTo?.trim() && !isValidEmail(input.replyTo.trim())) {
      throw new CampaignServiceError("El correo Reply-To no tiene un formato válido.", 422, ["replyTo"]);
    }
    const created = await this.repository.createCampaign(input, actor.userId);
    await this.repository.writeAudit(actor, "CAMPAIGN_CREATED", created.id, input.name.trim());
    return created;
  }

  async updateCampaign(id: number, input: CampaignInput, actor: { userId: number; email: string }): Promise<void> {
    const campaign = await this.repository.getCampaign(id);
    if (!campaign) throw new CampaignServiceError("La campaña no existe.", 404);
    if (campaign.status !== EmailCampaignStatus.DRAFT) {
      throw new CampaignServiceError("Solo se puede editar una campaña en estado borrador.", 409);
    }
    if (!input.name.trim()) throw new CampaignServiceError("El nombre de la campaña es obligatorio.", 422, ["name"]);
    if (!input.subject.trim()) throw new CampaignServiceError("El asunto es obligatorio.", 422, ["subject"]);
    if (input.replyTo?.trim() && !isValidEmail(input.replyTo.trim())) {
      throw new CampaignServiceError("El correo Reply-To no tiene un formato válido.", 422, ["replyTo"]);
    }
    await this.repository.updateCampaign(id, input);
    await this.repository.writeAudit(actor, "CAMPAIGN_UPDATED", id, input.name.trim());
  }

  async getSelection(campaignId: number): Promise<CampaignRecipientSelection> {
    const data = await this.repository.getSelectionData();
    const selected = await this.repository.getCampaignRecipientIds(campaignId);
    return {
      lists: data.lists,
      recipients: data.recipients,
      selectedRecipientIds: selected,
      uniqueSelectedCount: selected.length,
    };
  }

  async setRecipients(campaignId: number, input: SetRecipientsInput, actor: { userId: number; email: string }): Promise<{ count: number }> {
    const campaign = await this.repository.getCampaign(campaignId);
    if (!campaign) throw new CampaignServiceError("La campaña no existe.", 404);
    if (campaign.status !== EmailCampaignStatus.DRAFT) {
      throw new CampaignServiceError("Solo se pueden modificar destinatarios en estado borrador.", 409);
    }
    const fromLists = await this.repository.getRecipientIdsByLists(input.listIds);
    const unique = Array.from(new Set([...fromLists, ...input.recipientIds]));
    return this.repository.setCampaignRecipients(campaignId, unique, actor, campaign.name);
  }

  async markReady(id: number, actor: { userId: number; email: string }): Promise<void> {
    const campaign = await this.repository.getCampaign(id);
    if (!campaign) throw new CampaignServiceError("La campaña no existe.", 404);
    if (campaign.status !== EmailCampaignStatus.DRAFT) {
      throw new CampaignServiceError("Solo se puede marcar como lista una campaña en borrador.", 409);
    }
    const missing: string[] = [];
    if (!campaign.name.trim()) missing.push("nombre");
    if (!campaign.subject.trim()) missing.push("asunto");
    if (!campaign.htmlContent.trim() && !(campaign.textContent ?? "").trim()) missing.push("contenido");
    if (campaign.recipientCount < 1) missing.push("destinatarios");
    if (missing.length > 0) {
      throw new CampaignServiceError(`Faltan: ${missing.join(", ")}.`, 422, missing);
    }
    await this.repository.setStatus(id, EmailCampaignStatus.READY);
    await this.repository.writeAudit(actor, "CAMPAIGN_READY", id, campaign.name, { recipientCount: campaign.recipientCount });
  }

  async backToDraft(id: number, actor: { userId: number; email: string }): Promise<void> {
    const campaign = await this.repository.getCampaign(id);
    if (!campaign) throw new CampaignServiceError("La campaña no existe.", 404);
    if (campaign.status !== EmailCampaignStatus.READY) {
      throw new CampaignServiceError("Solo se puede volver a borrador una campaña lista.", 409);
    }
    await this.repository.setStatus(id, EmailCampaignStatus.DRAFT);
    await this.repository.writeAudit(actor, "CAMPAIGN_UPDATED", id, campaign.name, { status: "DRAFT" });
  }

  async cancel(id: number, actor: { userId: number; email: string }): Promise<void> {
    const campaign = await this.repository.getCampaign(id);
    if (!campaign) throw new CampaignServiceError("La campaña no existe.", 404);
    if (campaign.status !== EmailCampaignStatus.DRAFT && campaign.status !== EmailCampaignStatus.READY) {
      throw new CampaignServiceError("No se puede cancelar una campaña en este estado.", 409);
    }
    await this.repository.setStatus(id, EmailCampaignStatus.CANCELLED);
    await this.repository.writeAudit(actor, "CAMPAIGN_CANCELLED", id, campaign.name);
  }

  async getPreviewRecipients(campaignId: number): Promise<CampaignRecipientPreview[]> {
    return this.repository.getCampaignRecipientsForPreview(campaignId);
  }
}
