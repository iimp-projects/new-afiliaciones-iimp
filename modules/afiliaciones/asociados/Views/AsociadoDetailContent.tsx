"use client";
/* eslint-disable @typescript-eslint/no-explicit-any -- the shared InspectionDrawer currently exposes its payload as any. */
/* eslint-disable @typescript-eslint/no-unused-vars -- legacy payment tab retained for compatibility. */

import { AlertCircle, Briefcase, History, CheckCircle2, Clock, FileText, GraduationCap, Landmark, MinusCircle, User, XCircle } from "lucide-react";
import { DynamicIcon } from "@/modules/layout/Utils/DynamicIcon";
import { PortalAccessCard } from "@/modules/afiliaciones/expedientes/Components/Drawer/Tabs/PortalAccessCard";
import { AssociateAccessActions } from "../Components/AssociateAccessActions";
import type { ReactNode } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { SandboxPaymentResetButton } from "@/modules/afiliaciones/payments/Components/SandboxPaymentResetButton";
import type { AssociateSieProfileViewState } from "../Components/AssociateSieProfileSection";
import type { AssociateSieProfileResponse } from "../Services/AssociateSieProfileService";
import { paymentOriginLabel } from "@/modules/afiliaciones/payments/Models/PaymentOrigin";
import { formatCalendarDate, formatPeruDate, formatPeruDateTime } from "@/modules/shared/Utils/formatPeruDateTime";
import { documentTypeLabel } from "@/modules/shared/Utils/documentType";
import { AsociadosMapper } from "../Mappers/AsociadosMapper";
import { AdminCarnetPanel } from "@/modules/afiliaciones/carnet/Views/AdminCarnetPanel";

const formatDate = (value: string | Date | null | undefined, withTime = false) => value ? (withTime ? formatPeruDateTime(value) : formatPeruDate(value)) : "No registrado";
const formatBirthDate = (value: string | Date | null | undefined) => value ? formatCalendarDate(value) : "No registrado";
const money = (value: unknown) => new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" }).format(Number(value));
const label = (value: string) => value.replaceAll("_", " ").toLowerCase().replace(/(^|\s)\S/g, (character) => character.toUpperCase());

type AssociateSummaryEvent = { id: string; date: string | Date; title: string; description: string | null };

export function buildAssociateExecutiveSummary(user: any, application: any, completion: any, payments: any[], isHistorical = false) {
  const category = user.role?.name ?? (application?.affiliateType === "STUDENT" ? "Asociado Estudiante" : "Asociado Activo");
  const membershipStatus = isHistorical ? "COMPLETADO" : user.status === "ACTIVE" ? "HÁBIL" : label(user.status ?? "INACTIVO");
  const verifiedMemberSince = completion?.createdAt ?? null;
  const paidPayment = payments.find((payment: any) => payment.status === "PAID");
  const latestPayment = payments[0];
  const registration = isHistorical
    ? { label: "Histórico SIE", detail: "Asociado histórico sin postulación V2", tone: "neutral" as const }
    : paidPayment
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

function useAssociateSieProfile(lookup: { id: number; type: "application" | "person" }, shouldLoad: boolean, canReadMemberships: boolean) {
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
      const siePath = lookup.type === "person" ? `/api/afiliaciones/asociados/person/${lookup.id}/sie` : `/api/afiliaciones/asociados/${lookup.id}/sie`;
      const response = await fetch(siePath, { cache: "no-store", signal: controller.signal });
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
  }, [lookup.id, lookup.type, canReadMemberships, replaceState]);
  useEffect(() => { if (shouldLoad) void load(); }, [shouldLoad, load]);
  useEffect(() => () => { requestRef.current?.controller.abort(); requestRef.current = null; }, []);
  return { state, refresh: () => { if (!requestRef.current) void load(true); } };
}

export function AsociadoDetailContent({ tab, user, canResetSandboxPayments = false, canReadMemberships = false, onSelectTab }: { tab: string; user: any; canResetSandboxPayments?: boolean; canReadMemberships?: boolean; onSelectTab?: (tab: string) => void }) {
  const isHistorical = user.source === "SIE_HISTORICAL";
  const sieLookup = isHistorical ? { id: user.person?.id as number, type: "person" as const } : { id: user.id as number, type: "application" as const };
  const { state: sieState } = useAssociateSieProfile(sieLookup, tab === "membresia-pagos", canReadMemberships);
  const person = user.person ?? {};
  const applications = person.applications ?? [];
  const application = applications.find((item: any) => item.status === "COMPLETED") ?? applications[0];
  const completion = application?.history?.find((item: any) => item.newStatus === "COMPLETED");
  const payments = applications.flatMap((item: any) => item.payments ?? []).sort((a: any, b: any) => new Date(b.paymentDate ?? b.createdAt).getTime() - new Date(a.paymentDate ?? a.createdAt).getTime());
  const paidPayments = payments.filter((payment: any) => payment.status === "PAID");
  const address = person.addresses?.find((item: any) => item.isPrimary) ?? person.addresses?.[0];
  const contact = person.contacts?.find((item: any) => item.isPrimary) ?? person.contacts?.[0];
  const academic = person.academicInfos?.[0];
  const employment = person.employmentInfos?.[0];
  const isStudentMember = user.membershipCategory?.code === "E" || user.role?.slug === "ASOCIADO_ESTUDIANTE" || application?.affiliateType === "STUDENT";

  if (tab === "resumen") return <AssociateExecutiveSummary user={user} application={application} completion={completion} payments={payments} isHistorical={isHistorical}/>;
  if (tab === "informacion") return <div className="space-y-5"><Section icon={<User/>} title="Datos personales"><div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{isHistorical && <Field label="Código institucional" value={user.sieCode}/>}<Field label="Nombres" value={person.firstName}/><Field label="Apellido paterno" value={person.paternalLastName}/><Field label="Apellido materno" value={person.maternalLastName}/><Field label="Documento" value={person.documentType ? `${documentTypeLabel(person.documentType)} ${person.documentNumber}` : person.documentNumber}/><Field label="Fecha de nacimiento" value={formatBirthDate(person.birthDate)}/><Field label="Nacionalidad" value={person.nationality?.name}/><Field label="Correo principal" value={contact?.email ?? user.email}/><Field label="Teléfono" value={contact?.phoneNumber}/><Field label="Dirección" value={address?.street} full/><Field label="País" value={address?.country?.name}/><Field label="Departamento" value={address?.district?.province?.department?.name}/><Field label="Provincia" value={address?.district?.province?.name}/><Field label="Distrito" value={address?.district?.name}/></div></Section><Section icon={<GraduationCap/>} title="Formación académica"><div className="grid gap-5 sm:grid-cols-2"><Field label="Universidad" value={academic?.university?.name}/><Field label="Carrera o especialidad" value={academic?.specialty?.name}/><Field label="Grado" value={academic?.degree?.name ?? academic?.degreeTitle}/><Field label="Ciclo" value={academic?.termOrSemester}/><Field label="Año de egreso" value={academic?.graduationYear}/><Field label="Colegiatura" value={academic?.professionalAssociation}/><Field label="Número de colegiatura" value={academic?.licenseNumber}/></div></Section>{!isStudentMember && <Section icon={<Briefcase/>} title="Información laboral"><div className="grid gap-5 sm:grid-cols-2"><Field label="Empresa actual" value={employment?.company?.name}/><Field label="Cargo" value={employment?.position?.name}/><Field label="Área" value={employment?.area}/><Field label="Correo corporativo" value={employment?.workEmail}/><Field label="Teléfono de trabajo" value={employment?.workPhone}/><Field label="Dirección laboral" value={employment?.workingAddress}/></div></Section>}</div>;
  if (tab === "membresia-pagos") return <MembershipPaymentsTab payments={payments} sieState={sieState} canResetSandboxPayments={canResetSandboxPayments}/>;
  if (tab === "cuenta") { const account = person.user; return <div className="space-y-5">{isHistorical ? (account ? <Section icon={<User/>} title="Cuenta y acceso"><div className="grid gap-5 sm:grid-cols-2"><Field label="Estado de cuenta" value={label(account.status ?? "PENDING")}/><Field label="Usuario" value={account.email}/><Field label="Creada" value={formatDate(account.createdAt)}/><Field label="Último acceso" value={formatDate(account.lastLoginAt, true)}/><Field label="Rol" value={account.role?.name ?? account.role?.slug}/></div></Section> : <Empty text="Este asociado no tiene una cuenta de acceso en el sistema."/>) : <Section icon={<User/>} title="Cuenta y acceso"><div className="grid gap-5 sm:grid-cols-2"><Field label="Estado de cuenta" value={label(user.status ?? "PENDING")}/><Field label="Usuario" value={user.email}/><Field label="Creada" value={formatDate(user.createdAt)}/><Field label="Último acceso" value={formatDate(user.lastLoginAt, true)}/><Field label="Rol" value={user.role?.name ?? user.role?.slug}/></div></Section>}{typeof person.id === "number" && <AssociateAccessActions personId={person.id} applicationId={application?.status === "COMPLETED" && application?.id ? Number(application.id) : undefined} hasPaidPayment={payments.some((payment: any) => payment.status === "PAID")} />}</div>; }
  if (tab === "historial") return <HistoryTab user={user} applications={applications} payments={paidPayments}/>;
  if (tab === "carnet" && typeof person.id === "number") return <AdminCarnetPanel personId={person.id}/>;
  return <Empty text="No hay información disponible."/>;
}

type SieFinancialBucket = Array<{ moneda: string; amount: number }>;

export function summarizeSieFinancials(quotas: any[]): { invoiced: SieFinancialBucket; pending: SieFinancialBucket } {
  const invoiced = new Map<string, number>();
  const pending = new Map<string, number>();
  for (const quota of quotas) {
    const bucket = quota.estadoContable === "Facturado" ? invoiced : pending;
    bucket.set(quota.moneda, (bucket.get(quota.moneda) ?? 0) + Number(quota.monto));
  }
  return {
    invoiced: Array.from(invoiced, ([moneda, amount]) => ({ moneda, amount })),
    pending: Array.from(pending, ([moneda, amount]) => ({ moneda, amount })),
  };
}

const sieMoney = (value: number, currency: string) => `${currency} ${new Intl.NumberFormat("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)}`;

type EconomicRow = {
  id: string;
  fecha: Date | null;
  concepto: string;
  periodo: string;
  origen: "SIE" | "Sistema de Afiliaciones";
  estado: string;
  monto: string;
  comprobante: string;
  comprobanteUrl?: string;
  observaciones: string;
  payment: any | null;
};

export function buildEconomicRows(sieQuotas: any[], payments: any[]): EconomicRow[] {
  const sieRows: EconomicRow[] = sieQuotas.map((quota, index) => ({
    id: `sie-${index}`,
    fecha: quota.fechaPago ? new Date(quota.fechaPago) : null,
    concepto: quota.concepto === "INSCRIPCION" ? "Inscripción" : `Cuota ${quota.numero ?? ""}`.trim(),
    periodo: quota.fechaInicio && quota.fechaFin ? `${quota.fechaInicio} — ${quota.fechaFin}` : quota.anno ? String(quota.anno) : "—",
    origen: "SIE",
    estado: quota.estadoContable,
    monto: sieMoney(quota.monto, quota.moneda),
    comprobante: quota.docGSer && quota.docGNro ? `${quota.docGSer}-${quota.docGNro}` : "—",
    observaciones: quota.tipo || "—",
    payment: null,
  }));
  const paymentRows: EconomicRow[] = payments.map((payment) => ({
    id: `payment-${payment.id}`,
    fecha: payment.paymentDate ? new Date(payment.paymentDate) : payment.createdAt ? new Date(payment.createdAt) : null,
    concepto: "Inscripción IIMP",
    periodo: "—",
    origen: "Sistema de Afiliaciones",
    estado: payment.status,
    monto: money(payment.totalAmount),
    comprobante: payment.billing?.invoice ? `${label(payment.billing.invoice.type ?? "Comprobante")} ${payment.billing.invoice.serie}-${payment.billing.invoice.number}` : "—",
    comprobanteUrl: payment.billing?.invoice?.pdfUrl,
    observaciones: payment.gateway ? label(payment.gateway) : "—",
    payment,
  }));
  return [...sieRows, ...paymentRows].sort((left, right) => (right.fecha?.getTime() ?? 0) - (left.fecha?.getTime() ?? 0));
}

function OriginBadge({ origen, payment }: { origen: EconomicRow["origen"]; payment: any | null }) {
  if (origen === "SIE") return <span className="whitespace-nowrap rounded-full bg-sky-50 px-2.5 py-1 text-[10px] font-black text-sky-700">SIE</span>;
  const originLabel = paymentOriginLabel(payment) || "Pasarela";
  const manual = originLabel === "Manual";
  return <span className={`whitespace-nowrap rounded-full px-2.5 py-1 text-[10px] font-black ${manual ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"}`}>{originLabel}</span>;
}

function EconomicStatus({ value, origen }: { value: string; origen: EconomicRow["origen"] }) {
  if (origen === "SIE") return <span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${value === "Facturado" ? "bg-emerald-50 text-emerald-700" : value === "Pendiente" ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-600"}`}>{value}</span>;
  return <Status value={value}/>;
}

function MembershipPaymentsTab({ payments, sieState, canResetSandboxPayments }: { payments: any[]; sieState: AssociateSieProfileViewState; canResetSandboxPayments: boolean }) {
  const [originFilter, setOriginFilter] = useState<"ALL" | "SIE" | "PASARELA">("ALL");
  const sieQuotas = sieState.kind === "loaded" && sieState.data.registered ? sieState.data.quotas : [];
  const rows = buildEconomicRows(sieQuotas, payments);
  const filteredRows = originFilter === "ALL" ? rows : originFilter === "SIE" ? rows.filter((row) => row.origen === "SIE") : rows.filter((row) => row.origen !== "SIE");
  const emptyMessage = sieState.kind === "loading"
    ? "Consultando información de SIE…"
    : sieState.kind === "error"
      ? sieState.message
      : sieState.kind === "forbidden" || sieState.kind === "unauthenticated"
        ? "No tienes permiso para consultar la información de SIE."
        : "No hay operaciones económicas registradas.";

  return (
    <div className="space-y-5">
      <Section icon={<Landmark />} title="Historial de cuotas y pagos">
        <div className="mb-4 flex w-full gap-0 overflow-x-auto rounded-t-2xl border-b-2 border-slate-100 bg-white px-2 md:justify-between">
          {([["ALL", "Todos"], ["SIE", "SIE"], ["PASARELA", "Pasarela"]] as const).map(([value, text]) => (
            <button
              key={value}
              type="button"
              onClick={() => setOriginFilter(value)}
              className={`relative flex min-w-[120px] flex-1 items-center justify-center whitespace-nowrap rounded-t-xl px-2 py-3 text-[13px] font-bold transition-all focus:outline-none ${originFilter === value ? "bg-slate-50 text-[#C5A059]" : "text-slate-500 hover:bg-slate-50/60 hover:text-[#C5A059]"}`}
            >
              {text}
              {originFilter === value && <div className="absolute -bottom-[2px] left-0 z-10 h-[3px] w-full rounded-t-md bg-[#C5A059]" />}
            </button>
          ))}
        </div>
        {filteredRows.length === 0 ? (
          <Empty text={emptyMessage} />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[960px] w-full text-left text-sm">
              <thead className="border-b border-slate-100 text-[10px] uppercase tracking-widest text-slate-400">
                <tr>
                  <th className="px-3 py-3">Fecha</th>
                  <th className="px-3 py-3">Concepto</th>
                  <th className="px-3 py-3">Período</th>
                  <th className="px-3 py-3">Origen</th>
                  <th className="px-3 py-3">Estado</th>
                  <th className="px-3 py-3">Monto</th>
                  <th className="px-3 py-3">Comprobante</th>
                  <th className="px-3 py-3">Observaciones</th>
                  <th className="px-3 py-3">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRows.map((row) => (
                  <tr key={row.id} className="align-top">
                    <td className="whitespace-nowrap px-3 py-3 text-slate-500">{row.fecha ? formatDate(row.fecha, true) : "—"}</td>
                    <td className="px-3 py-3 font-bold text-slate-700">{row.concepto}</td>
                    <td className="px-3 py-3 text-slate-500">{row.periodo}</td>
                    <td className="px-3 py-3"><OriginBadge origen={row.origen} payment={row.payment} /></td>
                    <td className="px-3 py-3"><EconomicStatus value={row.estado} origen={row.origen} /></td>
                    <td className="whitespace-nowrap px-3 py-3 font-semibold text-slate-700">{row.monto}</td>
                    <td className="px-3 py-3 text-slate-500">{row.comprobanteUrl ? <a href={row.comprobanteUrl} target="_blank" rel="noreferrer" className="font-bold text-[#936B2E] hover:underline">Ver comprobante</a> : row.comprobante}</td>
                    <td className="px-3 py-3 text-slate-500">{row.observaciones}</td>
                    <td className="px-3 py-3">{row.payment && canResetSandboxPayments && row.payment.gateway === "NIUBIZ" && row.payment.status !== "PROCESSING" && !row.payment.billing?.invoice ? <SandboxPaymentResetButton paymentId={row.payment.id} /> : null}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </div>
  );
}

function AssociateStatusIcon({ status, className = "" }: { status: string; className?: string }) {
  if (status === "check" || status === "APPROVED") return <CheckCircle2 size={14} className={className} strokeWidth={2.5} />;
  if (status === "pending" || status === "clock" || status === "UNDER_EVALUATION" || status === "UNDER_EVALUACION" || status === "RESOLVED") return <Clock size={14} className={className} strokeWidth={2.5} />;
  if (status === "error" || status === "REJECTED") return <XCircle size={14} className={className} strokeWidth={2.5} />;
  if (status === "dash" || status === "PENDING") return <MinusCircle size={14} className={className} strokeWidth={2.5} />;
  if (status === "review" || status === "OBSERVED") return <AlertCircle size={14} className={className} strokeWidth={2.5} />;
  return null;
}

function AssociateExecutiveSummary({ user, application, completion, payments, isHistorical = false }: { user: any; application: any; completion: any; payments: any[]; isHistorical?: boolean }) {
  const summary = buildAssociateExecutiveSummary(user, application, completion, payments, isHistorical);
  const header = AsociadosMapper.toCardData(user);
  const validations = header.atomicValidations ?? [];
  const memberSince = completion?.createdAt ?? application?.updatedAt ?? null;

  return <div className="space-y-6 sm:space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
    {application?.id != null && <PortalAccessCard applicationId={application.id} completed={application.status === "COMPLETED"} />}

    <div>
      <h3 className="mb-3 flex items-center gap-2 text-[13px] font-bold text-slate-800">Estado del asociado</h3>
      <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:space-y-4 sm:p-5">
        {validations.map((validation, index) => (
          <div key={`${validation.label}-${index}`} className="flex flex-col justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3 sm:flex-row sm:items-center sm:rounded-none sm:border-none sm:bg-transparent sm:p-0">
            <div className="flex items-center gap-3 sm:w-1/3">
              <DynamicIcon name={validation.icon} size={16} className="text-slate-500" />
              <span className="text-[12px] font-bold text-slate-700">{validation.label}</span>
            </div>
            <div className="flex sm:w-1/3 sm:justify-start">
              <span className={`inline-flex max-w-full items-center gap-1.5 truncate rounded-full px-2.5 py-1 text-[10px] font-bold ${validation.statusColorClass}`}>
                <AssociateStatusIcon status={validation.status} className="h-3 w-3" />
                {validation.statusLabel || validation.status}
              </span>
            </div>
            <div className="flex flex-col text-left sm:w-1/3 sm:items-end sm:text-right">
              <span className={`w-full truncate text-[11px] font-black sm:text-right ${validation.status === "check" ? "text-[#C5A059]" : validation.status === "error" ? "text-red-500" : "text-slate-400"}`}>
                {validation.assignee?.name || "Sin asignar"}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>

    <div>
      <h3 className="mb-3 text-[13px] font-bold text-slate-800">Información del asociado</h3>
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <dl className="space-y-4">
          <div className="flex flex-col justify-between gap-1 border-b border-slate-50 pb-4 sm:flex-row sm:items-center">
            <dt className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Categoría</dt>
            <dd className="text-sm font-bold text-slate-800">{summary.category}</dd>
          </div>
          <div className="flex flex-col justify-between gap-1 border-b border-slate-50 pb-4 sm:flex-row sm:items-center">
            <dt className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Fecha de afiliación</dt>
            <dd className="text-sm font-bold text-slate-800">{memberSince ? formatDate(memberSince) : "No registrada"}</dd>
          </div>
          <div className="flex flex-col justify-between gap-1 border-b border-slate-50 pb-4 sm:flex-row sm:items-center">
            <dt className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Estado de membresía</dt>
            <dd className="text-sm font-bold capitalize text-slate-800">{summary.membershipStatus}</dd>
          </div>
          <div className="flex flex-col justify-between gap-1 sm:flex-row sm:items-center">
            <dt className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Código de asociado</dt>
            <dd className="text-sm font-black text-[#C5A059]">{user.person?.associateCode ?? user.institutionalCode ?? user.person?.documentNumber ?? "No disponible"}</dd>
          </div>
        </dl>
      </div>
    </div>
  </div>;
}

function DocumentsTab({ documents }: { documents: any[] }) { return <Section icon={<FileText/>} title="Documentos">{documents.length === 0 ? <Empty text="No hay documentos registrados."/> : <div className="divide-y divide-slate-100">{documents.map((document) => <div key={document.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-bold text-slate-800">{label(document.category)}</p><p className="mt-1 text-sm text-slate-500">{document.fileName}</p><p className="mt-1 text-xs text-slate-400">Actualizado: {formatDate(document.updatedAt)}</p></div><a href={document.fileUrl} target="_blank" rel="noreferrer" className="w-fit rounded-xl border border-[#E6C982] px-3 py-2 text-xs font-bold text-[#936B2E] hover:bg-[#FFF8E8]">Ver documento</a></div>)}</div>}</Section>; }
function HistoryTab({ user, applications, payments }: { user: any; applications: any[]; payments: any[] }) { const isHistorical = user.source === "SIE_HISTORICAL"; const events = [...applications.flatMap((application) => (application.history ?? []).map((item: any) => ({ id: `history-${item.id}`, date: item.createdAt, title: item.newStatus === "COMPLETED" ? "Afiliación completada" : `Estado actualizado a ${label(item.newStatus)}`, description: item.changeReason ?? "Se actualizó el proceso de afiliación." }))), ...payments.map((payment) => ({ id: `payment-${payment.id}`, date: payment.paymentDate ?? payment.createdAt, title: "Pago aprobado", description: `Se confirmó un pago de inscripción por ${money(payment.totalAmount)}.` })), isHistorical ? { id: `sie-${user.id}`, date: user.createdAt, title: "Migración histórica SIE", description: "Asociado histórico reconocido desde el padrón institucional SIE, sin postulación V2." } : { id: `account-${user.id}`, date: user.createdAt, title: "Cuenta registrada", description: "Se registró la cuenta de acceso asociada a esta persona." }].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()); return <Section icon={<History/>} title="Historial institucional">{events.length === 0 ? <Empty text="No hay eventos disponibles."/> : <div className="space-y-4 border-l-2 border-slate-100 pl-5">{events.map((event) => <article key={event.id} className="relative"><span className="absolute -left-[29px] top-1.5 h-3 w-3 rounded-full border-2 border-white bg-[#C5A059]"/><p className="text-xs font-semibold text-slate-400">{formatDate(event.date, true)}</p><h3 className="mt-1 font-black text-slate-800">{event.title}</h3><p className="mt-1 text-sm leading-6 text-slate-500">{event.description}</p></article>)}</div>}</Section>; }
function Section({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) { return <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="flex items-center gap-3 border-b border-slate-100 bg-slate-50 px-5 py-4"><span className="text-[#C5A059]">{icon}</span><h2 className="text-sm font-black uppercase tracking-wide text-slate-800">{title}</h2></div><div className="p-5">{children}</div></section>; }
function Field({ label: fieldLabel, value, full }: { label: string; value: unknown; full?: boolean }) { return <div className={full ? "sm:col-span-2 lg:col-span-3" : ""}><p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{fieldLabel}</p><p className="mt-1 text-[13px] font-semibold text-slate-800">{value === null || value === undefined || value === "" ? <span className="italic font-medium text-slate-300">No registrado</span> : String(value)}</p></div>; }
function Metric({ label: metricLabel, value, success }: { label: string; value: string; success?: boolean }) { return <div className="rounded-xl border border-slate-100 bg-slate-50 p-4"><p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{metricLabel}</p><p className={`mt-1 text-base font-black ${success ? "text-emerald-700" : "text-slate-800"}`}>{value}</p></div>; }
function Status({ value }: { value: string }) { return <span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${value === "PAID" ? "bg-emerald-50 text-emerald-700" : value === "FAILED" ? "bg-red-50 text-red-700" : "bg-slate-100 text-slate-600"}`}>{label(value)}</span>; }
function Empty({ text }: { text: string }) { return <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-5 text-center text-sm font-medium text-slate-500">{text}</p>; }
function elapsed(value: string | Date) { const months = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / (1000 * 60 * 60 * 24 * 30.44))); return months === 0 ? "Menos de un mes" : `${months} ${months === 1 ? "mes" : "meses"}`; }
