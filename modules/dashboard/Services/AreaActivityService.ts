import { AreaActivityRepository } from "../Repositories/AreaActivityRepository";
import { ValidationAction } from "@prisma/client";
import { S3StorageService } from "@/modules/shared/Services/S3StorageService";

export class AreaActivityService {
  private repository = new AreaActivityRepository();

  async getAreaActivityMetrics(params: { areaFilter: string, periodFilter: string, aggregation: string, dateFrom?: string, dateTo?: string }) {
    const { areaFilter, periodFilter, aggregation, dateFrom, dateTo } = params;

    // 1. MAPEO DE ÁREAS
    let departmentCodes: string[] = [];
    if (areaFilter === "Asociados") departmentCodes = ["ASOCIADOS"];
    else if (areaFilter === "Comite") departmentCodes = ["COMITE"];
    else if (areaFilter === "Logistica") departmentCodes = ["LOGISTICA"];
    else if (areaFilter === "Legal") departmentCodes = ["LEGAL"];
    else if (areaFilter === "Comunicaciones") departmentCodes = ["COMUNICACIONES"];
    else departmentCodes = ["ASOCIADOS", "COMITE", "LOGISTICA", "LEGAL", "COMUNICACIONES"];

    // 2. CÁLCULO DE RANGOS DE FECHA
    let startDate = new Date();
    let endDate = new Date();
    endDate.setHours(23, 59, 59, 999);

    if (periodFilter === "Hoy") {
      startDate.setHours(0, 0, 0, 0);
    } else if (periodFilter === "Últimos 7 días") {
      startDate.setDate(startDate.getDate() - 6);
      startDate.setHours(0, 0, 0, 0);
    } else if (periodFilter === "Últimos 30 días") {
      startDate.setDate(startDate.getDate() - 29);
      startDate.setHours(0, 0, 0, 0);
    } else if (periodFilter === "Este mes") {
      startDate = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
    } else if (periodFilter === "Histórico") {
      startDate.setFullYear(startDate.getFullYear() - 5); // 5 años atrás
    } else if (periodFilter === "Personalizado" && dateFrom && dateTo) {
      startDate = new Date(`${dateFrom}T00:00:00.000Z`);
      endDate = new Date(`${dateTo}T23:59:59.999Z`);
    }

    // Fecha previa para comparar crecimiento
    const timeDiff = endDate.getTime() - startDate.getTime();
    const previousStartDate = new Date(startDate.getTime() - timeDiff);

    // 3. CONSULTA A BASE DE DATOS
    const rawHistory = await this.repository.getValidationHistory(departmentCodes, previousStartDate);
    const currentHistory = rawHistory.filter(h => h.createdAt >= startDate && h.createdAt <= endDate);
    const previousHistory = rawHistory.filter(h => h.createdAt < startDate);

    // 4. CONSTRUCCIÓN DE LOS "BINS" (Eje X dinámico)
    const dailyMap = new Map<string, any>();
    let currDate = new Date(startDate);

    while (currDate <= endDate) {
      let key = "";
      if (aggregation === "Mensual") {
        key = currDate.toLocaleDateString("es-PE", { month: "short", year: "numeric" });
        currDate.setMonth(currDate.getMonth() + 1);
      } else if (aggregation === "Anual") {
        key = currDate.toLocaleDateString("es-PE", { year: "numeric" });
        currDate.setFullYear(currDate.getFullYear() + 1);
      } else {
        // Diario
        key = currDate.toLocaleDateString("es-PE", { day: "2-digit", month: "short" });
        currDate.setDate(currDate.getDate() + 1);
      }
      
      if (!dailyMap.has(key)) {
        dailyMap.set(key, { date: key, aprobados: 0, observados: 0, revisados: 0, rechazados: 0, subsanados: 0 });
      }
    }

    const mapActionToState = (action: ValidationAction) => {
      switch (action) {
        case ValidationAction.APPROVED: return "aprobados";
        case ValidationAction.OBSERVED: return "observados";
        case ValidationAction.START_REVIEW: return "revisados";
        case ValidationAction.REJECTED: return "rechazados";
        case ValidationAction.SUBMITTED_CORRECTION:
        case ValidationAction.REOPENED: return "subsanados";
        default: return "revisados";
      }
    };

    const prevUserTotals = new Map<number, number>();
    previousHistory.forEach(h => {
      if (h.userId) prevUserTotals.set(h.userId, (prevUserTotals.get(h.userId) || 0) + 1);
    });

    const s3Service = new S3StorageService();
    const usersMap = new Map<number, any>();

    // 5. POBLAR DATA
    for (const h of currentHistory) {
      if (!h.userId || !h.user) continue;

      const userId = h.userId;
      
      // Determinar la llave del Eje X para este registro
      let dateKey = "";
      if (aggregation === "Mensual") dateKey = h.createdAt.toLocaleDateString("es-PE", { month: "short", year: "numeric" });
      else if (aggregation === "Anual") dateKey = h.createdAt.toLocaleDateString("es-PE", { year: "numeric" });
      else dateKey = h.createdAt.toLocaleDateString("es-PE", { day: "2-digit", month: "short" });

      const actionState = mapActionToState(h.action);

      if (dailyMap.has(dateKey)) {
        const dayData = dailyMap.get(dateKey);
        dayData[actionState] += 1;
        dayData[`user${userId}`] = (dayData[`user${userId}`] || 0) + 1; 
      }

      if (!usersMap.has(userId)) {
        let finalAvatarUrl = null;
        if (h.user.image) {
          try { finalAvatarUrl = await s3Service.getPresignedUrl(h.user.image); } 
          catch (e) { finalAvatarUrl = h.user.image; }
        }

        const firstName = h.user.person?.firstName || "";
        const lastName = h.user.person?.paternalLastName || "";
        
        usersMap.set(userId, {
          id: userId,
          name: `${firstName} ${lastName}`.trim() || "Administrador",
          area: h.user.role?.name || "Administrador", 
          avatar: finalAvatarUrl, 
          total: 0,
          growth: 0,
          status: h.user.status === 'ACTIVE' ? 'online' : 'offline', 
          history: Array(7).fill(0) 
        });
      }

      const user = usersMap.get(userId);
      user.total += 1;
      
      const diffDays = Math.floor((new Date().getTime() - h.createdAt.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays >= 0 && diffDays < 7) {
        user.history[6 - diffDays] += 1; 
      }
    }

    const responsables = Array.from(usersMap.values()).map(user => {
      const prevTotal = prevUserTotals.get(user.id) || 0;
      user.growth = prevTotal === 0 ? (user.total > 0 ? 100 : 0) : Number((((user.total - prevTotal) / prevTotal) * 100).toFixed(1));
      return user;
    });

    responsables.sort((a, b) => b.total - a.total);

    return {
      responsables,
      dailyActivity: Array.from(dailyMap.values())
    };
  }
}