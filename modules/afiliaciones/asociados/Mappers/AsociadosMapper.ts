/* eslint-disable @typescript-eslint/no-explicit-any -- adapter boundary for the existing shared card contract. */
import type { AtomicValidation, AtomicValidationStatus, PrimaryBadgeIcon, SmartCaseCardData } from "@/modules/shared/Components/SmartCaseCard/types";

export class AsociadosMapper {
  static toCardData(user: any): SmartCaseCardData {
    const isStudent = user.role?.slug === "ASOCIADO_ESTUDIANTE";
    const applications = user.person?.applications ?? [];
    const application = applications.find((item: any) => item.status === "COMPLETED") ?? applications[0];
    const completion = application?.history?.find((item: any) => item.newStatus === "COMPLETED");
    const paidPayment = application?.payments?.find((item: any) => item.status === "PAID");
    const memberSince = completion?.createdAt ?? application?.updatedAt;
    const fullName = `${user.person?.firstName ?? ""} ${user.person?.paternalLastName ?? ""} ${user.person?.maternalLastName ?? ""}`.trim();
    const initials = `${user.person?.firstName?.charAt(0) ?? ""}${user.person?.paternalLastName?.charAt(0) ?? ""}`.toUpperCase();
    const code = user.person?.documentNumber ?? "No registrado";
    const primaryContact = user.person?.contacts?.find((contact: any) => contact.isPrimary) ?? user.person?.contacts?.[0];
    const academicUniversity = user.person?.academicInfos?.[0]?.university?.name;
    const company = user.person?.professionalExperiences?.[0]?.company?.name ?? user.person?.employmentInfos?.[0]?.company?.name;
    const primaryBadge = { label: isStudent ? "Asociado Estudiante" : "Asociado Activo", icon: (isStudent ? "graduation" : "person") as PrimaryBadgeIcon, colorClass: "text-emerald-700 bg-emerald-50 border border-emerald-200" };
    const validations: AtomicValidation[] = [
      cardLine("UserCheck", "Código", code, "check", "bg-emerald-50 text-emerald-700", "Activo"),
      cardLine("CalendarDays", "Miembro desde", memberSince ? new Date(memberSince).toLocaleDateString("es-PE") : "No registrado", memberSince ? "check" : "dash", memberSince ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600", "IIMP"),
      cardLine(isStudent ? "GraduationCap" : "BriefcaseBusiness", isStudent ? "Institución" : "Empresa", isStudent ? (academicUniversity ?? "No registrada") : (company ?? "No registrada"), isStudent ? (academicUniversity ? "check" : "dash") : (company ? "check" : "dash"), isStudent ? (academicUniversity ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600") : (company ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600")),
      cardLine("CreditCard", "Inscripción", paidPayment ? "Pagada" : isStudent ? "Gratuita" : "Sin pago registrado", paidPayment || isStudent ? "check" : "dash", paidPayment || isStudent ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600", paidPayment && !isStudent ? `S/ ${Number(paidPayment.totalAmount).toFixed(2)}` : undefined),
    ];
    return { id: user.id, trackingCode: code, topBorderColorClass: "bg-emerald-500", identity: { title: fullName, subtitle: `DNI ${code}`, email: primaryContact?.email ?? user.email ?? null, phone: primaryContact?.phoneNumber ?? null, avatarUrl: user.affiliateAvatarUrl ?? user.image ?? null, fallbackInitials: initials }, primaryBadge, atomicValidations: validations, metadata: { priority: "low", lastUpdatedRelative: `Actualizado: ${new Date(user.updatedAt).toLocaleDateString("es-PE")}`, assignedTo: { name: "IIMP", initial: "I" } }, allowedActions: ["view"], rawId: user.id };
  }
}

function cardLine(icon: string, label: string, statusLabel: string, status: AtomicValidationStatus, statusColorClass: string, assignee?: string): AtomicValidation { return { icon, label, status, statusLabel, statusColorClass, ...(assignee ? { assignee: { name: assignee, timeRelative: "" } } : {}) }; }
