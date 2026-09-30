"use server";

import { revalidatePath } from "next/cache";
import { contextService } from "@/modules/auth/context/service";
import { verificationTokenRateLimiter } from "@/modules/auth/rate-limit/VerificationTokenRateLimiter";
import { CampaignMailError, CampaignMailService } from "../Services/CampaignMailService";
import { CampaignSendService } from "../Services/CampaignSendService";
import { EmailDeliveryRepository, type DeliveryView } from "../Repositories/EmailDeliveryRepository";
import type { CampaignSendProgress } from "../Models/CampaignSend";

async function requireActor(): Promise<{ userId: number; email: string }> {
  await contextService.requireRole(["SUPER_ADMIN"]);
  const user = await contextService.getCurrentUser();
  if (!user) throw new CampaignMailError("No autorizado.", 403);
  return { userId: user.id, email: user.email };
}

function failure(error: unknown): { success: false; message: string; status?: number; code?: string } {
  if (error instanceof CampaignMailError) return { success: false, message: error.message, status: error.status, code: error.code };
  return { success: false, message: error instanceof Error ? error.message : "No se pudo completar la operación." };
}

export async function sendTestEmailAction(
  campaignId: number,
  toEmail: string,
  referenceRecipientId: number | null,
): Promise<{ success: true } | { success: false; message: string; status?: number; code?: string }> {
  try {
    const actor = await requireActor();
    const allowed = await verificationTokenRateLimiter.consume("campaign-test-email", `${actor.userId}:${campaignId}`, 10, 15);
    if (!allowed) return { success: false, message: "Has realizado demasiados envíos de prueba. Espera unos minutos e inténtalo nuevamente.", status: 429 };
    await new CampaignMailService().sendTest(campaignId, toEmail, referenceRecipientId, actor);
    return { success: true };
  } catch (error) {
    return failure(error);
  }
}

export async function sendIndividualEmailAction(
  campaignId: number,
  recipientId: number,
): Promise<{ success: true } | { success: false; message: string; status?: number; code?: string }> {
  try {
    const actor = await requireActor();
    await new CampaignMailService().sendIndividual(campaignId, recipientId, actor);
    revalidatePath(`/intranet/correos-masivos/campanas/${campaignId}`);
    return { success: true };
  } catch (error) {
    return failure(error);
  }
}

export async function fetchDeliveryHistoryAction(campaignId: number, recipientId: number): Promise<DeliveryView[]> {
  await contextService.requireRole(["SUPER_ADMIN"]);
  return new EmailDeliveryRepository().listDeliveries(campaignId, recipientId);
}

export async function startCampaignSendAction(campaignId: number): Promise<{ success: true; recipientCount: number } | { success: false; message: string; status?: number; code?: string }> {
  try {
    const actor = await requireActor();
    const result = await new CampaignSendService().start(campaignId, actor);
    revalidatePath("/intranet/correos-masivos");
    revalidatePath(`/intranet/correos-masivos/campanas/${campaignId}`);
    return { success: true, recipientCount: result.recipientCount };
  } catch (error) {
    return failure(error);
  }
}

export async function processCampaignBatchAction(campaignId: number): Promise<{ success: true; progress: CampaignSendProgress; processedThisBatch: number; finished: boolean } | { success: false; message: string; status?: number; code?: string }> {
  try {
    const actor = await requireActor();
    const result = await new CampaignSendService().processBatch(campaignId, actor);
    revalidatePath(`/intranet/correos-masivos/campanas/${campaignId}`);
    return { success: true, progress: result.progress, processedThisBatch: result.processedThisBatch, finished: result.finished };
  } catch (error) {
    return failure(error);
  }
}

export async function retryCampaignFailedAction(campaignId: number): Promise<{ success: true; retryCount: number } | { success: false; message: string; status?: number; code?: string }> {
  try {
    const actor = await requireActor();
    const result = await new CampaignSendService().retryFailed(campaignId, actor);
    revalidatePath("/intranet/correos-masivos");
    revalidatePath(`/intranet/correos-masivos/campanas/${campaignId}`);
    return { success: true, retryCount: result.retryCount };
  } catch (error) {
    return failure(error);
  }
}

export async function getCampaignSendProgressAction(campaignId: number): Promise<{ success: true; progress: CampaignSendProgress } | { success: false; message: string; status?: number }> {
  try {
    await contextService.requireRole(["SUPER_ADMIN"]);
    const progress = await new CampaignSendService().getProgress(campaignId);
    return { success: true, progress };
  } catch (error) {
    return failure(error);
  }
}

export async function recoverStaleCampaignAction(campaignId: number): Promise<{ success: true; recovered: boolean } | { success: false; message: string; status?: number; code?: string }> {
  try {
    const actor = await requireActor();
    const result = await new CampaignSendService().recoverStaleCampaign(campaignId, actor);
    revalidatePath(`/intranet/correos-masivos/campanas/${campaignId}`);
    return { success: true, recovered: result.recovered };
  } catch (error) {
    return failure(error);
  }
}
