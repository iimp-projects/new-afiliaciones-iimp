"use server";

import { revalidatePath } from "next/cache";
import { contextService } from "@/modules/auth/context/service";
import { CampaignService, CampaignServiceError, type SetRecipientsInput } from "../Services/CampaignService";
import type { CampaignInput } from "../Models/Campaign";

async function requireActor(): Promise<{ userId: number; email: string }> {
  await contextService.requireRole(["SUPER_ADMIN"]);
  const user = await contextService.getCurrentUser();
  if (!user) throw new CampaignServiceError("No autorizado.", 403);
  return { userId: user.id, email: user.email };
}

function failure(error: unknown): { success: false; message: string; fields?: string[]; status?: number } {
  if (error instanceof CampaignServiceError) {
    return { success: false, message: error.message, fields: error.fields, status: error.status };
  }
  return { success: false, message: error instanceof Error ? error.message : "No se pudo completar la operación." };
}

export async function createCampaignAction(input: CampaignInput): Promise<{ success: true; id: number } | { success: false; message: string; fields?: string[]; status?: number }> {
  try {
    const actor = await requireActor();
    const created = await new CampaignService().createCampaign(input, actor);
    revalidatePath("/intranet/correos-masivos");
    return { success: true, id: created.id };
  } catch (error) {
    return failure(error);
  }
}

export async function updateCampaignAction(id: number, input: CampaignInput): Promise<{ success: true } | { success: false; message: string; fields?: string[]; status?: number }> {
  try {
    const actor = await requireActor();
    await new CampaignService().updateCampaign(id, input, actor);
    revalidatePath("/intranet/correos-masivos");
    revalidatePath(`/intranet/correos-masivos/campanas/${id}`);
    return { success: true };
  } catch (error) {
    return failure(error);
  }
}

export async function setCampaignRecipientsAction(campaignId: number, input: SetRecipientsInput): Promise<{ success: true; count: number } | { success: false; message: string; status?: number }> {
  try {
    const actor = await requireActor();
    const result = await new CampaignService().setRecipients(campaignId, input, actor);
    revalidatePath(`/intranet/correos-masivos/campanas/${campaignId}`);
    return { success: true, count: result.count };
  } catch (error) {
    return failure(error);
  }
}

export async function markCampaignReadyAction(id: number): Promise<{ success: true } | { success: false; message: string; fields?: string[]; status?: number }> {
  try {
    const actor = await requireActor();
    await new CampaignService().markReady(id, actor);
    revalidatePath(`/intranet/correos-masivos/campanas/${id}`);
    return { success: true };
  } catch (error) {
    return failure(error);
  }
}

export async function backToDraftAction(id: number): Promise<{ success: true } | { success: false; message: string; status?: number }> {
  try {
    const actor = await requireActor();
    await new CampaignService().backToDraft(id, actor);
    revalidatePath(`/intranet/correos-masivos/campanas/${id}`);
    return { success: true };
  } catch (error) {
    return failure(error);
  }
}

export async function cancelCampaignAction(id: number): Promise<{ success: true } | { success: false; message: string; status?: number }> {
  try {
    const actor = await requireActor();
    await new CampaignService().cancel(id, actor);
    revalidatePath(`/intranet/correos-masivos/campanas/${id}`);
    return { success: true };
  } catch (error) {
    return failure(error);
  }
}
