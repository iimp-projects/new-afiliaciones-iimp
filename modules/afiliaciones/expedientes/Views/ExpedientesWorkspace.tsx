"use client";

import React, { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom"; 
import { SmartCaseCard } from "@/modules/shared/Components/SmartCaseCard/SmartCaseCard";
import { ExpedientesFilterBar } from "../Components/ExpedientesFilterBar";
import { ExpedientesPagination } from "../Components/ExpedientesPagination";
import { InspectionDrawer } from "@/modules/shared/Components/InspectionDrawer/InspectionDrawer";
import type { SmartCaseCardData } from "@/modules/shared/Components/SmartCaseCard/types";
import type { DrawerData } from "@/modules/shared/Components/InspectionDrawer/types";
import { 
    FileText, User, GraduationCap, Briefcase, Users, Eye, 
    CheckCircle2, Clock, XCircle, MinusCircle, AlertCircle, Info, ChevronDown, 
    MapPin, Calendar, CreditCard, Activity, Phone, Mail, Building2, Download, AlertTriangle, ShieldCheck, UserCheck
} from "lucide-react";
import { DynamicIcon } from "@/modules/layout/Utils/DynamicIcon";

const DrawerStatusIcon = ({ status, className = "" }: { status: string; className?: string }) => {
    if (status === "check") return <CheckCircle2 size={14} className={className} strokeWidth={2.5} />;
    if (status === "pending" || status === "clock") return <Clock size={14} className={className} strokeWidth={2.5} />;
    if (status === "error") return <XCircle size={14} className={className} strokeWidth={2.5} />;
    if (status === "dash") return <MinusCircle size={14} className={className} strokeWidth={2.5} />;
    if (status === "review") return <AlertCircle size={14} className={className} strokeWidth={2.5} />;
    return null;
};

const DataField = ({ label, value, fullWidth = false }: { label: string, value: any, fullWidth?: boolean }) => (
    <div className={`flex flex-col gap-1 ${fullWidth ? 'sm:col-span-2 lg:col-span-3' : ''}`}>
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{label}</span>
        <span className="text-[13px] font-semibold text-slate-800">
            {value || <span className="text-slate-300 italic font-medium">No registrado</span>}
        </span>
    </div>
);

const getDocumentFriendlyName = (category: string) => {
    switch (category) {
        case 'ID_DOCUMENT': return 'Documento de Identidad (DNI / CE / Pasaporte)';
        case 'SWORN_DECLARATION': return 'Declaración Jurada Firmada';
        case 'CV': return 'Currículum Vitae (CV)';
        case 'RECOMMENDATION_LETTER': return 'Carta de Recomendación';
        case 'DEGREE_CERTIFICATE': return 'Certificado Académico';
        case 'PAYMENT_VOUCHER': return 'Voucher o Comprobante de Pago';
        default: return 'Constancia de Estudios / Documento Adicional';
    }
};

export function ExpedientesWorkspace() {
    const [expedientes, setExpedientes] = useState<SmartCaseCardData[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isDrawerLoading, setIsDrawerLoading] = useState(false);
    const [meta, setMeta] = useState({ total: 0, page: 1, pageSize: 8, totalPages: 1 });
    const [isMounted, setIsMounted] = useState(false); 
    
    const [drawerData, setDrawerData] = useState<DrawerData<any> | null>(null);
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    
    const [showStatusModal, setShowStatusModal] = useState(false);
    const [targetStatus, setTargetStatus] = useState<string>("");
    const [statusReason, setStatusReason] = useState<string>("");
    const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

    const [filters, setFilters] = useState({
        search: "", status: "Todos", modality: "Todos", assignedTo: "Todos",
        logisticValidation: "Todos", associateValidation: "Todos", dateFrom: "", dateTo: "", orderBy: "Más recientes",
    });

    useEffect(() => { setIsMounted(true); }, []);

    const fetchExpedientes = useCallback(async () => {
        setIsLoading(true);
        try {
            const queryParams = new URLSearchParams({ page: meta.page.toString(), pageSize: meta.pageSize.toString() });
            Object.entries(filters).forEach(([key, value]) => { if (value && value !== "Todos") queryParams.append(key, value); });
            const response = await fetch(`/api/afiliaciones/expedientes?${queryParams.toString()}`);
            const result = await response.json();
            if (result.success) { setExpedientes(result.data); setMeta(result.meta); }
        } catch (error) { console.error(error); } finally { setIsLoading(false); }
    }, [filters, meta.page, meta.pageSize]);

    useEffect(() => {
        const timeoutId = setTimeout(() => { fetchExpedientes(); }, 500);
        return () => clearTimeout(timeoutId);
    }, [fetchExpedientes]);

    const handleFilterChange = (key: string, value: string) => {
        setFilters(prev => ({ ...prev, [key]: value }));
        setMeta(prev => ({ ...prev, page: 1 })); 
    };

    const handleOpenDrawer = async (cardData: SmartCaseCardData) => {
        setIsDrawerLoading(true);
        setIsDrawerOpen(true); 
        setDrawerData({ caseId: cardData.rawId!, header: cardData, availableTabs: [], defaultTabId: "resumen", payload: null });

        try {
            const response = await fetch(`/api/afiliaciones/expedientes/${cardData.rawId}`);
            const result = await response.json();
            if (result.success) {
                const fullData = result.data;
                setDrawerData({
                    caseId: cardData.rawId!,
                    header: cardData,
                    availableTabs: [
                        { id: "resumen", label: "Resumen", hasNotification: false },
                        { id: "datos", label: "Datos Completos", hasNotification: false },
                        { id: "documentos", label: "Documentos", hasNotification: fullData.documents?.length > 0 },
                        { id: "historial", label: "Historial de Actividad", hasNotification: false }
                    ],
                    defaultTabId: "resumen",
                    payload: fullData 
                });
            }
        } catch (error) { console.error(error); } finally { setIsDrawerLoading(false); }
    };

    const handleOpenSecureDocument = async (url: string) => {
        try {
            const res = await fetch(`/api/afiliaciones/postulacion/file?url=${encodeURIComponent(url)}`);
            const data = await res.json();
            if (data.success) window.open(data.data.url, '_blank');
        } catch (error) { alert("No se pudo abrir el documento."); }
    };

    const confirmStatusChange = async () => {
        if (!drawerData) return;
        setIsUpdatingStatus(true);
        try {
            const res = await fetch(`/api/afiliaciones/expedientes/${drawerData.caseId}/status`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ newStatus: targetStatus, reason: statusReason })
            });
            const data = await res.json();
            if (data.success) {
                setShowStatusModal(false);
                setStatusReason("");
                fetchExpedientes();
                handleOpenDrawer(drawerData.header); // Refresca en vivo el drawer
            } else {
                alert(data.message);
            }
        } catch (error) {
            alert("Error de conexión al actualizar estado.");
        } finally {
            setIsUpdatingStatus(false);
        }
    };

    const generateTimeline = (payload: any) => {
        const events: Array<{ date: Date; title: string; desc: string; icon: React.ReactNode; color: string; auditor?: string | null; }> = [];

        if (payload.createdAt) events.push({ date: new Date(payload.createdAt), title: "Expediente Creado", desc: "El postulante inició su registro.", icon: <FileText size={14}/>, color: "bg-slate-100 text-slate-500 border-slate-200" });
        if (payload.submittedAt) events.push({ date: new Date(payload.submittedAt), title: "Expediente Enviado", desc: "El postulante finalizó y envió el formulario a revisión.", icon: <CheckCircle2 size={14}/>, color: "bg-blue-100 text-blue-600 border-blue-200" });
        
        payload.history?.forEach((h: any) => {
            let auditorInfo = null;
            let cleanDesc = h.changeReason || 'Actualización de fase realizada por el sistema.';
            const match = cleanDesc.match(/\[Por:\s(.*?)\s-\s(.*?)\]/);
            
            if (match) {
                auditorInfo = `${match[1]} (${match[2].replace('_', ' ')})`;
                cleanDesc = cleanDesc.replace(match[0], '').trim();
            }

            const isApprove = h.newStatus === 'APPROVED' || h.newStatus === 'UNDER_EVALUATION';
            events.push({ 
                date: new Date(h.createdAt), 
                title: `Cambio de Estado: ${h.newStatus.replace('_', ' ')}`, 
                desc: cleanDesc, 
                auditor: auditorInfo,
                icon: <Activity size={14}/>, 
                color: isApprove ? "bg-emerald-100 text-emerald-600 border-emerald-200" : "bg-amber-100 text-amber-600 border-amber-200" 
            });
        });

        payload.payments?.forEach((p: any) => {
            if(p.createdAt) events.push({ date: new Date(p.createdAt), title: `Pago Registrado (${p.status})`, desc: `Monto: ${p.currency} ${p.totalAmount} vía ${p.gateway}`, icon: <CreditCard size={14}/>, color: "bg-emerald-100 text-emerald-600 border-emerald-200" });
        });

        payload.approvals?.forEach((a: any, idx: number) => {
            if(a.transactionDate) {
                const isApproved = a.status === 'APPROVED';
                events.push({ date: new Date(a.transactionDate), title: `Respuesta Aval ${idx + 1}: ${isApproved ? 'Aprobado' : 'Rechazado'}`, desc: `Asociado: ${a.sponsorPerson?.firstName} ${a.sponsorPerson?.paternalLastName}`, icon: isApproved ? <CheckCircle2 size={14}/> : <XCircle size={14}/>, color: isApproved ? "bg-emerald-100 text-emerald-600 border-emerald-200" : "bg-red-100 text-red-600 border-red-200" });
            }
        });

        payload.areaValidations?.forEach((v: any) => {
            if(v.validatedAt) {
                const isApproved = v.status === 'RESOLVED';
                events.push({ 
                    date: new Date(v.validatedAt), 
                    title: `Validación de Área: ${v.department.replace('_', ' ')}`, 
                    desc: v.comments || (isApproved ? 'Área validó conforme.' : 'El área reportó observaciones.'), 
                    icon: isApproved ? <ShieldCheck size={14}/> : <AlertCircle size={14}/>, 
                    color: isApproved ? "bg-emerald-100 text-emerald-600 border-emerald-200" : "bg-red-100 text-red-600 border-red-200" 
                });
            }
        });

        return events.sort((a, b) => b.date.getTime() - a.date.getTime());
    };

    const renderDrawerContent = (activeTab: string, payload: any) => {
        if (isDrawerLoading || !payload) {
            return (
                <div className="flex flex-col items-center justify-center h-64 gap-4">
                    <div className="animate-spin w-10 h-10 border-4 border-[#C5A059] border-t-transparent rounded-full"></div>
                    <span className="text-sm font-bold text-slate-500">Recopilando datos e historial del expediente...</span>
                </div>
            );
        }

        const header = drawerData?.header;
        const validations = header?.atomicValidations || [];
        const completedCount = validations.filter((v: any) => v.status === 'check').length;
        const progressPercentage = validations.length > 0 ? Math.round((completedCount / validations.length) * 100) : 0;

        const draft = payload.draftData || {};
        const personalInfo = draft.personalInformation || {};
        const academicStudy = draft.academicStudies?.[0] || {};
        const employmentInfo = draft.employmentInformation || {};
        const endorsements = draft.endorsements || {};
        const approvals = payload.approvals || [];
        
        const isStudent = payload.affiliateType === "STUDENT";
        const isApprovedFinal = payload.status === "APPROVED";
        
        const countAvalesAprobados = approvals.filter((a: any) => a.status === 'APPROVED').length;
        const areEndorsementsReady = isStudent || countAvalesAprobados === 2;

        const submittedDate = payload.submittedAt ? new Date(payload.submittedAt).toLocaleString('es-PE', { dateStyle: 'medium', timeStyle: 'short' }) : 'No enviado';
        const payment = payload.payments?.[0];
        const paymentMethod = payment?.gateway ? payment.gateway.toLowerCase().replace(/_/g, ' ') : (isStudent ? 'Beca Pregrado' : 'Pendiente');
        const invoiceType = payment?.billing?.invoice?.type || (isStudent ? 'No aplica' : 'Boleta');
        const amount = payment?.totalAmount ? `${payment.currency || 'PEN'} ${payment.totalAmount}` : (isStudent ? 'Gratuito' : 'S/ 0.00');

        // ====================================================
        // PESTAÑA 1: RESUMEN (DASHBOARD)
        // ====================================================
        if (activeTab === "resumen") {
            return (
                <div className="space-y-6 sm:space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
                    <div>
                        <h3 className="text-[13px] font-bold text-slate-800 mb-3 flex items-center gap-2">Estado del expediente</h3>
                        <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-sm space-y-3 sm:space-y-4">
                            {validations.map((val: any, idx: number) => (
                                <div key={idx} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 sm:p-0 rounded-xl sm:rounded-none bg-slate-50 sm:bg-transparent border border-slate-100 sm:border-none">
                                    <div className="flex items-center gap-3 sm:w-1/3">
                                        <DynamicIcon name={val.icon} size={16} className="text-slate-500" />
                                        <span className="text-[12px] font-bold text-slate-700">{val.label}</span>
                                    </div>
                                    <div className="sm:w-1/3 flex sm:justify-start">
                                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold ${val.statusColorClass}`}><DrawerStatusIcon status={val.status} className="w-3 h-3" />{val.statusLabel}</span>
                                    </div>
                                    <div className="sm:w-1/3 flex flex-col sm:items-end text-left sm:text-right">
                                        <span className={`text-[11px] font-black truncate w-full sm:text-right ${val.status === 'check' ? 'text-[#C5A059]' : val.status === 'error' ? 'text-red-500' : 'text-slate-400'}`}>{val.assignee?.name}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div>
                        <h3 className="text-[13px] font-bold text-slate-800 mb-3">Progreso general</h3>
                        <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-sm">
                            <div className="flex items-end justify-between mb-3">
                                <span className="text-xs font-medium text-slate-500">{completedCount} de {validations.length} validaciones completadas</span>
                                <span className="text-2xl font-black text-slate-800 leading-none">{progressPercentage}%</span>
                            </div>
                            <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                                <div className="bg-[#C5A059] h-2.5 rounded-full transition-all duration-1000 ease-out" style={{ width: `${progressPercentage}%` }}></div>
                            </div>
                        </div>
                    </div>

                    <div>
                        <h3 className="text-[13px] font-bold text-slate-800 mb-3">Información de solicitud</h3>
                        <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-sm">
                            <dl className="space-y-4">
                                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center border-b border-slate-50 pb-4 gap-1">
                                    <dt className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Modalidad</dt>
                                    <dd className="text-sm font-bold text-slate-800">{header?.identity.categoryBadge?.label}</dd>
                                </div>
                                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center border-b border-slate-50 pb-4 gap-1">
                                    <dt className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Fecha de envío</dt>
                                    <dd className="text-sm font-bold text-slate-800">{submittedDate}</dd>
                                </div>
                                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center border-b border-slate-50 pb-4 gap-1">
                                    <dt className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Tipo de pago</dt>
                                    <dd className={`text-sm font-bold capitalize ${isStudent ? 'text-emerald-600' : 'text-slate-800'}`}>{paymentMethod}</dd>
                                </div>
                                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center border-b border-slate-50 pb-4 gap-1">
                                    <dt className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Comprobante</dt>
                                    <dd className="text-sm font-bold text-slate-800 capitalize">{invoiceType.toLowerCase()}</dd>
                                </div>
                                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1">
                                    <dt className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Monto</dt>
                                    <dd className={`text-[15px] font-black ${isStudent ? 'text-emerald-600' : 'text-[#C5A059]'}`}>{amount}</dd>
                                </div>
                            </dl>
                        </div>
                    </div>

                    <div>
                        <h3 className="text-[13px] font-bold text-slate-800 mb-3">Acciones de Evaluación</h3>
                        {!areEndorsementsReady && (
                            <div className="mb-3 p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-2 text-xs font-bold text-slate-600 shadow-sm animate-pulse">
                                <Info size={16} className="shrink-0" />
                                Acciones bloqueadas hasta que los avales aprueben la solicitud.
                            </div>
                        )}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <button 
                                onClick={() => { setTargetStatus("UNDER_EVALUATION"); setShowStatusModal(true); }}
                                disabled={!areEndorsementsReady || isApprovedFinal}
                                className={`flex items-center justify-center gap-2 px-3 py-3.5 bg-[#fdfaf5] border-2 border-[#E8D09E] text-[#7f561e] rounded-xl text-xs font-black transition-all shadow-sm focus:outline-none ${(!areEndorsementsReady || isApprovedFinal) ? 'opacity-50 cursor-not-allowed grayscale' : 'hover:bg-[#C5A059] hover:text-white hover:border-[#C5A059]'}`}
                            >
                                <ShieldCheck size={16} strokeWidth={2.5}/> Validar Fase
                            </button>
                            <button 
                                onClick={() => { setTargetStatus("APPROVED"); setShowStatusModal(true); }}
                                disabled={!areEndorsementsReady || isApprovedFinal}
                                className={`flex items-center justify-center gap-2 px-3 py-3.5 bg-gradient-to-r from-[#dca45c] to-[#C5A059] text-white rounded-xl text-xs font-extrabold transition-all shadow-md focus:outline-none ${(!areEndorsementsReady || isApprovedFinal) ? 'opacity-50 cursor-not-allowed grayscale' : 'hover:shadow-lg hover:-translate-y-0.5'}`}
                            >
                                <CheckCircle2 size={16} strokeWidth={2.5}/> Aprobar Final
                            </button>
                            {/* EL BOTÓN OBSERVAR SIEMPRE ESTÁ HABILITADO */}
                            <button 
                                onClick={() => { setTargetStatus("OBSERVED"); setShowStatusModal(true); }}
                                disabled={!areEndorsementsReady || isApprovedFinal}
                                className={`flex items-center justify-center gap-2 px-3 py-3.5 border border-slate-200 rounded-xl text-xs font-bold transition-colors shadow-sm focus:outline-none ${(!areEndorsementsReady || isApprovedFinal) ? 'bg-gray-50 text-gray-400 cursor-not-allowed grayscale opacity-60' : 'bg-white text-slate-700 hover:bg-red-50 hover:border-red-200 hover:text-red-700'}`}
                            >
                                <AlertCircle size={16} strokeWidth={2.5}/> Observar
                            </button>
                        </div>
                    </div>
                </div>
            );
        }

        if (activeTab === "datos") {
            const rawNames = `${personalInfo.names || payload.person?.firstName || ''} ${personalInfo.fatherLastName || payload.person?.paternalLastName || ''} ${personalInfo.motherLastName || payload.person?.maternalLastName || ''}`.trim();
            const generoLabel = personalInfo.gender === 'MALE' ? 'Masculino' : personalInfo.gender === 'FEMALE' ? 'Femenino' : personalInfo.gender;
            const universidadName = academicStudy.otherInstitution || payload.person?.academicInfos?.[0]?.university?.name || (academicStudy.institutionId ? 'Institución Registrada' : '');

            return (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300 pb-10">
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="bg-slate-50 px-5 py-4 border-b border-slate-200 flex items-center gap-3">
                            <User size={18} className="text-slate-600" />
                            <h3 className="text-sm font-black text-slate-800 uppercase tracking-wide">Datos Personales</h3>
                        </div>
                        <div className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                            <DataField label="Nombres y Apellidos" value={rawNames} fullWidth />
                            <DataField label={`Documento (${payload.documentType})`} value={payload.documentNumber} />
                            <div className="hidden lg:block"></div>
                            <DataField label="Fecha Nacimiento" value={personalInfo.birthDate} />
                            <DataField label="Género" value={generoLabel} />
                            <div className="hidden lg:block"></div>
                            <DataField label="Correo Principal" value={personalInfo.primaryEmail || payload.email} />
                            <DataField label="Correo Secundario" value={personalInfo.secondaryEmail} />
                            <div className="hidden lg:block"></div>
                            <DataField label="Celular" value={personalInfo.phone || payload.phone} />
                            <DataField label="Teléfono Fijo" value={personalInfo.landline} />
                            <div className="hidden lg:block"></div>
                            <DataField label="Dirección de Residencia" value={personalInfo.address} fullWidth />
                        </div>
                    </div>

                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="bg-slate-50 px-5 py-4 border-b border-slate-200 flex items-center gap-3">
                            <GraduationCap size={18} className="text-slate-600" />
                            <h3 className="text-sm font-black text-slate-800 uppercase tracking-wide">Formación Académica</h3>
                        </div>
                        <div className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                            <DataField label="Universidad / Institución" value={universidadName} fullWidth />
                            <DataField label="Grado / Título" value={academicStudy.degreeTitle} />
                            <DataField label="Especialidad" value={academicStudy.specialty} />
                            <DataField label="Año de Ingreso" value={academicStudy.admissionYear} />
                            <DataField label="Año de Egreso" value={academicStudy.graduationYear} />
                            {!isStudent && (
                                <>
                                    <DataField label="Colegio Profesional" value={academicStudy.professionalAssociation} />
                                    <DataField label="N° Registro (CIP)" value={academicStudy.registrationNumber} />
                                </>
                            )}
                        </div>
                    </div>

                    {!isStudent && (
                        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                            <div className="bg-slate-50 px-5 py-4 border-b border-slate-200 flex items-center gap-3">
                                <Briefcase size={18} className="text-slate-600" />
                                <h3 className="text-sm font-black text-slate-800 uppercase tracking-wide">Información Laboral</h3>
                            </div>
                            <div className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                                <DataField label="Empresa / Institución" value={employmentInfo.companyName} fullWidth />
                                <DataField label="RUC Empresa" value={employmentInfo.companyTaxId} />
                                <DataField label="Cargo" value={employmentInfo.positionName} />
                                <DataField label="Área / Departamento" value={employmentInfo.area} />
                                <DataField label="Correo Corporativo" value={employmentInfo.workEmail} />
                                <DataField label="Teléfono Trabajo" value={employmentInfo.workPhone ? `${employmentInfo.workPhone} ${employmentInfo.workExtension ? `(Anexo: ${employmentInfo.workExtension})` : ''}` : null} />
                                <DataField label="Dirección Laboral" value={employmentInfo.workingAddress} fullWidth />
                            </div>
                        </div>
                    )}

                    {!isStudent && (
                        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                            <div className="bg-slate-50 px-5 py-4 border-b border-slate-200 flex items-center gap-3">
                                <Users size={18} className="text-slate-600" />
                                <h3 className="text-sm font-black text-slate-800 uppercase tracking-wide">Avales Presentados</h3>
                            </div>
                            <div className="p-5 space-y-4">
                                <div className="p-4 rounded-xl border border-slate-100 bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                    <div className="flex flex-col gap-1">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Aval 1 - DNI {endorsements.firstEndorsement?.sponsorDocumentNumber}</span>
                                        <span className="text-[14px] font-bold text-slate-800 capitalize">{endorsements.firstEndorsement?.sponsorFullName?.toLowerCase() || 'No registrado'}</span>
                                        <span className="text-[12px] font-medium text-slate-500">{endorsements.firstEndorsement?.sponsorEmail}</span>
                                    </div>
                                    {approvals[0] && (
                                        <span className={`w-max px-3 py-1.5 text-[11px] font-bold uppercase rounded-lg border ${approvals[0].status === 'APPROVED' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : approvals[0].status === 'REJECTED' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                                            {approvals[0].status === 'APPROVED' ? 'Respaldado' : approvals[0].status === 'REJECTED' ? 'Rechazado' : 'Pendiente de respuesta'}
                                        </span>
                                    )}
                                </div>
                                
                                <div className="p-4 rounded-xl border border-slate-100 bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                    <div className="flex flex-col gap-1">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Aval 2 - DNI {endorsements.secondEndorsement?.sponsorDocumentNumber}</span>
                                        <span className="text-[14px] font-bold text-slate-800 capitalize">{endorsements.secondEndorsement?.sponsorFullName?.toLowerCase() || 'No registrado'}</span>
                                        <span className="text-[12px] font-medium text-slate-500">{endorsements.secondEndorsement?.sponsorEmail}</span>
                                    </div>
                                    {approvals[1] && (
                                        <span className={`w-max px-3 py-1.5 text-[11px] font-bold uppercase rounded-lg border ${approvals[1].status === 'APPROVED' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : approvals[1].status === 'REJECTED' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                                            {approvals[1].status === 'APPROVED' ? 'Respaldado' : approvals[1].status === 'REJECTED' ? 'Rechazado' : 'Pendiente de respuesta'}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            );
        }
        
        if (activeTab === "documentos") {
            return (
                <div className="grid grid-cols-1 gap-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
                    {payload.documents.length > 0 ? payload.documents.map((doc: any) => {
                        const friendlyName = getDocumentFriendlyName(doc.category);
                        const fileExtension = doc.fileName?.split('.').pop()?.toUpperCase() || 'PDF';

                        return (
                            <div key={doc.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 hover:border-[#C5A059] transition-all">
                                <div className="flex items-center gap-4 min-w-0">
                                    <div className="w-12 h-12 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0 text-[#C5A059]">
                                        <FileText size={24} />
                                    </div>
                                    <div className="flex flex-col min-w-0">
                                        <span className="text-[14px] font-black text-slate-800 truncate">{friendlyName}</span>
                                        <span className="text-[11px] font-medium text-slate-400 mt-0.5 truncate">
                                            Archivo: {doc.fileName} • Formato: <strong className="text-slate-600">{fileExtension}</strong>
                                        </span>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end pt-3 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                                    <button onClick={() => handleOpenSecureDocument(doc.fileUrl)} className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 hover:border-[#C5A059] hover:text-[#C5A059] rounded-xl text-xs font-bold transition-all shadow-sm">
                                        <Eye size={15} /> Previsualizar
                                    </button>
                                    <button onClick={() => handleOpenSecureDocument(doc.fileUrl)} className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2 bg-[#C5A059] text-white hover:bg-[#b58f48] rounded-xl text-xs font-bold transition-all shadow-sm">
                                        <Download size={15} /> Descargar
                                    </button>
                                </div>
                            </div>
                        );
                    }) : (
                        <div className="text-center p-12 text-slate-400 bg-white rounded-2xl border border-slate-200 border-dashed">No hay documentos adjuntos para este expediente.</div>
                    )}
                </div>
            );
        }

        if (activeTab === "historial") {
            const timelineEvents = generateTimeline(payload);

            return (
                <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-sm animate-in fade-in slide-in-from-bottom-4 duration-300">
                    <h3 className="text-[15px] font-black text-slate-800 mb-8 flex items-center gap-3 border-b border-slate-100 pb-3">
                        <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center">
                            <Activity size={16} className="text-slate-600"/>
                        </div>
                        Historial de Auditoría
                    </h3>

                    <div className="relative border-l-2 border-slate-100 ml-4 space-y-8 pb-4">
                        {timelineEvents.map((event, i) => (
                            <div key={i} className="relative pl-8">
                                <div className={`absolute -left-[17px] top-1 w-8 h-8 rounded-full border-4 border-white flex items-center justify-center shadow-sm ${event.color}`}>
                                    {event.icon}
                                </div>
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-1.5">
                                    <h4 className="text-sm font-bold text-slate-800">{event.title}</h4>
                                    <span className="text-[11px] font-bold text-slate-400 bg-slate-50 px-2 py-0.5 rounded-md w-max">
                                        {event.date.toLocaleString('es-PE', { dateStyle: 'long', timeStyle: 'short' })}
                                    </span>
                                </div>
                                
                                {event.auditor && (
                                    <span className="inline-block mt-1 mb-2 px-2.5 py-1 bg-slate-100 text-[#C5A059] text-[10px] font-black rounded uppercase tracking-wider border border-[#e8d09e]">
                                        {event.auditor.includes('SISTEMA') ? 'Ejecutado por:' : 'Validado por:'} {event.auditor}
                                    </span>
                                )}
                                
                                <p className="text-[13px] font-medium text-slate-600 leading-relaxed bg-slate-50/50 p-3 rounded-xl border border-slate-100">
                                    {event.desc}
                                </p>
                            </div>
                        ))}

                        {timelineEvents.length === 0 && (
                            <div className="pl-8 text-sm font-medium text-slate-400">
                                No se registraron eventos en la línea de tiempo.
                            </div>
                        )}
                    </div>
                </div>
            );
        }

        return null;
    };

    return (
        <div className="flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-500 pb-12">
            <ExpedientesFilterBar filters={filters} onFilterChange={handleFilterChange} totalResults={meta.total} />
            
            <div className="relative min-h-[400px]">
                {isLoading ? (
                    <div className="absolute inset-0 flex items-center justify-center bg-white/50 backdrop-blur-sm z-10 rounded-2xl">
                        <div className="flex flex-col items-center gap-3">
                            <div className="animate-spin w-10 h-10 border-4 border-[#C5A059] border-t-transparent rounded-full"></div>
                            <span className="text-sm font-bold text-slate-500">Actualizando expedientes...</span>
                        </div>
                    </div>
                ) : expedientes.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
                        {expedientes.map((exp) => (
                            <SmartCaseCard key={exp.id} data={exp} onClick={() => handleOpenDrawer(exp)} />
                        ))}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center h-[300px] text-slate-400 bg-white rounded-2xl border border-slate-200 border-dashed mt-4">
                        <p className="text-lg font-bold text-slate-600 mb-1">No se encontraron expedientes</p>
                    </div>
                )}
            </div>

            {expedientes.length > 0 && (
                <ExpedientesPagination meta={meta} onPageChange={(page) => setMeta(prev => ({ ...prev, page }))} onPageSizeChange={(pageSize) => setMeta(prev => ({ ...prev, pageSize, page: 1 }))} />
            )}

            {isMounted && showStatusModal && createPortal(
                <div className="fixed inset-0 z-[999999] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
                    <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl space-y-6">
                        <div className="w-14 h-14 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto text-[#C5A059]">
                            <AlertTriangle size={28} />
                        </div>
                        <div className="text-center">
                            <h3 className="text-xl font-black text-slate-800 mb-2">
                                {targetStatus === 'APPROVED' ? '¿Aprobar Expediente Final?' : targetStatus === 'OBSERVED' ? '¿Observar Expediente?' : '¿Validar Evaluación?'}
                            </h3>
                            <p className="text-sm font-medium text-slate-500 leading-relaxed">
                                Está a punto de cambiar el estado del trámite a <strong className="text-slate-800 uppercase">{targetStatus.replace('_', ' ')}</strong>. Su nombre de usuario quedará registrado en el historial.
                            </p>
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">Motivo o Comentario</label>
                            <textarea 
                                rows={3} 
                                placeholder="Escriba el motivo, observación o conformidad..." 
                                value={statusReason}
                                onChange={(e) => setStatusReason(e.target.value)}
                                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:border-[#C5A059] focus:ring-1 focus:ring-[#C5A059]"
                            />
                        </div>

                        <div className="flex flex-col sm:flex-row gap-3 pt-2">
                            <button 
                                onClick={() => setShowStatusModal(false)}
                                className="w-full py-3.5 bg-white border border-slate-200 text-slate-600 rounded-xl font-bold text-sm hover:bg-slate-50 transition-colors"
                            >
                                Cancelar
                            </button>
                            <button 
                                onClick={confirmStatusChange}
                                disabled={isUpdatingStatus}
                                className={`w-full py-3.5 text-white rounded-xl font-extrabold text-sm shadow-md hover:brightness-95 transition-all flex items-center justify-center gap-2 ${targetStatus === 'OBSERVED' ? 'bg-red-500 hover:bg-red-600' : 'bg-gradient-to-r from-[#dca45c] to-[#C5A059]'}`}
                            >
                                {isUpdatingStatus ? "Actualizando..." : "Sí, confirmar"}
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            <InspectionDrawer isOpen={isDrawerOpen} onClose={() => setIsDrawerOpen(false)} data={drawerData} renderContent={renderDrawerContent} />
        </div>
    );
}