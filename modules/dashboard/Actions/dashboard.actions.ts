"use server";

import { contextService } from "@/modules/auth/context/service";
import { DashboardService } from "../Services/DashboardService";

export async function fetchDashboardStats() {
  try {
    const user = await contextService.getCurrentUser();
    if (!user) throw new Error("No autorizado");

    const data = await DashboardService.getDashboardData(user.role.id, user.role.slug);
    return { success: true, data };
  } catch (error: any) {
    console.error("[Dashboard Action Error]:", error);
    return { success: false, message: "Error al cargar las métricas." };
  }
}