"use server";

import { revalidatePath } from "next/cache";
import { contextService } from "@/modules/auth/context/service";
import { RecipientRepository } from "../Repositories/RecipientRepository";
import { RecipientListError, RecipientListService } from "../Services/RecipientListService";
import type { RecipientDetail } from "../Models/Recipient";

async function requireActor(): Promise<{ userId: number; email: string }> {
  await contextService.requireRole(["SUPER_ADMIN"]);
  const user = await contextService.getCurrentUser();
  if (!user) throw new RecipientListError("No autorizado.", 403);
  return { userId: user.id, email: user.email };
}

function failure(error: unknown): { success: false; message: string; status?: number } {
  if (error instanceof RecipientListError) return { success: false, message: error.message, status: error.status };
  return { success: false, message: error instanceof Error ? error.message : "No se pudo completar la operación." };
}

export async function fetchRecipientDetailAction(id: number): Promise<RecipientDetail | null> {
  await contextService.requireRole(["SUPER_ADMIN"]);
  return new RecipientRepository().getRecipientDetail(id);
}

export async function renameRecipientListAction(id: number, name: string): Promise<{ success: true } | { success: false; message: string; status?: number }> {
  try {
    const actor = await requireActor();
    await new RecipientListService().renameList(id, name, actor);
    revalidatePath("/intranet/correos-masivos");
    return { success: true };
  } catch (error) {
    return failure(error);
  }
}

export async function deleteRecipientListAction(id: number): Promise<{ success: true } | { success: false; message: string; status?: number }> {
  try {
    const actor = await requireActor();
    await new RecipientListService().deleteList(id, actor);
    revalidatePath("/intranet/correos-masivos");
    return { success: true };
  } catch (error) {
    return failure(error);
  }
}
