import {
  ApplicationStatus,
  EndorsementStatus,
  PaymentStatus,
  ValidationStatus,
} from "@prisma/client";
import { S3StorageService } from "@/modules/shared/Services/S3StorageService";
import type {
  SmartCaseCardData,
  AtomicValidation,
  AtomicValidationStatus,
  PrimaryBadgeIcon,
} from "@/modules/shared/Components/SmartCaseCard/types";

export class ExpedienteMapper {
  static async toCardData(app: any): Promise<SmartCaseCardData> {
    const person = app.person;
    const fullName = person
      ? `${person.firstName} ${person.paternalLastName} ${person.maternalLastName || ""}`.trim()
      : "Desconocido";
    const initials = person
      ? `${person.firstName.charAt(0)}${person.paternalLastName.charAt(0)}`
      : "--";
    const isStudent = app.affiliateType === "STUDENT";

    // ==========================================
    // 1. FOTO
    // ==========================================
    let avatarUrl = null;
    const photoDoc = app.documents?.find(
      (d: any) =>
        d.mimeType?.startsWith("image/") &&
        (d.category === "OTHER" || d.fileName?.toLowerCase().includes("foto")),
    );

    if (photoDoc && photoDoc.fileUrl) {
      try {
        const s3Service = new S3StorageService();
        avatarUrl = await s3Service.getPresignedUrl(photoDoc.fileUrl);
      } catch (error) {
        console.error("Error al firmar URL de S3");
      }
    }

    // ==========================================
    // 2. LECTURA DE ÁREAS
    // ==========================================
    const isPaid = app.payments?.[0]?.status === PaymentStatus.PAID;
    const isPaymentResolved = isStudent || isPaid;

    const approvals = app.approvals || [];
    const approvedCount = approvals.filter(
      (a: any) => a.status === EndorsementStatus.APPROVED,
    ).length;
    const areEndorsementsReady = isStudent || approvedCount >= 2;

    const newValidations = app.validations || [];
    const oldAreaValidations = app.areaValidations || [];
    const oldObservations = app.observations || [];

    const formatAssignee = (v: any) => {
      if (!v?.validatedBy?.person) return "Falta Revision";
      const p = v.validatedBy.person;
      return `${p.firstName.split(" ")[0]} ${p.paternalLastName}`;
    };

    const formatTime = (dateStr: string | undefined) => {
      if (!dateStr) return "";
      const d = new Date(dateStr);
      const datePart = d.toLocaleDateString("es-PE", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
      const timePart = d.toLocaleTimeString("es-PE", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });
      return `${datePart} - ${timePart}`;
    };

    const getDepartmentState = (deptCode: string) => {
      const newVal = newValidations.find(
        (v: any) => v.department?.code === deptCode,
      );
      if (newVal) {
        return {
          status: newVal.status,
          assignee: formatAssignee(newVal),
          time: formatTime(newVal.validatedAt),
        };
      }
      // Soporte legacy
      if (deptCode === "LOGISTICA" || deptCode === "ASOCIADOS") {
        const oldVal = oldAreaValidations.find((v: any) =>
          v.department?.toUpperCase().includes(deptCode),
        );
        const oldObs = oldObservations.find(
          (o: any) =>
            o.reviewDepartment?.toUpperCase().includes(deptCode) &&
            o.status === "PENDING",
        );
        if (oldObs || oldVal?.status === "PENDING")
          return {
            status: "OBSERVED",
            assignee: "Ver detalle",
            time: formatTime(oldObs?.createdAt),
          };
        if (oldVal?.status === "RESOLVED")
          return {
            status: "APPROVED",
            assignee: formatAssignee(oldVal),
            time: formatTime(oldVal.validatedAt),
          };
      }
      // Fallback si no existe en BD
      return { status: "PENDING", assignee: "Sin asignar", time: "" };
    };

    const mapStatus = (
      status: string,
    ): {
      atomicStatus: AtomicValidationStatus;
      label: string;
      color: string;
    } => {
      switch (status) {
        case "APPROVED":
          return {
            atomicStatus: "check",
            label: "Validado",
            color: "bg-emerald-50 text-emerald-700",
          };
        case "RESOLVED":
          return {
            atomicStatus: "check",
            label: "Subsanado",
            color: "bg-purple-50 text-purple-700",
          };
        case "OBSERVED":
          return {
            atomicStatus: "error",
            label: "Observado",
            color: "bg-red-50 text-red-700",
          };
        case "REJECTED":
          return {
            atomicStatus: "error",
            label: "Rechazado",
            color: "bg-red-50 text-red-700",
          };
        case "UNDER_EVALUATION":
          return {
            atomicStatus: "review",
            label: "Evaluando",
            color: "bg-blue-50 text-blue-700",
          };
        default:
          return {
            atomicStatus: "pending",
            label: "Pendiente",
            color: "bg-amber-50 text-amber-700",
          };
      }
    };

    // LECTURA DE TODAS LAS ÁREAS (Nuevas y antiguas)
    const asoState = getDepartmentState("ASOCIADOS");
    const logState = getDepartmentState("LOGISTICA");
    const legalState = getDepartmentState("LEGAL"); // <-- NUEVO
    const comunicacionesState = getDepartmentState("COMUNICACIONES"); // <-- NUEVO
    const comiteState = getDepartmentState("COMITE");

    const asoMapped = mapStatus(asoState.status);
    const logMapped = mapStatus(logState.status);
    const legalMapped = mapStatus(legalState.status); // <-- NUEVO
    const comunicacionesMapped = mapStatus(comunicacionesState.status); // <-- NUEVO
    const comiteMapped = mapStatus(comiteState.status);

    // ==========================================
    // 3. ESTADO PRINCIPAL Y SUBTÍTULO DINÁMICO
    // ==========================================
    let badgeLabel = "DESCONOCIDO";
    let badgeIcon: PrimaryBadgeIcon = "dash";
    let badgeColor = "bg-slate-100 text-slate-500 border-slate-200";
    let topBorderColorClass = "bg-slate-400";
    let subStatus = "En proceso";

    switch (app.status) {
      case ApplicationStatus.DRAFT:
        badgeLabel = "Borrador";
        badgeIcon = "dash";
        badgeColor = "bg-slate-100 text-slate-600";
        topBorderColorClass = "bg-slate-400";
        subStatus = "Postulación incompleta";
        break;
      case ApplicationStatus.PENDING:
        badgeLabel = "Pendiente";
        badgeIcon = "clock";
        badgeColor = "bg-amber-50 text-amber-600";
        topBorderColorClass = "bg-amber-400";
        subStatus = areEndorsementsReady
          ? "Pendiente de revisión"
          : `Faltan Avales (${approvedCount}/2)`;
        break;
      case ApplicationStatus.UNDER_EVALUACION:
        badgeLabel = "En Evaluación";
        badgeIcon = "review";
        badgeColor = "bg-blue-50 text-blue-600";
        topBorderColorClass = "bg-blue-400";
        subStatus = "Áreas evaluando el expediente";
        break;
      case ApplicationStatus.OBSERVED:
        badgeLabel = "Observado";
        badgeIcon = "error";
        badgeColor = "bg-red-50 text-red-600";
        topBorderColorClass = "bg-red-500";
        subStatus = "Requiere subsanación del postulante";
        break;
      case ApplicationStatus.RESOLVED:
        badgeLabel = "Subsanado";
        badgeIcon = "clock";
        badgeColor = "bg-purple-50 text-purple-600";
        topBorderColorClass = "bg-purple-400";
        subStatus = "Respuestas recibidas, por revisar";
        break;
      case ApplicationStatus.READY_FOR_PAYMENT:
        badgeLabel = "Apto para Pago";
        badgeIcon = "check";
        badgeColor = "bg-emerald-50 text-emerald-600";
        topBorderColorClass = "bg-emerald-400";
        subStatus = "Postulación aprobada, aguardando pago";
        break;
      case ApplicationStatus.COMPLETED:
        badgeLabel = "Completado";
        badgeIcon = "check";
        badgeColor = "bg-emerald-50 text-emerald-700";
        topBorderColorClass = "bg-emerald-500";
        subStatus = "Trámite finalizado exitosamente";
        break;
      case ApplicationStatus.REJECTED:
        badgeLabel = "Rechazado";
        badgeIcon = "error";
        badgeColor = "bg-slate-100 text-slate-700";
        topBorderColorClass = "bg-slate-400";
        subStatus = "El proceso no procedió";
        break;
    }

    const atomicValidations: AtomicValidation[] = [
      ...(!isStudent
        ? [
            {
              icon: "Users",
              label: "Avales",
              status: (areEndorsementsReady
                ? "check"
                : "pending") as AtomicValidationStatus,
              statusLabel: areEndorsementsReady
                ? "2 de 2 Aprobados"
                : `${approvedCount} de 2 Aprobados`,
              statusColorClass: areEndorsementsReady
                ? "bg-emerald-50 text-emerald-700"
                : "bg-amber-50 text-amber-700",
              assignee: {
                name: areEndorsementsReady ? "En regla" : "En espera",
                timeRelative: "",
              },
            },
          ]
        : []),
      {
        icon: "UserCheck",
        label: "Asociados",
        status: asoMapped.atomicStatus,
        statusLabel: asoMapped.label,
        statusColorClass: asoMapped.color,
        assignee: { name: asoState.assignee, timeRelative: asoState.time },
      },
      {
        icon: "ShieldCheck",
        label: "Logística",
        status: logMapped.atomicStatus,
        statusLabel: logMapped.label,
        statusColorClass: logMapped.color,
        assignee: { name: logState.assignee, timeRelative: logState.time },
      },
      {
        icon: "Award",
        label: "Comité",
        status: comiteMapped.atomicStatus,
        statusLabel: comiteMapped.label,
        statusColorClass: comiteMapped.color,
        assignee: {
          name: comiteState.assignee,
          timeRelative: comiteState.time,
        },
      },
      {
        icon: "CreditCard",
        label: "Pago",
        status: (isStudent
          ? "check"
          : isPaid
            ? "check"
            : "pending") as AtomicValidationStatus,
        statusLabel: isStudent ? "Gratuito" : isPaid ? "Pagado" : "Pendiente",
        statusColorClass: isPaymentResolved
          ? "bg-emerald-50 text-emerald-700"
          : "bg-amber-50 text-amber-700",
        assignee: {
          name: isStudent ? "" : isPaid ? "Pasarela" : "",
          timeRelative: "",
        },
      },
    ];

    return {
      id: app.trackingCode,
      rawId: app.id,
      trackingCode: app.trackingCode,
      topBorderColorClass,
      subStatus,
      identity: {
        title: fullName,
        subtitle: `DNI ${app.documentNumber}`,
        avatarUrl,
        fallbackInitials: initials,
        categoryBadge: {
          label: isStudent ? "Asociado Estudiante" : "Asociado Activo",
          colorClass: isStudent
            ? "bg-slate-500 border-slate-600 text-white"
            : "bg-[#f4e9d8] text-[#a67c00] border-[#e8d09e]",
        },
      },
      primaryBadge: {
        label: badgeLabel,
        icon: badgeIcon,
        colorClass: badgeColor,
      },
      metadata: {
        priority: "medium",
        lastUpdatedRelative: this.getRelativeTime(new Date(app.updatedAt)),
        assignedTo: { name: "Sin asignar", initial: "-" },
      },
      allowedActions: ["view", "evaluate"],
      atomicValidations,
    };
  }

  private static getRelativeTime(date: Date): string {
    const rtf = new Intl.RelativeTimeFormat("es", { numeric: "auto" });
    const diffMs = date.getTime() - new Date().getTime();
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
    if (Math.abs(diffDays) >= 1)
      return `Actualizado: ${rtf.format(diffDays, "day")}`;
    const diffHours = Math.round(diffMs / (1000 * 60 * 60));
    if (Math.abs(diffHours) >= 1)
      return `Actualizado: ${rtf.format(diffHours, "hour")}`;
    const diffMinutes = Math.round(diffMs / (1000 * 60));
    return `Actualizado: ${rtf.format(diffMinutes, "minute")}`;
  }
}
