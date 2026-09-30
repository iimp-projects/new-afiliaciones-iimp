"use server";

import { contextService } from "@/modules/auth/context/service";
import { RecipientRepository } from "../Repositories/RecipientRepository";
import type { RecipientDetail } from "../Models/Recipient";

export async function fetchRecipientDetailAction(id: number): Promise<RecipientDetail | null> {
  await contextService.requireRole(["SUPER_ADMIN"]);
  return new RecipientRepository().getRecipientDetail(id);
}
