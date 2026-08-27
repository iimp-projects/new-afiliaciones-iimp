"use server";

import { contextService } from "@/modules/auth/context/service";
import { AreaActivityService } from "../Services/AreaActivityService";

export interface AreaActivityParams {
  areaFilter: string;
  periodFilter: string;
  aggregation: string;
  dateFrom?: string;
  dateTo?: string;
}

export async function fetchAreaActivityAction(params: AreaActivityParams) {
  try {
    const user = await contextService.getCurrentUser();
    if (!user) throw new Error("No autorizado");

    const service = new AreaActivityService();
    const data = await service.getAreaActivityMetrics(params);

    return { success: true, data };
  } catch (error: any) {
    console.error("[AreaActivity Action Error]:", error);
    return { success: false, message: "Error al cargar la actividad del área." };
  }
}