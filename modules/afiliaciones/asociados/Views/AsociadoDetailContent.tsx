"use client";
/* eslint-disable @typescript-eslint/no-explicit-any -- the shared InspectionDrawer currently exposes its payload as any. */
/* eslint-disable @typescript-eslint/no-unused-vars -- legacy payment tab retained for compatibility. */

import { Activity, BriefcaseBusiness, CalendarDays, CircleAlert, CreditCard, FileText, GraduationCap, Info, Landmark, ShieldCheck, UserCircle2 } from "lucide-react";
import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SandboxPaymentResetButton } from "@/modules/afiliaciones/payments/Components/SandboxPaymentResetButton";
import { getNiubizActionCode } from "@/modules/afiliaciones/payments/Services/Niubiz/NiubizActionCodes";
import { AssociateSieProfileSection, type AssociateSieProfileViewState } from "../Components/AssociateSieProfileSection";
import { MembershipSieQuotaSummary } from "../Components/MembershipSieQuotaSummary";
import type { AssociateSieProfileResponse } from "../Services/AssociateSieProfileService";
import { formatCalendarDate, formatPeruDate, formatPeruDateTime } from "@/modules/shared/Utils/formatPeruDateTime";
import { documentTypeLabel } from "@/modules/shared/Utils/documentType";
import { AsociadosMapper } from "../Mappers/AsociadosMapper";

const formatDate = (value: string | Date | null | undefined, withTime = false) => value ? (withTime ? formatPeruDateTime(value) : formatPeruDate(value)) : "No registrado";
const formatBirthDate = (value: string | Date | null | undefined) => value ? formatCalendarDate(value) : "No registrado";
const money = (value: unknown) => new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" }).format(Number(value));
const label = (value: string) => value.replaceAll("_", " ").toLowerCase().replace(/(^|\s)\S/g, (character) => character.toUpperCase());

type AssociateSummaryEvent = { id: string; date: string | Date; title: string; description: string | null };

export function buildAssociateExecutiveSummary(user: any, application: any, completion: any, payments: any[]) {
  const category = user.role?.name ?? (application?.affiliateType === "STUDENT" ? "Asociado Estudiante" : "Asociado Activo");
  const membershipStatus = user.status === "ACTIVE" ? "HÁBIL" : label(user.status ?? "INACTIVO");
  const verifiedMemberSince = completion?.createdAt ?? null;
  const paidPayment = payments.find((payment: any) => payment.status === "PAID");
  const latestPayment = payments[0];
  const registration = paidPayment
    ? { label: "Inscripción pagada", detail: formatDate(paidPayment.gatewayTransactionDate ?? paidPayment.paymentDate ?? paidPayment.createdAt), tone: "success" as const }
    : latestPayment?.status === "PENDING" || latestPayment?.status === "PROCESSING"
      ? { label: "Inscripción en confirmación", detail: "Pago local pendiente", tone: "warning" as const }
      : latestPayment?.status === "FAILED"
        ? { label: "Inscripción rechazada", detail: "Último intento local", tone: "danger" as const }
        : { label: "Sin registro local", detail: "No permite inferir cuotas", tone: "neutral" as const };
  const recentEvents: AssociateSummaryEvent[] = (application?.history ?? [])
    .filter((event: any) => event?.createdAt)
    .map((event: any) => ({
      id: `history-${event.id}`,
      date: event.createdAt,
      title: event.newStatus === "COMPLETED" ? "Afiliación completada" : `Estado actualizado a ${label(event.newStatus ?? "DESCONOCIDO")}`,
      description: event.changeReason ?? null,
    }))
    .sort((left: AssociateSummaryEvent, right: AssociateSummaryEvent) => new Date(right.date).getTime() - new Date(left.date).getTime())
    .slice(0, 3);

  return {
    category,
    membershipStatus,
    verifiedMemberSince,
    membershipAge: verifiedMemberSince ? elapsed(verifiedMemberSince) : null,
    registration,
    lastUpdated: AsociadosMapper.toCardData(user).metadata.lastUpdatedRelative,
    recentEvents,
  };
}

function useAssociateSieProfile(applicationId: number, shouldLoad: boolean, canReadMemberships: boolean) {
  const [state, setState] = useState<AssociateSieProfileViewState>({ kind: canReadMemberships ? "idle" : "forbidden" });
  const stateRef = useRef(state);
  const requestRef = useRef<{ id: number; controller: AbortController } | null>(null);
  const requestSequence = useRef(0);
  const replaceState = useCallback((next: AssociateSieProfileViewState) => { stateRef.current = next; setState(next); }, []);
  const load = useCallback(async (force = false) => {
    if (!canReadMemberships) { replaceState({ kind: "forbidden" }); return; }
    if (!force && stateRef.current.kind !== "idle") return;
    if (requestRef.current) return;
    const id = ++requestSequence.current;
    const controller = new AbortController();
    requestRef.current = { id, controller };
    replaceState({ kind: "loading" });
    try {
      const response = await fetch(`/api/afiliaciones/asociados/${applicationId}/sie`, { cache: "no-store", signal: controller.signal });
      const body = await response.json() as { success?: boolean; data?: AssociateSieProfileResponse; message?: string };
      if (response.status === 401) { if (requestRef.current?.id === id) replaceState({ kind: "unauthenticated" }); return; }
      if (response.status === 403) { if (requestRef.current?.id === id) replaceState({ kind: "forbidden" }); return; }
      if (!response.ok || !body.success || !body.data) {
        if (requestRef.current?.id === id) replaceState({ kind: "error", message: body.message || "No pudimos consultar SIE en este momento.", retryable: response.status === 502 || response.status === 503 });
        return;
      }
      if (requestRef.current?.id === id) replaceState({ kind: "loaded", data: body.data });
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError") && requestRef.current?.id === id) replaceState({ kind: "error", message: "No fue posible conectar con SIE. Intenta nuevamente.", retryable: true });
    } finally { if (requestRef.current?.id === id) requestRef.current = null; }
  }, [applicationId, canReadMemberships, replaceState]);
  useEffect(() => { if (shouldLoad) void load(); }, [shouldLoad, load]);
  useEffect(() => () => { requestRef.current?.controller.abort(); requestRef.current = null; }, []);
  return { state, refresh: () => { if (!requestRef.current) void load(true); } };
}

function PaymentsTabDetailed({ payments, canViewTechnical, canResetSandboxPayments }: { payments: any[]; canViewTechnical: boolean; canResetSandboxPayments: boolean }) {
  const [filter, setFilter] = useState("ALL");
  const filtered = useMemo(() => filter === "ALL" ? payments : payments.filter((payment) => payment.status === filter), [filter, payments]);
  const paid = payments.find((payment) => payment.status === "PAID");
  const latest = payments[0];
  const billing = (paid ?? latest)?.billing;
  return <div className="space-y-5"><InfoNotice text="Aquí puedes revisar los pagos, intentos de transacción, facturación y comprobantes asociados a esta membresía."/><Section icon={<CreditCard/>} title="Resumen financiero"><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><Metric label="Estado de inscripción" value={paid ? "Pagado" : latest?.status === "FAILED" ? "Rechazado" : "Pendiente"} success={Boolean(paid)}/><Metric label="Monto" value={paid ? money(paid.totalAmount) : latest ? money(latest.totalAmount) : "No disponible"}/><Metric label="Fecha de pago" value={paid ? formatDate(paid.gatewayTransactionDate ?? paid.paymentDate ?? paid.createdAt, true) : "No disponible"}/><Metric label="Método / Gateway" value={paid ? `${label(paid.gateway ?? "NIUBIZ")} · Tarjeta` : "No disponible"}/></div></Section>{billing && <Section icon={<FileText/>} title="Datos de facturación"><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"><Field label="Tipo" value={billing.taxId?.length === 11 ? "Factura" : "Boleta"}/><Field label="Documento" value={billing.taxId}/><Field label="Nombre / razón social" value={billing.businessName}/><Field label="Email" value={billing.billingEmail}/><Field label="Dirección fiscal" value={billing.billingAddress}/><Field label="Comprobante" value={billing.invoice ? `${label(billing.invoice.type)} ${billing.invoice.serie}-${billing.invoice.number}` : "Comprobante pendiente de emisión"}/></div>{billing.invoice?.pdfUrl && <a href={billing.invoice.pdfUrl} target="_blank" rel="noreferrer" className="mt-4 inline-block rounded-xl border border-[#E6C982] px-4 py-2 text-xs font-bold text-[#936B2E]">Ver comprobante</a>}</Section>}<Section icon={<Landmark/>} title="Historial de intentos"><div className="mb-4 flex gap-2">{[["ALL", "Todos"], ["PAID", "Pagados"], ["FAILED", "Rechazados"], ["PENDING", "Pendientes"]].map(([value, text]) => <button key={value} type="button" onClick={() => setFilter(value)} className={`rounded-full px-3 py-1.5 text-xs font-bold ${filter === value ? "bg-[#C5A059] text-white" : "bg-slate-100 text-slate-600"}`}>{text}</button>)}</div>{filtered.length === 0 ? <Empty text="No hay intentos para este filtro."/> : <div className="space-y-4">{filtered.map((payment: any) => <article key={payment.id} className="rounded-xl border border-slate-200 p-4"><div className="flex items-center justify-between"><h3 className="font-black text-slate-800">Payment #{payment.id}</h3><Status value={payment.status}/></div><div className="mt-3 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4"><Field label="Fecha" value={formatDate(payment.gatewayTransactionDate ?? payment.paymentDate ?? payment.createdAt, true)}/><Field label="Monto" value={money(payment.totalAmount)}/><Field label="Gateway" value={label(payment.gateway)}/><Field label="Transaction ID" value={payment.transactionId}/><Field label="Authorization Code" value={payment.authorizationCode}/><Field label="Código" value={payment.actionCode ?? payment.failureCode}/><Field label="Trace Number" value={payment.traceNumber}/><Field label="Marca" value={payment.cardBrand}/><Field label="Tipo" value={payment.cardType === "C" ? "Crédito" : payment.cardType === "D" ? "Débito" : payment.cardType}/><Field label="Tarjeta" value={payment.maskedCard}/><Field label="Canal" value={payment.paymentChannel}/><Field label="Motivo" value={payment.failureReason ?? getNiubizActionCode(payment.actionCode ?? payment.failureCode)?.label}/></div>{payment.status === "PENDING" && <p className="mt-3 text-xs text-amber-700">Pago pendiente de confirmación.</p>}{canViewTechnical && <details className="mt-4 border-t border-slate-100 pt-3"><summary className="cursor-pointer text-xs font-bold text-slate-500">Detalle técnico</summary><div className="mt-3 grid gap-3 sm:grid-cols-3"><Field label="Response Code" value={payment.responseCode}/><Field label="Gateway Error" value={payment.gatewayErrorCode}/><Field label="Confirmación enviada" value={formatDate(payment.confirmationEmailSentAt, true)}/></div></details>}{canResetSandboxPayments && payment.gateway === "NIUBIZ" && payment.status !== "PROCESSING" && !payment.billing?.invoice && <div className="mt-4"><SandboxPaymentResetButton paymentId={payment.id}/></div>}</article>)}</div>}</Section></div>;
}

export function AsociadoDetailContent({ tab, user, canResetSandboxPayments = false, canReadMemberships = false, onSelectTab }: { tab: string; user: any; canResetSandboxPayments?: boolean; canReadMemberships?: boolean; onSelectTab?: (tab: string) => void }) {
  const { state: sieState, refresh: refreshSie } = useAssociateSieProfile(user.id, tab === "sie" || tab === "membresia", canReadMemberships);
  const person = user.person ?? {};
  const applications = person.applications ?? [];
  const application = applications.find((item: any) => item.status === "COMPLETED") ?? applications[0];
  const completion = application?.history?.find((item: any) => item.newStatus === "COMPLETED");
  const memberSince = completion?.createdAt ?? application?.updatedAt;
  const payments = applications.flatMap((item: any) => item.payments ?? []).sort((a: any, b: any) => new Date(b.paymentDate ?? b.createdAt).getTime() - new Date(a.paymentDate ?? a.createdAt).getTime());
  const paidPayments = payments.filter((payment: any) => payment.status === "PAID");
  const documents = applications.flatMap((item: any) => item.documents ?? []).sort((a: any, b: any) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  const address = person.addresses?.find((item: any) => item.isPrimary) ?? person.addresses?.[0];
  const contact = person.contacts?.find((item: any) => item.isPrimary) ?? person.contacts?.[0];
  const academic = person.academicInfos?.[0];
  const employment = person.employmentInfos?.[0];
  const category = user.role?.name ?? (application?.affiliateType === "STUDENT" ? "Asociado Estudiante" : "Asociado Activo");
  const code = person.documentNumber ?? "No registrado";

  if (tab === "resumen") return <AssociateExecutiveSummary user={user} application={application} completion={completion} payments={payments}/>;
  if (tab === "informacion") return <div className="space-y-5"><InfoNotice text="Consulta los datos personales, académicos y laborales registrados durante su afiliación."/><Section icon={<UserCircle2/>} title="Datos personales"><div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3"><Field label="Nombres" value={person.firstName}/><Field label="Apellido paterno" value={person.paternalLastName}/><Field label="Apellido materno" value={person.maternalLastName}/><Field label="Documento" value={person.documentType ? `${documentTypeLabel(person.documentType)} ${person.documentNumber}` : person.documentNumber}/><Field label="Fecha de nacimiento" value={formatBirthDate(person.birthDate)}/><Field label="Nacionalidad" value={person.nationality?.name}/><Field label="Correo principal" value={contact?.email ?? user.email}/><Field label="Teléfono" value={contact?.phoneNumber}/><Field label="Dirección" value={address?.street} full/></div></Section><Section icon={<GraduationCap/>} title="Formación académica"><div className="grid gap-5 sm:grid-cols-2"><Field label="Universidad" value={academic?.university?.name}/><Field label="Carrera o especialidad" value={academic?.specialty?.name}/><Field label="Grado" value={academic?.degree?.name ?? academic?.degreeTitle}/><Field label="Ciclo" value={academic?.termOrSemester}/><Field label="Año de egreso" value={academic?.graduationYear}/><Field label="Colegiatura" value={academic?.professionalAssociation}/><Field label="Número de colegiatura" value={academic?.licenseNumber}/></div></Section><Section icon={<BriefcaseBusiness/>} title="Información laboral"><div className="grid gap-5 sm:grid-cols-2"><Field label="Empresa actual" value={employment?.company?.name}/><Field label="Cargo" value={employment?.position?.name}/><Field label="Área" value={employment?.area}/><Field label="Correo corporativo" value={employment?.workEmail}/><Field label="Teléfono de trabajo" value={employment?.workPhone}/><Field label="Dirección laboral" value={employment?.workingAddress}/></div></Section></div>;
  if (tab === "membresia") return <div className="space-y-5"><Section icon={<ShieldCheck/>} title="Membresía"><div className="grid gap-5 sm:grid-cols-2"><Field label="Categoría" value={category}/><Field label="Estado" value={user.status === "ACTIVE" ? "HÁBIL" : label(user.status ?? "INACTIVO")}/><Field label="Código" value={code}/><Field label="Fecha de afiliación" value={formatDate(memberSince)}/><Field label="Antigüedad" value={memberSince ? elapsed(memberSince) : null}/><Field label="Proceso de afiliación" value={application?.applicationCode}/></div></Section><MembershipSieQuotaSummary state={sieState} canReadMemberships={canReadMemberships} onRetry={refreshSie} onViewDetails={() => onSelectTab?.("sie")}/><p className="rounded-xl border border-slate-100 bg-slate-50 p-4 text-sm leading-6 text-slate-500">El sistema actual no registra cambios de categoría ni estados institucionales como suspensión, baja o retiro. Esta ficha muestra únicamente el estado de cuenta realmente disponible.</p></div>;
  if (tab === "pagos") return <PaymentsTabDetailed payments={payments} canViewTechnical={canResetSandboxPayments} canResetSandboxPayments={canResetSandboxPayments}/>;
  if (tab === "sie") return <AssociateSieProfileSection state={sieState} onRefresh={refreshSie}/>;
  if (tab === "cuenta") return <div className="space-y-5"><Section icon={<UserCircle2/>} title="Cuenta y acceso"><div className="grid gap-5 sm:grid-cols-2"><Field label="Estado de cuenta" value={label(user.status ?? "PENDING")}/><Field label="Usuario" value={user.email}/><Field label="Creada" value={formatDate(user.createdAt)}/><Field label="Último acceso" value={formatDate(user.lastLoginAt, true)}/><Field label="Rol" value={user.role?.name ?? user.role?.slug}/></div></Section><p className="rounded-xl border border-slate-100 bg-slate-50 p-4 text-sm leading-6 text-slate-500">Esta ficha no muestra ni gestiona contraseñas. La creación automática de cuentas y enlaces seguros de acceso corresponde a una fase posterior.</p></div>;
  if (tab === "documentos") return <DocumentsTab documents={documents}/>;
  if (tab === "historial") return <HistoryTab user={user} applications={applications} payments={paidPayments}/>;
  return <Empty text="No hay información disponible."/>;
}

function AssociateExecutiveSummary({ user, application, completion, payments }: { user: any; application: any; completion: any; payments: any[] }) {
  const summary = buildAssociateExecutiveSummary(user, application, completion, payments);
  const attentionItems = [
    ...(user.status === "ACTIVE" ? [] : [{ icon: <CircleAlert size={16}/>, text: `Membresía ${summary.membershipStatus.toLowerCase()}.`, tone: "text-amber-700" }]),
    ...(summary.registration.tone === "warning" || summary.registration.tone === "danger" ? [{ icon: <CreditCard size={16}/>, text: summary.registration.label, tone: summary.registration.tone === "danger" ? "text-red-700" : "text-amber-700" }] : []),
  ];
  const registrationTone = summary.registration.tone === "success" ? "text-emerald-700" : summary.registration.tone === "warning" ? "text-amber-700" : summary.registration.tone === "danger" ? "text-red-700" : "text-slate-700";

  return <div className="space-y-6 sm:space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
    <section aria-labelledby="associate-summary-indicators">
      <h2 id="associate-summary-indicators" className="mb-3 flex items-center gap-2 text-[13px] font-bold text-slate-800"><Activity size={16} className="text-[#C5A059]"/>Indicadores principales</h2>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <ExecutiveMetric icon={<ShieldCheck size={17}/>} label="Membresía" value={summary.membershipStatus} detail={summary.category} valueClass={user.status === "ACTIVE" ? "text-emerald-700" : "text-slate-800"}/>
        <ExecutiveMetric icon={<CalendarDays size={17}/>} label="Antigüedad" value={summary.membershipAge ?? "No registrada"} detail={summary.verifiedMemberSince ? `Incorporación: ${formatDate(summary.verifiedMemberSince)}` : "Sin fecha verificable"}/>
        <ExecutiveMetric icon={<CreditCard size={17}/>} label="Inscripción" value={summary.registration.label} detail={summary.registration.detail} valueClass={registrationTone}/>
        <ExecutiveMetric icon={<Activity size={17}/>} label="Última actividad" value={summary.lastUpdated.replace("Actualizado: ", "")} detail="Actualización del registro"/>
      </div>
    </section>

    <section aria-labelledby="associate-summary-current">
      <h2 id="associate-summary-current" className="mb-3 text-[13px] font-bold text-slate-800">Situación actual</h2>
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex items-start gap-3"><ShieldCheck size={19} className={user.status === "ACTIVE" ? "mt-0.5 shrink-0 text-emerald-600" : "mt-0.5 shrink-0 text-amber-600"}/><div><p className="text-sm font-black text-slate-800">{summary.membershipStatus === "HÁBIL" ? "Membresía habilitada" : `Membresía ${summary.membershipStatus.toLowerCase()}`}</p><p className="mt-1 text-xs leading-5 text-slate-500">Categoría registrada: {summary.category}.</p></div></div>
        <div className="mt-4 border-t border-slate-100 pt-4">
          {attentionItems.length > 0 ? <ul className="space-y-2" aria-label="Pendientes confirmados">{attentionItems.map((item) => <li key={item.text} className={`flex items-center gap-2 text-sm font-semibold ${item.tone}`}>{item.icon}{item.text}</li>)}</ul> : <p className="text-sm text-slate-500">No hay pendientes confirmados en los datos locales disponibles.</p>}
          <p className="mt-3 text-xs leading-5 text-slate-400">La inscripción local no determina la situación de cuotas u otras obligaciones.</p>
        </div>
      </div>
    </section>

    <section aria-labelledby="associate-summary-activity">
      <h2 id="associate-summary-activity" className="mb-3 text-[13px] font-bold text-slate-800">Actividad reciente</h2>
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        {summary.recentEvents.length === 0 ? <div className="flex items-center gap-3 py-2 text-sm text-slate-500"><CalendarDays size={18} className="text-slate-400"/>No hay movimientos registrados en el historial disponible.</div> : <ol className="space-y-4 border-l-2 border-slate-100 pl-5">{summary.recentEvents.map((event) => <li key={event.id} className="relative"><span className="absolute -left-[29px] top-1.5 h-3 w-3 rounded-full border-2 border-white bg-[#C5A059]"/><p className="text-xs font-semibold text-slate-400">{formatDate(event.date, true)}</p><h3 className="mt-1 text-sm font-black text-slate-800">{event.title}</h3>{event.description && <p className="mt-1 text-sm leading-6 text-slate-500">{event.description}</p>}</li>)}</ol>}
      </div>
    </section>
  </div>;
}

function ExecutiveMetric({ icon, label: metricLabel, value, detail, valueClass = "text-slate-800" }: { icon: ReactNode; label: string; value: string; detail: string; valueClass?: string }) {
  return <article className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-center gap-2 text-[#C5A059]"><span>{icon}</span><p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{metricLabel}</p></div><p className={`mt-3 break-words text-sm font-black leading-5 ${valueClass}`}>{value}</p><p className="mt-1 text-xs leading-5 text-slate-500">{detail}</p></article>;
}

function PaymentsTab({ payments, canResetSandboxPayments }: { payments: any[]; canResetSandboxPayments: boolean }) { const total = payments.filter((payment) => payment.status === "PAID").reduce((sum, payment) => sum + Number(payment.totalAmount), 0); return <div className="space-y-5"><InfoNotice text="Revisa los pagos registrados y los datos de facturación relacionados."/><Section icon={<CreditCard/>} title="Pagos"><div className="grid gap-4 sm:grid-cols-2"><Metric label="Total pagado" value={money(total)}/><Metric label="Último pago" value={payments[0] ? formatDate(payments[0].paymentDate ?? payments[0].createdAt) : "No registrado"}/></div></Section>{payments.length === 0 ? <Empty text="No hay pagos registrados."/> : <Section icon={<Landmark/>} title="Historial de pagos"><div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="border-b border-slate-100 text-[11px] uppercase tracking-wide text-slate-400"><tr><th className="pb-3 pr-4">Concepto</th><th className="pb-3 pr-4">Fecha</th><th className="pb-3 pr-4">Monto</th><th className="pb-3 pr-4">Método</th><th className="pb-3">Estado</th><th className="pb-3">Acciones</th></tr></thead><tbody className="divide-y divide-slate-100">{payments.map((payment) => <tr key={payment.id}><td className="py-3 pr-4 font-bold text-slate-700">Inscripción IIMP</td><td className="py-3 pr-4 text-slate-500">{formatDate(payment.paymentDate ?? payment.createdAt, true)}</td><td className="py-3 pr-4 font-semibold text-slate-700">{money(payment.totalAmount)}</td><td className="py-3 pr-4 text-slate-500">{label(payment.gateway)}</td><td className="py-3"><Status value={payment.status}/></td><td className="py-3">{canResetSandboxPayments && payment.gateway === "NIUBIZ" && payment.status !== "PROCESSING" && !payment.billing?.invoice ? <SandboxPaymentResetButton paymentId={payment.id}/> : null}</td></tr>)}</tbody></table></div></Section>}</div>; }
function DocumentsTab({ documents }: { documents: any[] }) { return <Section icon={<FileText/>} title="Documentos">{documents.length === 0 ? <Empty text="No hay documentos registrados."/> : <div className="divide-y divide-slate-100">{documents.map((document) => <div key={document.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-bold text-slate-800">{label(document.category)}</p><p className="mt-1 text-sm text-slate-500">{document.fileName}</p><p className="mt-1 text-xs text-slate-400">Actualizado: {formatDate(document.updatedAt)}</p></div><a href={document.fileUrl} target="_blank" rel="noreferrer" className="w-fit rounded-xl border border-[#E6C982] px-3 py-2 text-xs font-bold text-[#936B2E] hover:bg-[#FFF8E8]">Ver documento</a></div>)}</div>}</Section>; }
function HistoryTab({ user, applications, payments }: { user: any; applications: any[]; payments: any[] }) { const events = [...applications.flatMap((application) => (application.history ?? []).map((item: any) => ({ id: `history-${item.id}`, date: item.createdAt, title: item.newStatus === "COMPLETED" ? "Afiliación completada" : `Estado actualizado a ${label(item.newStatus)}`, description: item.changeReason ?? "Se actualizó el proceso de afiliación." }))), ...payments.map((payment) => ({ id: `payment-${payment.id}`, date: payment.paymentDate ?? payment.createdAt, title: "Pago aprobado", description: `Se confirmó un pago de inscripción por ${money(payment.totalAmount)}.` })), { id: `account-${user.id}`, date: user.createdAt, title: "Cuenta registrada", description: "Se registró la cuenta de acceso asociada a esta persona." }].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()); return <Section icon={<CalendarDays/>} title="Historial institucional">{events.length === 0 ? <Empty text="No hay eventos disponibles."/> : <div className="space-y-4 border-l-2 border-slate-100 pl-5">{events.map((event) => <article key={event.id} className="relative"><span className="absolute -left-[29px] top-1.5 h-3 w-3 rounded-full border-2 border-white bg-[#C5A059]"/><p className="text-xs font-semibold text-slate-400">{formatDate(event.date, true)}</p><h3 className="mt-1 font-black text-slate-800">{event.title}</h3><p className="mt-1 text-sm leading-6 text-slate-500">{event.description}</p></article>)}</div>}</Section>; }
function Section({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) { const notice: Record<string, string> = { "Membresía": "Consulta la categoría, fecha de afiliación y situación institucional actual del asociado.", "Cuenta y acceso": "Consulta el estado de la cuenta de acceso asociada a esta persona.", "Documentos": "Consulta los documentos conservados del proceso de afiliación.", "Historial institucional": "Revisa los principales eventos y cambios relacionados con el asociado." }; return <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="flex items-center gap-3 border-b border-slate-100 bg-slate-50 px-5 py-4"><span className="text-[#C5A059]">{icon}</span><h2 className="text-sm font-black uppercase tracking-wide text-slate-800">{title}</h2></div><div className="p-5">{notice[title] && <InfoNotice text={notice[title]}/>}<div className={notice[title] ? "mt-4" : ""}>{children}</div></div></section>; }
function Field({ label: fieldLabel, value, full }: { label: string; value: unknown; full?: boolean }) { return <div className={full ? "sm:col-span-2 lg:col-span-3" : ""}><p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{fieldLabel}</p><p className="mt-1 text-[13px] font-semibold text-slate-800">{value === null || value === undefined || value === "" ? <span className="italic font-medium text-slate-300">No registrado</span> : String(value)}</p></div>; }
function Metric({ label: metricLabel, value, success }: { label: string; value: string; success?: boolean }) { return <div className="rounded-xl border border-slate-100 bg-slate-50 p-4"><p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{metricLabel}</p><p className={`mt-1 text-base font-black ${success ? "text-emerald-700" : "text-slate-800"}`}>{value}</p></div>; }
function Status({ value }: { value: string }) { return <span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${value === "PAID" ? "bg-emerald-50 text-emerald-700" : value === "FAILED" ? "bg-red-50 text-red-700" : "bg-slate-100 text-slate-600"}`}>{label(value)}</span>; }
function Empty({ text }: { text: string }) { return <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-5 text-center text-sm font-medium text-slate-500">{text}</p>; }
function InfoNotice({ text }: { text: string }) { return <div className="flex items-center gap-2 rounded-xl border border-blue-100 bg-blue-50/60 px-3 py-2.5 text-xs text-blue-700"><Info size={15} className="shrink-0 text-blue-500"/>{text}</div>; }
function elapsed(value: string | Date) { const months = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / (1000 * 60 * 60 * 24 * 30.44))); return months === 0 ? "Menos de un mes" : `${months} ${months === 1 ? "mes" : "meses"}`; }
