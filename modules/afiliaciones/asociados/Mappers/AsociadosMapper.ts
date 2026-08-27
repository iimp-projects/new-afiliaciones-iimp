import { SmartCaseCardData, AtomicValidation, AtomicValidationStatus, PrimaryBadgeIcon } from "@/modules/shared/Components/SmartCaseCard/types";
import { S3StorageService } from "@/modules/shared/Services/S3StorageService";

export class AsociadosMapper {
  static toCardData(user: any): SmartCaseCardData {
    const isActive = user.status === "ACTIVE";
    const isStudent = user.role?.slug === "ASOCIADO_ESTUDIANTE";
    const fullName = `${user.person?.firstName || ""} ${user.person?.paternalLastName || ""} ${user.person?.maternalLastName || ""}`.trim();
    const initials = `${user.person?.firstName?.charAt(0) || ""}${user.person?.paternalLastName?.charAt(0) || ""}`.toUpperCase();

    // Como un asociado ya concluyó su proceso con éxito, sus áreas están aprobadas/validadas
    const primaryBadge = {
      label: isActive ? "ASOCIADO HÁBIL" : "SUSPENDIDO",
      icon: "check" as PrimaryBadgeIcon,
      colorClass: isActive 
        ? "text-emerald-700 bg-emerald-50 border border-emerald-200" 
        : "text-red-700 bg-red-50 border border-red-200",
    };

    // ✅ REPLICAMOS LAS 5 FILAS EXACTAS DE LAS ÁREAS DE UN EXPEDIENTE
    const atomicValidations: AtomicValidation[] = [
      ...(!isStudent ? [
        {
          icon: "Users",
          label: "Avales",
          status: "check" as AtomicValidationStatus,
          statusLabel: "2 de 2 Aprobados",
          statusColorClass: "bg-emerald-50 text-emerald-700",
          assignee: { name: "En regla", timeRelative: "" }
        }
      ] : []),
      {
        icon: "UserCheck",
        label: "Asociados",
        status: "check" as AtomicValidationStatus,
        statusLabel: "Validado",
        statusColorClass: "bg-emerald-50 text-emerald-700",
        assignee: { name: "IIMP", timeRelative: "" }
      },
      {
        icon: "ShieldCheck",
        label: "Logística",
        status: "check" as AtomicValidationStatus,
        statusLabel: "Validado",
        statusColorClass: "bg-emerald-50 text-emerald-700",
        assignee: { name: "Administrador", timeRelative: "" }
      },
      {
        icon: "Award",
        label: "Comité",
        status: "check" as AtomicValidationStatus,
        statusLabel: "Aprobado",
        statusColorClass: "bg-emerald-50 text-emerald-700",
        assignee: { name: "Comité", timeRelative: "" }
      },
      {
        icon: "CreditCard",
        label: "Pago",
        status: "check" as AtomicValidationStatus,
        statusLabel: isStudent ? "Gratuito" : "Pagado",
        statusColorClass: "bg-emerald-50 text-emerald-700",
        assignee: { name: isStudent ? "Pregrado" : "Pasarela", timeRelative: "" }
      }
    ];

    return {
      id: user.id,
      trackingCode: user.person?.documentNumber || "S/N",
      topBorderColorClass: isActive ? "bg-emerald-500" : "bg-red-500",
      subStatus: isStudent ? "Asociado Estudiante" : "Asociado Activo",
      identity: {
        title: fullName,
        subtitle: `DNI ${user.person?.documentNumber || "N/A"}`,
        avatarUrl: user.image || null,
        fallbackInitials: initials,
        categoryBadge: {
          label: isStudent ? "Asociado Estudiante" : "Asociado Activo",
          colorClass: isStudent 
            ? "bg-blue-500 text-white" 
            : "bg-[#e29b38] text-white",
        },
      },
      primaryBadge,
      atomicValidations, // ✅ Inyectamos el desglose completo de áreas
      metadata: {
        priority: "low",
        lastUpdatedRelative: `Actualizado: ${new Date(user.updatedAt).toLocaleDateString("es-PE")}`,
        assignedTo: { name: "IIMP", initial: "I" }
      },
      allowedActions: ["view"],
      rawId: user.id
    };
  }
}