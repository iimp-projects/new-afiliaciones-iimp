"use client";

import { useEffect, useState, forwardRef, useImperativeHandle } from "react";
import { BriefcaseBusiness, Building2, CheckCircle2, Info, Search, UserMinus, XCircle } from "lucide-react";
import type { ApplicationDraft } from "../../Models/ApplicationDraft";
import { normalizeEmploymentInformation, resolveEmploymentStatus, type EmploymentInformation, type EmploymentStatus } from "../../Models/EmploymentInformation";
import { EmploymentInformationValidator, isValidEmploymentAddress } from "../../Validators/EmploymentInformationValidator";
import { applicationApi } from "../../Services/ApplicationApi";
import { isLegalEntityRuc, isValidRuc } from "../../../payments/Rules/BillingDocumentRules";

export interface StepRef { submit: () => Promise<void>; }
interface EmploymentStepProps {
  value?: ApplicationDraft["employmentInformation"];
  saving?: boolean;
  onSave(employmentInfo: ApplicationDraft["employmentInformation"]): Promise<void>;
  onNext(): void;
  onBack(): void;
  onValidityChange?: (isValid: boolean) => void;
}

const emptyEmployment: EmploymentInformation = { employmentStatus: undefined, isIndependent: false, isUnemployed: false, companyName: "", area: "", positionName: "", companyTaxId: "", workPhone: "", workExtension: "", workEmail: "", workingAddress: "" };
const statuses: Array<{ value: EmploymentStatus; title: string; description: string; icon: typeof Building2 }> = [
  { value: "EMPLOYED", title: "TRABAJO EN UNA EMPRESA", description: "Trabajo para una empresa, institución u organización.", icon: Building2 },
  { value: "SELF_EMPLOYED", title: "TRABAJO DE FORMA INDEPENDIENTE", description: "Trabajo por cuenta propia o presto servicios profesionales de manera independiente.", icon: BriefcaseBusiness },
  { value: "NOT_WORKING", title: "ACTUALMENTE NO ME ENCUENTRO LABORANDO", description: "Actualmente no mantengo una relación laboral ni realizo actividad profesional independiente.", icon: UserMinus },
];

const EmploymentStep = forwardRef<StepRef, EmploymentStepProps>(({ value, onSave, onNext, onValidityChange }, ref) => {
  const [form, setForm] = useState<EmploymentInformation>(() => normalizeEmploymentInformation(value ?? emptyEmployment));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [isSearchingRuc, setIsSearchingRuc] = useState(false);
  const [rucFeedback, setRucFeedback] = useState<string | null>(null);
  const [rucState, setRucState] = useState<"IDLE" | "LOADING" | "VERIFIED" | "NOT_FOUND" | "SERVICE_ERROR">("IDLE");
  const status = resolveEmploymentStatus(form);
  const employmentUnlocked = status === "SELF_EMPLOYED" || (status === "EMPLOYED" && (rucState === "VERIFIED" || rucState === "NOT_FOUND"));
  const officialRuc20 = status === "EMPLOYED" && rucState === "VERIFIED" && isLegalEntityRuc(form.companyTaxId ?? "");
  const officialAddress = officialRuc20 && isValidEmploymentAddress(form.workingAddress);

  useEffect(() => {
    if (!value) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sincroniza el borrador recuperado al reabrir el paso.
    setForm(normalizeEmploymentInformation(value));
  }, [value]);
  useEffect(() => { onValidityChange?.(new EmploymentInformationValidator().validate(form).valid); }, [form, onValidityChange]);

  const selectStatus = (employmentStatus: EmploymentStatus) => {
    setForm(normalizeEmploymentInformation({ ...emptyEmployment, employmentStatus }));
    setErrors({});
    setTouched({});
    setGlobalError(null);
    setRucFeedback(null);
    setRucState("IDLE");
  };

  const updateField = <K extends keyof EmploymentInformation>(field: K, value: EmploymentInformation[K]) => {
    let sanitized = value;
    if (typeof value === "string") {
      if (["companyName", "area", "positionName", "workingAddress"].includes(field)) sanitized = value.slice(0, 250) as EmploymentInformation[K];
      if (field === "companyTaxId") sanitized = value.replace(/\D/g, "").slice(0, 11) as EmploymentInformation[K];
      if (field === "workPhone") sanitized = value.replace(/[^0-9+\s\-()]/g, "").slice(0, 20) as EmploymentInformation[K];
      if (field === "workExtension") sanitized = value.replace(/\D/g, "").slice(0, 10) as EmploymentInformation[K];
    }
    const rucChanged = field === "companyTaxId" && status === "EMPLOYED" && sanitized !== form.companyTaxId;
    const next = rucChanged ? { ...form, companyTaxId: sanitized as string, companyName: "", area: "", positionName: "", workingAddress: "", workPhone: "", workExtension: "", workEmail: "" } : { ...form, [field]: sanitized };
    setForm(next);
    setTouched(previous => ({ ...previous, [field]: true }));
    if (rucChanged) { setRucFeedback(null); setRucState("IDLE"); setGlobalError(null); setErrors({}); setTouched({}); }
    else setRucFeedback(field === "companyTaxId" ? null : rucFeedback);
    const result = new EmploymentInformationValidator().validate(next);
    setErrors(previous => ({ ...previous, [field]: result.errors.find(error => error.field === field)?.message ?? "" }));
  };

  const searchRuc = async () => {
    const ruc = form.companyTaxId ?? "";
    if (ruc.length !== 11) { setErrors(previous => ({ ...previous, companyTaxId: "Ingrese un RUC válido de 11 dígitos." })); return; }
    setIsSearchingRuc(true); setRucState("LOADING"); setGlobalError(null); setRucFeedback(null);
    try {
      const result = await applicationApi.lookupRuc(ruc);
      if (result.status === "VERIFIED") setForm(previous => ({ ...previous, companyName: result.data?.razonSocial ?? "", workingAddress: result.data?.direccion ?? "" }));
      setRucState(result.status);
      setRucFeedback(result.status === "VERIFIED" ? "RUC verificado correctamente por SUNAT." : result.status === "NOT_FOUND" ? "No encontramos información para este RUC. Puedes completar los datos de la empresa manualmente." : "No pudimos consultar SUNAT en este momento. Inténtalo nuevamente.");
    } catch {
      setRucState("SERVICE_ERROR");
      setGlobalError("No pudimos consultar SUNAT. Puede continuar registrando la información manualmente.");
    } finally { setIsSearchingRuc(false); }
  };

  useImperativeHandle(ref, () => ({ submit: async () => {
    if (status === "EMPLOYED" && !employmentUnlocked) { setGlobalError("Primero consulta y valida el RUC de la empresa."); return; }
    const result = new EmploymentInformationValidator().validate(form);
    if (!result.valid) {
      setErrors(Object.fromEntries(result.errors.map(error => [error.field, error.message])));
      setTouched(Object.fromEntries(Object.keys(emptyEmployment).map(key => [key, true])));
      return;
    }
    try { await onSave(normalizeEmploymentInformation(form)); onNext(); }
    catch (error) { setGlobalError(error instanceof Error ? error.message : "Error al guardar la información laboral."); }
  }}));

  return <div className="space-y-7">
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
      <p className="text-xs font-black uppercase tracking-widest text-[#A67C00]">Experiencia laboral</p>
      <h2 className="mt-2 text-2xl font-black text-[#1E293B]">Situación laboral actual</h2>
      <p className="mt-2 text-sm font-medium leading-6 text-slate-500">Selecciona la opción que mejor describa tu situación laboral actual. Los campos se adaptarán según tu elección.</p>
      <div className="mt-6 grid gap-4 lg:grid-cols-3">{statuses.map(option => {
        const Icon = option.icon; const selected = status === option.value;
        return <button key={option.value} type="button" onClick={() => selectStatus(option.value)} className={selected ? "rounded-2xl border-2 border-[#C5A059] bg-[#FFF9EC] p-5 text-left shadow-sm" : "rounded-2xl border border-slate-200 bg-white p-5 text-left transition hover:border-[#D6A84A]"}>
          <span className={selected ? "flex h-11 w-11 items-center justify-center rounded-xl bg-[#C5A059] text-white" : "flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-slate-600"}><Icon size={22} /></span>
          <span className="mt-4 block text-sm font-black text-[#1E293B]">{option.title}</span>
          <span className="mt-2 block text-sm leading-5 text-slate-500">{option.description}</span>
        </button>;
      })}</div>
      {errors.employmentStatus && <p className="mt-3 text-xs font-bold text-red-600">{errors.employmentStatus}</p>}
    </section>

    {globalError && <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700"><XCircle size={18} />{globalError}</div>}
    {status === "NOT_WORKING" && <section className="rounded-3xl border border-emerald-200 bg-emerald-50 p-6 text-emerald-900"><div className="flex gap-3"><CheckCircle2 className="mt-0.5 shrink-0 text-emerald-600" /><div><h3 className="font-black">Sin actividad laboral actual</h3><p className="mt-2 text-sm leading-6">Has indicado que actualmente no te encuentras laborando.<br />Podrás continuar con tu postulación sin registrar información de empleo actual.</p></div></div></section>}

    {(status === "EMPLOYED" || status === "SELF_EMPLOYED") && <>
      <section className="rounded-3xl border border-[#E8D09E] bg-[#FCFAF6] p-6 shadow-sm sm:p-8">
        <div className="flex items-start gap-4"><div className="rounded-xl bg-white p-3 text-[#C5A059] shadow-sm"><Search size={23} /></div><div><p className="text-xs font-black uppercase tracking-widest text-[#A67C00]">Integración SUNAT</p><h3 className="mt-1 text-xl font-black text-[#1E293B]">{status === "EMPLOYED" ? "Validación de empresa" : "Validación de RUC opcional"}</h3><p className="mt-1 text-sm text-slate-500">{status === "EMPLOYED" ? "Consulta la información de tu centro de trabajo por RUC." : "Si cuentas con RUC, puedes consultarlo para completar tu información profesional."}</p></div></div>
        <div className="mt-5 rounded-xl border border-sky-200 bg-sky-50 p-4 text-sm text-slate-700"><div className="flex gap-2 font-black text-slate-800"><Info size={18} className="shrink-0 text-sky-700" />Antes de continuar</div><p className="mt-2">Ingresa el RUC de la empresa donde trabajas y presiona “Consultar”. El sistema verificará la información registrada en SUNAT.</p><p className="mt-2 text-sm font-semibold text-slate-600">RUC de 11 dígitos. Algunos datos obtenidos desde SUNAT pueden quedar bloqueados para conservar la información oficial.</p></div>
        <div className="mt-5"><label className="mb-2 flex items-center gap-1.5 text-sm font-bold uppercase tracking-wide text-slate-700">{status === "EMPLOYED" ? "RUC de la empresa" : "RUC (opcional)"}<button type="button" title="El RUC es el número de 11 dígitos que identifica a una persona o empresa ante SUNAT." aria-label="Ayuda sobre RUC" className="rounded p-1 text-[#A67C00]"><Info size={16} /></button></label><div className="flex flex-col gap-2 sm:flex-row sm:gap-0"><input value={form.companyTaxId ?? ""} onChange={event => updateField("companyTaxId", event.target.value)} className="h-12 min-w-0 flex-1 rounded-xl border border-slate-300 px-4 text-base outline-none focus:border-[#C5A059] focus:ring-2 focus:ring-[#C5A059]/20 sm:rounded-r-none" placeholder="Ingrese el RUC de 11 dígitos" /><button type="button" onClick={searchRuc} disabled={isSearchingRuc || (form.companyTaxId ?? "").length !== 11} className="h-12 rounded-xl bg-[#C5A059] px-5 text-sm font-bold text-white transition hover:bg-[#A67C00] disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 sm:rounded-l-none">{isSearchingRuc ? "Consultando..." : "Consultar"}</button></div>{touched.companyTaxId && errors.companyTaxId && <p className="mt-1.5 text-xs font-bold text-red-600">{errors.companyTaxId}</p>}{rucFeedback && <p className="mt-3 text-sm font-semibold text-emerald-700">{rucFeedback}</p>}{officialRuc20 && <p className="mt-2 text-sm font-semibold text-slate-700">La razón social y la dirección provienen de SUNAT y no pueden modificarse. Completa únicamente los datos de tu puesto laboral.</p>}</div>
      </section>
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex items-center gap-3 border-b border-slate-100 pb-5"><BriefcaseBusiness className="text-[#C5A059]" /><div><h3 className="font-black text-[#1E293B]">{status === "EMPLOYED" ? "Datos del empleo" : "Actividad profesional independiente"}</h3><p className="text-xs text-slate-500">{status === "EMPLOYED" ? "Complete la información de su puesto laboral." : "Registre la información de su actividad profesional actual."}</p></div></div>
        <fieldset disabled={status === "EMPLOYED" && !employmentUnlocked} className="mt-6 grid gap-5 disabled:opacity-60 md:grid-cols-2">
          <Input label={status === "EMPLOYED" ? "Empresa o institución" : "Nombre comercial (opcional)"} required={status === "EMPLOYED"} value={form.companyName} onChange={value => updateField("companyName", value)} error={errors.companyName} readOnly={officialRuc20} verified={officialRuc20} />
          <Input label={status === "EMPLOYED" ? "Área o departamento" : "Especialidad o área profesional"} value={form.area} onChange={value => updateField("area", value)} error={errors.area} />
          <Input label={status === "EMPLOYED" ? "Cargo" : "Actividad principal / profesión"} required value={form.positionName} onChange={value => updateField("positionName", value)} error={errors.positionName} />
          <Input label={status === "EMPLOYED" ? "Correo corporativo" : "Correo profesional"} required type="email" value={form.workEmail} onChange={value => updateField("workEmail", value)} error={errors.workEmail} />
          <Input label={status === "EMPLOYED" ? "Dirección de la empresa" : "Dirección profesional"} required value={form.workingAddress} onChange={value => updateField("workingAddress", value)} error={errors.workingAddress} full readOnly={officialAddress} verified={officialAddress} helper={officialRuc20 && !officialAddress ? "SUNAT no proporcionó una dirección fiscal válida. Complétala manualmente." : undefined} />
          <Input label="Teléfono" required value={form.workPhone} onChange={value => updateField("workPhone", value)} error={errors.workPhone} />
          {status === "EMPLOYED" && <Input label="Anexo (opcional)" value={form.workExtension} onChange={value => updateField("workExtension", value)} error={errors.workExtension} />}
        </fieldset>
      </section>
    </>}
  </div>;
});

function Input({ label, required, type = "text", value, onChange, error, full = false, readOnly = false, verified = false, helper }: { label: string; required?: boolean; type?: string; value?: string; onChange(value: string): void; error?: string; full?: boolean; readOnly?: boolean; verified?: boolean; helper?: string }) {
  return <div className={full ? "md:col-span-2" : ""}><label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-700">{label}{required && <span className="text-red-500"> *</span>}</label><input type={type} readOnly={readOnly} value={value ?? ""} onChange={event => onChange(event.target.value)} placeholder={readOnly ? "Dato oficial SUNAT" : undefined} className={error ? "h-11 w-full rounded-xl border border-red-400 bg-red-50 px-3 text-sm outline-none" : `h-11 w-full rounded-xl border border-slate-300 px-3 text-sm outline-none focus:border-[#C5A059] focus:ring-2 focus:ring-[#C5A059]/20 ${readOnly ? "cursor-default bg-slate-50" : ""}`} />{verified && <p className="mt-1.5 text-xs font-bold text-emerald-700">✓ Verificado por SUNAT</p>}{helper && <p className="mt-1.5 text-xs font-semibold text-amber-700">{helper}</p>}{error && <p className="mt-1.5 text-xs font-bold text-red-600">{error}</p>}</div>;
}

EmploymentStep.displayName = "EmploymentStep";
export default EmploymentStep;
