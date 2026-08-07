import { ApplicationStatus, EndorsementStatus, PaymentStatus } from "@prisma/client";
import { S3StorageService } from "@/modules/shared/Services/S3StorageService";
import type { 
    SmartCaseCardData, 
    AtomicValidation, 
    AtomicValidationStatus, 
    PrimaryBadgeIcon 
} from "@/modules/shared/Components/SmartCaseCard/types";

export class ExpedienteMapper {
    static async toCardData(app: any): Promise<SmartCaseCardData> {
        const person = app.person;
        const fullName = person ? `${person.firstName} ${person.paternalLastName} ${person.maternalLastName || ''}`.trim() : "Desconocido";
        const initials = person ? `${person.firstName.charAt(0)}${person.paternalLastName.charAt(0)}` : "--";
        const isStudent = app.affiliateType === "STUDENT";
        
        // ==========================================
        // FOTO
        // ==========================================
        let avatarUrl = null;
        const photoDoc = app.documents?.find((d: any) => 
            d.mimeType?.startsWith("image/") && 
            (d.category === "OTHER" || d.fileName?.toLowerCase().includes("foto"))
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
        // A. Validar Avales
        // ==========================================
        const approvals = app.approvals || [];
        const approvedCount = approvals.filter((a: any) => a.status === EndorsementStatus.APPROVED).length;
        const areEndorsementsReady = isStudent || approvedCount >= 2;

        // ==========================================
        // B. Lectura de la NUEVA TABLA y ANTIGUA TABLA
        // ==========================================
        const areaValidations = app.areaValidations || [];
        const logValidation = areaValidations.find((v: any) => v.department?.toUpperCase().includes('LOGISTICA'));
        const asoValidation = areaValidations.find((v: any) => v.department?.toUpperCase().includes('ASOCIADO'));

        const observations = app.observations || [];
        const logObs = observations.find((o: any) => o.reviewDepartment?.toUpperCase().includes('LOGISTICA') && o.status === 'PENDING');
        const asoObs = observations.find((o: any) => o.reviewDepartment?.toUpperCase().includes('ASOCIADO') && o.status === 'PENDING');

        const formatAssignee = (validationRecord: any) => {
            if (!validationRecord?.validatedBy?.person) return "Admin";
            const p = validationRecord.validatedBy.person;
            return `${p.firstName.split(' ')[0]} ${p.paternalLastName}`;
        };

        const isPaid = app.payments?.[0]?.status === PaymentStatus.PAID;
        const isPaymentResolved = isStudent || isPaid;

        // Tiempos exactos para las áreas
        const logTime = logObs?.createdAt || logValidation?.validatedAt || null;
        const logTimeStr = logTime ? this.getRelativeTime(new Date(logTime)).replace("Actualizado: ", "") : "";

        const asoTime = asoObs?.createdAt || asoValidation?.validatedAt || null;
        const asoTimeStr = asoTime ? this.getRelativeTime(new Date(asoTime)).replace("Actualizado: ", "") : "";

        // ==========================================
        // C. Estados Atómicos Dinámicos (INDEPENDIENTES)
        // ==========================================
        
        // --- LOGÍSTICA ---
        let logStatus: AtomicValidationStatus = 'pending';
        let logLabel = 'Pendiente';
        let logAssignee = 'Sin asignar';
        
        if (logValidation?.status === 'PENDING' || logObs) {
            logStatus = 'error'; logLabel = 'Observado'; logAssignee = 'Ver detalle';
        } else if (logValidation?.status === 'RESOLVED') {
            logStatus = 'check'; logLabel = 'Validado'; logAssignee = formatAssignee(logValidation);
        }

        // --- ASOCIADOS ---
        let asoStatus: AtomicValidationStatus = 'pending';
        let asoLabel = 'Pendiente';
        let asoAssignee = 'Sin asignar';

        if (asoValidation?.status === 'PENDING' || asoObs) {
            asoStatus = 'error'; asoLabel = 'Observado'; asoAssignee = 'Ver detalle';
        } else if (asoValidation?.status === 'RESOLVED') {
            asoStatus = 'check'; asoLabel = 'Validado'; asoAssignee = formatAssignee(asoValidation);
        }

        // ==========================================
        // D. Badge Principal (Burbuja Arriba Izquierda Unida)
        // ==========================================
        let primaryBadgeLabel = "EN PROCESO";
        let primaryBadgeIcon: PrimaryBadgeIcon = "clock";
        let primaryBadgeColor = "bg-amber-50 text-amber-600";
        let topBorderColorClass = "bg-amber-400";
        let subStatus = "Pendiente Logística y Asociados";

        const hasObservation = app.status === ApplicationStatus.OBSERVED || logObs || asoObs || logValidation?.status === 'PENDING' || asoValidation?.status === 'PENDING';

        if (app.status === ApplicationStatus.APPROVED) {
            if (isPaymentResolved) { 
                primaryBadgeLabel = "COMPLETADO"; primaryBadgeIcon = "check"; primaryBadgeColor = "bg-emerald-50 text-emerald-700"; topBorderColorClass = "bg-emerald-500"; subStatus = "Trámite finalizado";
            } else {
                primaryBadgeLabel = "PENDIENTE PAGO"; primaryBadgeIcon = "clock"; primaryBadgeColor = "bg-blue-50 text-blue-600"; topBorderColorClass = "bg-blue-400"; subStatus = "Aprobado, falta abonar";
            }
        } else if (hasObservation) {
            primaryBadgeLabel = "OBSERVADO"; primaryBadgeIcon = "error"; primaryBadgeColor = "bg-red-50 text-red-600"; topBorderColorClass = "bg-red-500"; subStatus = "Requiere atención";
        } else if (app.status === ApplicationStatus.REJECTED) {
            primaryBadgeLabel = "RECHAZADO"; primaryBadgeIcon = "error"; primaryBadgeColor = "bg-slate-100 text-slate-700"; topBorderColorClass = "bg-slate-400"; subStatus = "Postulación rechazada";
        } else if (!areEndorsementsReady) {
            primaryBadgeLabel = "EN REVISIÓN"; primaryBadgeIcon = "dash"; primaryBadgeColor = "bg-slate-100 text-slate-600"; topBorderColorClass = "bg-slate-400"; subStatus = `Faltan Avales (${approvedCount}/2)`;
        } else {
            primaryBadgeLabel = "EN PROCESO"; primaryBadgeIcon = "clock"; primaryBadgeColor = "bg-amber-50 text-amber-600"; topBorderColorClass = "bg-amber-400";
            if (logStatus === 'pending' && asoStatus === 'pending') subStatus = "Pendiente Logística y Asociados";
            else if (logStatus === 'pending') subStatus = "Pendiente Logística";
            else if (asoStatus === 'pending') subStatus = "Pendiente Asociados";
            else subStatus = "Listo para Aprobar Final";
        }

        // ==========================================
        // ORDEN CRONOLÓGICO: Avales -> Asociados -> Logística -> Pago
        // ==========================================
        const atomicValidations: AtomicValidation[] = [
            ...(!isStudent ? [{
                icon: "Users", label: "Avales",
                status: (areEndorsementsReady ? "check" : "pending") as AtomicValidationStatus,
                statusLabel: areEndorsementsReady ? "2 de 2 Aprobados" : `${approvedCount} de 2 Aprobados`,
                statusColorClass: areEndorsementsReady ? "bg-emerald-50 text-emerald-700" : "bg-blue-50 text-blue-700",
                assignee: { name: areEndorsementsReady ? "En regla" : "En espera", timeRelative: "" }
            }] : []),
            {
                icon: "UserCheck", label: "Asociados",
                status: asoStatus, statusLabel: asoLabel,
                statusColorClass: asoStatus === 'check' ? "bg-emerald-50 text-emerald-700" : asoStatus === 'error' ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700",
                assignee: { name: asoAssignee, timeRelative: asoTimeStr } // HORA AGREGADA
            },
            {
                icon: "ShieldCheck", label: "Logística",
                status: logStatus, statusLabel: logLabel,
                statusColorClass: logStatus === 'check' ? "bg-emerald-50 text-emerald-700" : logStatus === 'error' ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700",
                assignee: { name: logAssignee, timeRelative: logTimeStr } // HORA AGREGADA
            },
            {
                icon: "CreditCard", label: "Pago",
                status: (isStudent ? "check" : isPaid ? "check" : "pending") as AtomicValidationStatus,
                statusLabel: isStudent ? "Gratuito" : isPaid ? "Pagado" : "Pendiente",
                statusColorClass: isPaymentResolved ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700",
                assignee: { name: isStudent ? "Pregrado" : isPaid ? "Pasarela" : "Sin asignar", timeRelative: "" }
            }
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
                    label: isStudent ? "Estudiante" : "Asociado Activo",
                    colorClass: isStudent ? "bg-slate-500 border-slate-600 text-white" : "bg-[#f4e9d8] text-[#a67c00] border-[#e8d09e]"
                }
            },
            primaryBadge: { label: primaryBadgeLabel, icon: primaryBadgeIcon, colorClass: primaryBadgeColor },
            metadata: {
                priority: "medium",
                lastUpdatedRelative: this.getRelativeTime(app.updatedAt),
                assignedTo: { name: "Sin asignar", initial: "-" }
            },
            allowedActions: ["view", "evaluate"],
            atomicValidations
        };
    }

    private static getRelativeTime(date: Date): string {
        const rtf = new Intl.RelativeTimeFormat('es', { numeric: 'auto' });
        const diffMs = date.getTime() - new Date().getTime();
        const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
        if (Math.abs(diffDays) >= 1) return `Actualizado: ${rtf.format(diffDays, 'day')}`;
        const diffHours = Math.round(diffMs / (1000 * 60 * 60));
        if (Math.abs(diffHours) >= 1) return `Actualizado: ${rtf.format(diffHours, 'hour')}`;
        const diffMinutes = Math.round(diffMs / (1000 * 60));
        return `Actualizado: ${rtf.format(diffMinutes, 'minute')}`;
    }
}