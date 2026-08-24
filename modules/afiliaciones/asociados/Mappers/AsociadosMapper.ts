import { SmartCaseCardData } from "@/modules/shared/Components/SmartCaseCard/types";

export class AsociadosMapper {
  static toCardData(user: any): SmartCaseCardData {
    const isActive = user.status === "ACTIVE";
    const isStudent = user.role?.slug === "ASOCIADO_ESTUDIANTE";
    const fullName = `${user.person?.firstName} ${user.person?.paternalLastName} ${user.person?.maternalLastName || ""}`.trim();
    const initials = `${user.person?.firstName?.charAt(0) || ""}${user.person?.paternalLastName?.charAt(0) || ""}`.toUpperCase();

    return {
      id: user.id,
      trackingCode: user.person?.documentNumber || "S/N",
      topBorderColorClass: isActive ? "bg-emerald-500" : "bg-red-500",
      identity: {
        title: fullName,
        subtitle: user.email,
        avatarUrl: user.image || null,
        fallbackInitials: initials,
        categoryBadge: {
          label: isStudent ? "Asociado Estudiante" : "Asociado Activo",
          colorClass: isStudent 
            ? "bg-blue-50 text-blue-700 border border-blue-200" 
            : "bg-[#FFFDF8] text-[#C5A059] border border-[#E8D09E]",
        },
      },
      primaryBadge: {
        label: isActive ? "ASOCIADO HÁBIL" : "SUSPENDIDO",
        icon: "check",
        colorClass: isActive 
          ? "bg-emerald-50 text-emerald-700 border-emerald-200" 
          : "bg-red-50 text-red-700 border-red-200",
      },
      atomicValidations: [
        {
          icon: "ShieldCheck",
          label: "Estado",
          status: isActive ? "APPROVED" : "REJECTED",
          statusLabel: isActive ? "Permitido" : "Restringido",
          statusColorClass: isActive ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700",
        },
        {
          icon: "Calendar",
          label: "Inscripción",
          status: "RESOLVED",
          statusLabel: new Date(user.createdAt).getFullYear().toString(),
          statusColorClass: "bg-slate-100 text-slate-700",
          assignee: { name: "Sin asignar", timeRelative: "" }
        }
      ],
      metadata: {
        priority: "low",
        lastUpdatedRelative: `Actualizado ${new Date(user.updatedAt).toLocaleDateString("es-PE")}`,
        reviewerArea: "Directorio Oficial",
        assignedTo: { name: "IIMP", initial: "I" }
      },
      allowedActions: [],
      rawId: user.id
    };
  }
}