import { ExpedienteRepository } from "../Repositories/ExpedienteRepository";
import type { 
  SmartCaseCardData, 
  AtomicValidation, 
  PrimaryBadgeIcon 
} from "@/modules/shared/Components/SmartCaseCard/types";

export class GetExpedientesService {
  constructor(private readonly repository: ExpedienteRepository) {}

  // Utilidad nativa para no usar librerías externas como date-fns
  private getRelativeTime(date: Date): string {
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diffInSeconds < 60) return "Hace un momento";
    
    const diffInMinutes = Math.floor(diffInSeconds / 60);
    if (diffInMinutes < 60) return `Hace ${diffInMinutes} min`;
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `Hace ${diffInHours} horas`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays === 1) return "Ayer";
    
    return `Hace ${diffInDays} días`;
  }

  async execute(params: { page: number; pageSize: number; search?: string; status?: string }) {
    const { total, page, pageSize, totalPages, records } = await this.repository.getPaginated(params);

    const items: SmartCaseCardData[] = records.map((app) => {
      // 1. NOMBRES E IDENTIDAD
      const fullName = app.person ? `${app.person.firstName} ${app.person.paternalLastName} ${app.person.maternalLastName || ""}`.trim() : "Postulante Desconocido";
      const initials = app.person ? `${app.person.firstName[0]}${app.person.paternalLastName[0]}` : "XX";
      const isStudent = app.affiliateType === "STUDENT";
      const avatarUrl = app.documents.length > 0 ? app.documents[0].fileUrl : null;

      // 2. PRIMARY BADGE (ESTADO PRINCIPAL / PAGO)
      let primaryBadge = { label: "EN PROCESO", icon: "clock" as PrimaryBadgeIcon, colorClass: "text-blue-700 bg-blue-50 border-blue-200" };
      const lastPayment = app.payments[0];

      if (app.status === "OBSERVED" || app.observations.length > 0) {
        primaryBadge = { label: "OBSERVADO", icon: "error", colorClass: "text-red-700 bg-red-50 border-red-200" };
      } else if (lastPayment?.status === "PAID" || app.status === "APPROVED") {
        primaryBadge = { label: "PAGADO", icon: "check", colorClass: "text-emerald-700 bg-emerald-50 border-emerald-200" };
      } else if (lastPayment?.status === "PENDING" || app.status === "UNDER_EVALUATION") {
        primaryBadge = { label: "PENDIENTE", icon: "clock", colorClass: "text-amber-700 bg-amber-50 border-amber-200" };
      }

      // 3. VALIDACIONES ATÓMICAS (LOG, ASI, COM, TES)
      const atomicValidations: AtomicValidation[] = [
        { label: "LOG", status: app.currentStep >= 3 ? "check" : "pending" },
        { label: "ASI", status: isStudent ? "dash" : (app.approvals.every(a => a.status === "APPROVED") && app.approvals.length > 0 ? "check" : "pending") },
        { label: "COM", status: app.status === "APPROVED" ? "check" : (app.status === "UNDER_EVALUATION" ? "pending" : "dash") },
        { label: "TES", status: lastPayment?.status === "PAID" ? "check" : "pending" },
      ];

      return {
        id: app.id,
        trackingCode: app.applicationCode,
        identity: {
          title: fullName,
          subtitle: `${app.documentType} • ${app.documentNumber}`,
          avatarUrl,
          fallbackInitials: initials,
          categoryBadge: {
            label: isStudent ? "ESTUDIANTE" : "ASOCIADO ACTIVO",
            colorClass: isStudent ? "bg-[#3b82f6]" : "bg-[#e29b38]",
          }
        },
        primaryBadge,
        workflow: { currentStepIndex: app.currentStep, steps: [] }, 
        atomicValidations,
        metadata: {
          priority: app.observations.length > 0 ? "critical" : "medium",
          lastUpdatedRelative: this.getRelativeTime(app.updatedAt),
          assignedTo: { name: "SIN ASIGNAR", initial: "-" }
        },
        allowedActions: ["VIEW"],
      };
    });

    return { items, meta: { total, page, pageSize, totalPages } };
  }
}