/* eslint-disable @typescript-eslint/no-explicit-any -- adapter boundary for the existing shared card contract. */
import { shouldShowEvaluationContext, type AtomicValidation, type AtomicValidationStatus, type PrimaryBadgeIcon, type SmartCaseCardData } from "@/modules/shared/Components/SmartCaseCard/types";
import { formatCalendarDate, formatPeruDate } from "@/modules/shared/Utils/formatPeruDateTime";
import { documentTypeLabel } from "@/modules/shared/Utils/documentType";
import { formatFullName } from "@/modules/shared/Utils/personName";
import { resolveAssociateCode } from "@/modules/shared/Utils/associateCode";
import { paymentOriginLabel } from "@/modules/afiliaciones/payments/Models/PaymentOrigin";

const MEMBERSHIP_PALETTE: Record<string, { border: string; badge: string }> = {
  A: { border: "bg-[#B58B35]", badge: "bg-[#FFF4DE] text-[#9A6A1F]" },
  E: { border: "bg-[#4F6BD8]", badge: "bg-[#EEF2FF] text-[#4F46B8]" },
  V: { border: "bg-emerald-600", badge: "bg-emerald-50 text-emerald-700" },
  H: { border: "bg-purple-600", badge: "bg-purple-50 text-purple-700" },
  T: { border: "bg-cyan-600", badge: "bg-cyan-50 text-cyan-700" },
  X: { border: "bg-amber-500", badge: "bg-amber-50 text-amber-700" },
  R: { border: "bg-rose-500", badge: "bg-rose-50 text-rose-700" },
  U: { border: "bg-red-600", badge: "bg-red-50 text-red-700" },
  F: { border: "bg-slate-500", badge: "bg-slate-100 text-slate-700" },
};

function toQuotaDate(quota: any): Date | null {
  const value = quota?.periodStart ?? quota?.paidAt;
  if (value) {
    const date = value instanceof Date ? value : new Date(value);
    if (!Number.isNaN(date.getTime())) return date;
  }
  return typeof quota?.year === "number" && Number.isFinite(quota.year) ? new Date(Date.UTC(quota.year, 0, 1)) : null;
}

function resolveFirstQuotaDate(person: any): Date | null {
  const quotas: any[] = Array.isArray(person?.quotas) ? person.quotas : [];
  const allDates = quotas.map(toQuotaDate).filter((date): date is Date => date !== null);
  if (allDates.length === 0) return null;
  const membershipDates = quotas
    .filter((quota) => quota?.concept === "CUOTA")
    .map(toQuotaDate)
    .filter((date): date is Date => date !== null);
  return (membershipDates.length > 0 ? membershipDates : allDates).reduce((earliest, date) => (date < earliest ? date : earliest));
}

function resolveSieInscription(person: any): any | null {
  const quotas: any[] = Array.isArray(person?.quotas) ? person.quotas : [];
  const inscriptions = quotas.filter((quota) => quota?.concept === "INSCRIPCION");
  if (inscriptions.length === 0) return null;
  return inscriptions.reduce((earliest, quota) => {
    const quotaDate = toQuotaDate(quota);
    const earliestDate = toQuotaDate(earliest);
    if (!earliestDate) return quota;
    if (!quotaDate) return earliest;
    return quotaDate < earliestDate ? quota : earliest;
  });
}

export class AsociadosMapper {
  static toCardData(user: any): SmartCaseCardData {
    const isHistorical = user.source === "SIE_HISTORICAL";
    const categoryCode = user.membershipCategory?.code ?? null;
    const categoryName = user.membershipCategory?.name ?? null;
    const isStudent = user.role?.slug === "ASOCIADO_ESTUDIANTE" || categoryCode === "E";
    const applications = user.person?.applications ?? [];
    const application = applications.find((item: any) => item.status === "COMPLETED") ?? applications[0];
    const completion = application?.history?.find((item: any) => item.newStatus === "COMPLETED");
    const paidPayment = application?.payments?.find((item: any) => item.status === "PAID");
    const firstQuotaDate = resolveFirstQuotaDate(user.person);
    const memberSince = firstQuotaDate ?? completion?.createdAt ?? application?.updatedAt;
    const memberSinceLabel = firstQuotaDate ? formatCalendarDate(firstQuotaDate) : memberSince ? formatPeruDate(memberSince) : null;
    const memberSinceSource = firstQuotaDate ? "SIE" : "IIMP";
    const sieQuotas: any[] = Array.isArray(user.person?.quotas) ? user.person.quotas : [];
    const sieInscription = resolveSieInscription(user.person);
    const hasSieFinancialHistory = sieQuotas.length > 0;
    const paymentOrigin = paidPayment ? paymentOriginLabel(paidPayment) : "";
    const inscriptionOrigin = isHistorical ? (hasSieFinancialHistory ? "SIE" : paymentOrigin) : paymentOrigin || (hasSieFinancialHistory ? "SIE" : "");
    const isInscriptionPaid = !isStudent && Boolean(paidPayment || hasSieFinancialHistory);
    const inscriptionLabel = isStudent ? "Gratuita" : isInscriptionPaid ? (inscriptionOrigin ? `Pagada · ${inscriptionOrigin}` : "Pagada") : "Sin pago registrado";
    const inscriptionStatus: AtomicValidationStatus = isStudent || isInscriptionPaid ? "check" : "dash";
    const inscriptionColor = isStudent || isInscriptionPaid ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600";
    const inscriptionAmount = isStudent
      ? undefined
      : paidPayment
        ? `S/ ${Number(paidPayment.totalAmount).toFixed(2)}`
        : sieInscription?.amount != null
          ? `${sieInscription.currency ?? "S/"} ${Number(sieInscription.amount).toFixed(2)}`
          : undefined;
    const fullName = formatFullName(user.person?.firstName, user.person?.paternalLastName, user.person?.maternalLastName);
    const initials = `${user.person?.firstName?.charAt(0) ?? ""}${user.person?.paternalLastName?.charAt(0) ?? ""}`.toUpperCase();
    const documentNumber = user.person?.documentNumber ?? "No registrado";
    const institutionalCode = user.institutionalCode ?? null;
    const associateCode = resolveAssociateCode(user.person) ?? (typeof user.associateCode === "string" ? user.associateCode : null);
    const displayCode = associateCode ?? institutionalCode;
    const displayCodeSource = associateCode ? "IIMP" : institutionalCode ? "SIE" : undefined;
    const code = isHistorical ? (institutionalCode ?? documentNumber) : documentNumber;
    const documentType = user.person?.documentType;
    const primaryContact = user.person?.contacts?.find((contact: any) => contact.isPrimary) ?? user.person?.contacts?.[0];
    const academicUniversity = user.person?.academicInfos?.[0]?.university?.name;
    const company = user.person?.professionalExperiences?.[0]?.company?.name ?? user.person?.employmentInfos?.[0]?.company?.name;
    const badgeLabel = categoryName ? `Asociado ${categoryName}` : isStudent ? "Asociado Estudiante" : "Asociado Activo";
    const palette = MEMBERSHIP_PALETTE[categoryCode ?? (isStudent ? "E" : "A")] ?? MEMBERSHIP_PALETTE.A;
    const primaryBadge = { label: badgeLabel, icon: (isStudent ? "graduation" : "person") as PrimaryBadgeIcon, colorClass: palette.badge };
    const validations: AtomicValidation[] = isHistorical
      ? [
          cardLine("UserCheck", "Código", displayCode ?? "No disponible", displayCode ? "check" : "dash", displayCode ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600", displayCodeSource),
          cardLine("CalendarDays", "Miembro desde", memberSinceLabel ?? "No registrado", memberSinceLabel ? "check" : "dash", memberSinceLabel ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600", "SIE"),
          cardLine(isStudent ? "GraduationCap" : "BriefcaseBusiness", isStudent ? "Institución" : "Empresa", "No registrada", "dash", "bg-slate-100 text-slate-600"),
          cardLine("CreditCard", "Inscripción", inscriptionLabel, inscriptionStatus, inscriptionColor, inscriptionAmount),
        ]
      : [
          cardLine("UserCheck", "Código", displayCode ?? "No disponible", displayCode ? "check" : "dash", displayCode ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600", displayCodeSource),
          cardLine("CalendarDays", "Miembro desde", memberSinceLabel ?? "No registrado", memberSinceLabel ? "check" : "dash", memberSinceLabel ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600", memberSinceSource),
          cardLine(isStudent ? "GraduationCap" : "BriefcaseBusiness", isStudent ? "Institución" : "Empresa", isStudent ? (academicUniversity ?? "No registrada") : (company ?? "No registrada"), isStudent ? (academicUniversity ? "check" : "dash") : (company ? "check" : "dash"), isStudent ? (academicUniversity ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600") : (company ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600")),
          cardLine("CreditCard", "Inscripción", inscriptionLabel, inscriptionStatus, inscriptionColor, inscriptionAmount),
        ];
    const latestUpdatedAt = [user.updatedAt, application?.updatedAt]
      .filter((value): value is string | Date => Boolean(value))
      .sort((left, right) => new Date(right).getTime() - new Date(left).getTime())[0];
    const subtitle = isHistorical
      ? `${documentTypeLabel(documentType)} ${documentNumber}`
      : `${documentTypeLabel(documentType)} ${code}`;
    return { id: user.id, trackingCode: code, topBorderColorClass: palette.border, hideContactDetails: true, identity: { title: fullName, subtitle, email: primaryContact?.email ?? user.email ?? null, phone: primaryContact?.phoneNumber ?? null, avatarUrl: user.affiliateAvatarUrl ?? user.image ?? null, fallbackInitials: initials, categoryBadge: isHistorical ? { label: "SIE · Histórico", colorClass: "bg-sky-50 text-sky-700" } : undefined }, primaryBadge, subStatus: isHistorical ? "Membresía histórica SIE" : membershipSubtitle(isStudent, user.status), atomicValidations: validations, metadata: { priority: "low", lastUpdatedRelative: latestUpdatedAt ? `Actualizado: ${formatPeruDate(latestUpdatedAt)}` : "Actualizado: No registrado", showEvaluationContext: isHistorical ? false : shouldShowEvaluationContext(application?.status), assignedTo: { name: "IIMP", initial: "I" } }, allowedActions: ["view"], rawId: user.id, generalStatus: isHistorical ? "COMPLETED" : application?.status };
  }
}

function cardLine(icon: string, label: string, statusLabel: string, status: AtomicValidationStatus, statusColorClass: string, assignee?: string): AtomicValidation { return { icon, label, status, statusLabel, statusColorClass, ...(assignee ? { assignee: { name: assignee, timeRelative: "" } } : {}) }; }

function membershipSubtitle(isStudent: boolean, status: string | undefined): string {
  if (isStudent) return "Membresía estudiantil";
  switch (status) {
    case "ACTIVE": return "Membresía activa";
    case "INACTIVE": return "Membresía inactiva";
    case "BLOCKED": return "Membresía suspendida";
    case "PENDING": return "Membresía pendiente";
    default: return "Membresía";
  }
}
