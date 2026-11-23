"use client";

/* eslint-disable react-hooks/set-state-in-effect, @typescript-eslint/no-explicit-any, @next/next/no-img-element -- payload del drawer sin tipar y vista previa local. */

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Camera, CheckCircle2, FileText, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { AppSelect } from "@/modules/shared/Components/Form";
import type { AssociateAdminDocument } from "../Services/AssociateAdminDocumentsService";
import {
  ASSOCIATE_DOCUMENT_SLOT_LABELS,
  requiredAssociateDocumentSlots,
  type AssociateDocumentSlot,
} from "../Utilities/associateDocumentSlots";
import { validateAdminAssociateData, type AdminAssociateDataErrors } from "../Validators/validateAdminAssociateData";
import type { AdminAssociateDataInput } from "../Validators/AdminAssociateDataSchema";

type Item = { id: number; name: string };
type DegreeItem = { id: number; name: string; studyLevel?: string };

export interface AdminAssociateDataInitial {
  identity: {
    firstName: string;
    paternalLastName: string;
    maternalLastName: string;
    documentType: string;
    documentNumber: string;
    birthDate: string;
    gender: string;
    nationalityId: number | null;
  };
  contact: { phone: string; primaryEmail: string; secondaryEmail: string };
  address: {
    street: string;
    reference: string;
    countryId: number | null;
    departmentId: number | null;
    provinceId: number | null;
    districtId: number | null;
    postalCode: string;
    foreignRegion: string;
    foreignCity: string;
  };
  academic: {
    studyLevel: string;
    degreeId: number | null;
    universityId: number | null;
    specialtyId: number | null;
    degreeTitle: string;
    professionalAssociation: string;
    licenseNumber: string;
    graduationYear: number | null;
    termOrSemester: string;
  } | null;
  employment: {
    companyId: number | null;
    positionId: number | null;
    area: string;
    workingAddress: string;
    workPhone: string;
    workExtension: string;
    workEmail: string;
  } | null;
}

interface Props {
  user: any;
  isStudent: boolean;
  open: boolean;
  onClose: () => void;
  variant?: "associate" | "applicant";
  applicationId?: number;
  onSaved?: () => void;
}

const inputClass = "h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition focus:border-[#b48a37] focus:ring-2 focus:ring-[#b48a37]/10";
const genderOptions = [
  { value: "MALE", label: "Masculino" },
  { value: "FEMALE", label: "Femenino" },
];
const documentOptions = [
  { value: "DNI", label: "DNI" },
  { value: "CE", label: "Carnet de extranjería" },
  { value: "PASSPORT", label: "Pasaporte" },
  { value: "OTHER", label: "Otro" },
];
const studyLevelOptions = [
  { value: "BACHELOR", label: "Bachiller" },
  { value: "MASTER", label: "Maestría" },
  { value: "DOCTORATE", label: "Doctorado" },
  { value: "TECHNICAL", label: "Técnico" },
  { value: "OTHER", label: "Otro" },
];

const text = (value: string | null | undefined) => value ?? "";
const idText = (value: number | null | undefined) => (value ? String(value) : "");

export function isStudentAssociate(user: any): boolean {
  const applications = user?.person?.applications ?? [];
  const application = applications.find((item: any) => item.status === "COMPLETED") ?? applications[0];
  return user?.role?.slug === "ASOCIADO_ESTUDIANTE" || application?.affiliateType === "STUDENT";
}

export function buildAdminAssociateDataInitial(user: any): AdminAssociateDataInitial {
  const person = user?.person ?? {};
  const contact = person.contacts?.find((item: any) => item.isPrimary) ?? person.contacts?.[0];
  const alternate = person.contacts?.find((item: any) => item.email && item.id !== contact?.id);
  const address = person.addresses?.find((item: any) => item.isPrimary) ?? person.addresses?.[0];
  const academic = person.academicInfos?.[0];
  const employment = person.employmentInfos?.[0];
  return {
    identity: {
      firstName: person.firstName ?? "",
      paternalLastName: person.paternalLastName ?? "",
      maternalLastName: person.maternalLastName ?? "",
      documentType: person.documentType ?? "DNI",
      documentNumber: person.documentNumber ?? "",
      birthDate: person.birthDate ? new Date(person.birthDate).toISOString().slice(0, 10) : "",
      gender: person.gender ?? "",
      nationalityId: person.nationalityId ?? null,
    },
    contact: {
      phone: contact?.phoneNumber ?? "",
      primaryEmail: contact?.email ?? "",
      secondaryEmail: alternate?.email ?? "",
    },
    address: {
      street: address?.street ?? "",
      reference: address?.reference ?? "",
      countryId: address?.countryId ?? null,
      departmentId: address?.district?.province?.department?.id ?? null,
      provinceId: address?.district?.province?.id ?? null,
      districtId: address?.district?.id ?? null,
      postalCode: address?.zipCode ?? "",
      foreignRegion: address?.foreignRegion ?? "",
      foreignCity: address?.foreignCity ?? "",
    },
    academic: academic ? {
      studyLevel: academic.studyLevel,
      degreeId: academic.degreeId ?? null,
      universityId: academic.universityId ?? null,
      specialtyId: academic.specialtyId ?? null,
      degreeTitle: academic.degreeTitle ?? "",
      professionalAssociation: academic.professionalAssociation ?? "",
      licenseNumber: academic.licenseNumber ?? "",
      graduationYear: academic.graduationYear ?? null,
      termOrSemester: academic.termOrSemester ?? "",
    } : null,
    employment: employment ? {
      companyId: employment.companyId ?? null,
      positionId: employment.positionId ?? null,
      area: employment.area ?? "",
      workingAddress: employment.workingAddress ?? "",
      workPhone: employment.workPhone ?? "",
      workExtension: employment.workExtension ?? "",
      workEmail: employment.workEmail ?? "",
    } : null,
  };
}

function buildDraft(initial: AdminAssociateDataInitial) {
  return {
    firstName: initial.identity.firstName,
    paternalLastName: initial.identity.paternalLastName,
    maternalLastName: initial.identity.maternalLastName,
    documentType: initial.identity.documentType,
    documentNumber: initial.identity.documentNumber,
    birthDate: initial.identity.birthDate,
    gender: initial.identity.gender,
    nationalityId: idText(initial.identity.nationalityId),
    phone: initial.contact.phone,
    primaryEmail: initial.contact.primaryEmail,
    secondaryEmail: initial.contact.secondaryEmail,
    street: initial.address.street,
    reference: initial.address.reference,
    countryId: idText(initial.address.countryId),
    departmentId: idText(initial.address.departmentId),
    provinceId: idText(initial.address.provinceId),
    districtId: idText(initial.address.districtId),
    postalCode: initial.address.postalCode,
    foreignRegion: initial.address.foreignRegion,
    foreignCity: initial.address.foreignCity,
    includeAcademic: Boolean(initial.academic),
    studyLevel: initial.academic?.studyLevel ?? "BACHELOR",
    degreeId: idText(initial.academic?.degreeId),
    universityId: idText(initial.academic?.universityId),
    specialtyId: idText(initial.academic?.specialtyId),
    degreeTitle: text(initial.academic?.degreeTitle),
    professionalAssociation: text(initial.academic?.professionalAssociation),
    licenseNumber: text(initial.academic?.licenseNumber),
    graduationYear: idText(initial.academic?.graduationYear),
    termOrSemester: text(initial.academic?.termOrSemester),
    includeEmployment: Boolean(initial.employment),
    companyId: idText(initial.employment?.companyId),
    positionId: idText(initial.employment?.positionId),
    area: text(initial.employment?.area),
    workingAddress: text(initial.employment?.workingAddress),
    workPhone: text(initial.employment?.workPhone),
    workExtension: text(initial.employment?.workExtension),
    workEmail: text(initial.employment?.workEmail),
  };
}

export function AdminAssociateDataDialog({ user, isStudent, open, onClose, variant = "associate", applicationId, onSaved }: Props) {
  const router = useRouter();
  const personId = Number(user?.person?.id ?? user?.id ?? 0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<AdminAssociateDataErrors>({});
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);
  const [pendingSlot, setPendingSlot] = useState<AssociateDocumentSlot | null>(null);
  const [documents, setDocuments] = useState<AssociateAdminDocument[]>([]);
  const [documentApplicationId, setDocumentApplicationId] = useState<number | null>(null);
  const [documentsLoading, setDocumentsLoading] = useState(false);
  const [uploadingSlot, setUploadingSlot] = useState<AssociateDocumentSlot | null>(null);
  const [draft, setDraft] = useState(() => buildDraft(buildAdminAssociateDataInitial(user)));
  const [countries, setCountries] = useState<Item[]>([]);
  const [departments, setDepartments] = useState<Item[]>([]);
  const [provinces, setProvinces] = useState<Item[]>([]);
  const [districts, setDistricts] = useState<Item[]>([]);
  const [universities, setUniversities] = useState<Item[]>([]);
  const [specialties, setSpecialties] = useState<Item[]>([]);
  const [degrees, setDegrees] = useState<DegreeItem[]>([]);
  const [companies, setCompanies] = useState<Item[]>([]);
  const [positions, setPositions] = useState<Item[]>([]);

  const isPeru = draft.countryId === "1";

  const documentsEndpoint = variant === "applicant" && applicationId
    ? `/api/afiliaciones/expedientes/${applicationId}/documents`
    : `/api/afiliaciones/asociados/person/${personId}/documents`;

  const loadDocuments = async () => {
    if (!personId) return;
    setDocumentsLoading(true);
    try {
      const response = await fetch(documentsEndpoint, { cache: "no-store" });
      const body = await response.json();
      if (response.ok && body.success) {
        setDocuments(body.data.documents);
        setDocumentApplicationId(body.data.applicationId);
      }
    } catch {
      setDocuments([]);
    } finally {
      setDocumentsLoading(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    setDraft(buildDraft(buildAdminAssociateDataInitial(user)));
    setError(null);
    setFieldErrors({});
    setPhotoFile(null);
    setPhotoPreview(null);
    void loadDocuments();
    void fetch("/api/catalogs/countries").then((r) => r.json()).then(setCountries).catch(() => undefined);
    void fetch("/api/catalogs/universities").then((r) => r.json()).then(setUniversities).catch(() => undefined);
    void fetch("/api/catalogs/specialties").then((r) => r.json()).then(setSpecialties).catch(() => undefined);
    void fetch("/api/catalogs/degrees").then((r) => r.json()).then((body) => setDegrees(body.data ?? [])).catch(() => undefined);
    void fetch("/api/catalogs/companies").then((r) => r.json()).then(setCompanies).catch(() => undefined);
    void fetch("/api/catalogs/positions").then((r) => r.json()).then(setPositions).catch(() => undefined);
  }, [open, user]);

  useEffect(() => {
    if (!open || !draft.countryId) { setDepartments([]); return; }
    void fetch(`/api/catalogs/${draft.countryId}/departments`).then((r) => r.json()).then(setDepartments).catch(() => undefined);
  }, [open, draft.countryId]);

  useEffect(() => {
    if (!open || !draft.departmentId) { setProvinces([]); return; }
    void fetch(`/api/catalogs/${draft.departmentId}/provinces`).then((r) => r.json()).then(setProvinces).catch(() => undefined);
  }, [open, draft.departmentId]);

  useEffect(() => {
    if (!open || !draft.provinceId) { setDistricts([]); return; }
    void fetch(`/api/catalogs/${draft.provinceId}/districts`).then((r) => r.json()).then(setDistricts).catch(() => undefined);
  }, [open, draft.provinceId]);

  useEffect(() => () => { if (photoPreview) URL.revokeObjectURL(photoPreview); }, [photoPreview]);

  const documentsForSlot = (slot: AssociateDocumentSlot) => documents.filter((document) => document.slot === slot);
  const displayDate = (value: string) => new Date(value).toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric" });
  const requiredSlots = requiredAssociateDocumentSlots(isStudent);
  const optionalSlots: AssociateDocumentSlot[] = ["CV", "DEGREE_CERTIFICATE", "RECOMMENDATION_LETTER", "PAYMENT_VOUCHER", "OTHER"];

  const chooseDocument = (slot: AssociateDocumentSlot) => {
    setPendingSlot(slot);
    documentInputRef.current?.click();
  };

  const uploadDocument = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !pendingSlot) return;
    setUploadingSlot(pendingSlot);
    setError(null);
    try {
      const form = new FormData();
      form.set("slot", pendingSlot);
      form.set("file", file);
      const response = await fetch(documentsEndpoint, { method: "POST", body: form });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message);
      setDocuments(body.data.documents);
      setDocumentApplicationId(body.data.applicationId);
      toast.success("Documento adjuntado.");
      onSaved?.();
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "No fue posible adjuntar el documento.");
    } finally {
      setUploadingSlot(null);
      setPendingSlot(null);
    }
  };

  const handlePhoto = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("La fotografía debe ser JPG, PNG o WEBP.");
      event.target.value = "";
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("La fotografía no puede superar los 5 MB.");
      event.target.value = "";
      return;
    }
    setError(null);
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
    event.target.value = "";
  };

  const buildPayload = (): AdminAssociateDataInput => {
    const numeric = (value: string) => (value ? Number(value) : null);
    const email = (value: string) => (value.trim() ? value.trim() : null);
    return {
      identity: {
        firstName: draft.firstName,
        paternalLastName: draft.paternalLastName,
        maternalLastName: draft.maternalLastName.trim() ? draft.maternalLastName : null,
        documentType: draft.documentType,
        documentNumber: draft.documentNumber,
        birthDate: draft.birthDate || null,
        gender: draft.gender || null,
        nationalityId: numeric(draft.nationalityId),
      },
      contact: {
        phone: draft.phone,
        primaryEmail: email(draft.primaryEmail),
        secondaryEmail: email(draft.secondaryEmail),
      },
      address: {
        street: draft.street,
        reference: draft.reference.trim() ? draft.reference : null,
        countryId: draft.countryId ? Number(draft.countryId) : 0,
        districtId: isPeru ? numeric(draft.districtId) : null,
        postalCode: draft.postalCode.trim() ? draft.postalCode : null,
        foreignRegion: isPeru ? null : draft.foreignRegion.trim() ? draft.foreignRegion : null,
        foreignCity: isPeru ? null : draft.foreignCity.trim() ? draft.foreignCity : null,
      },
      academic: draft.includeAcademic ? {
        studyLevel: draft.studyLevel,
        degreeId: numeric(draft.degreeId),
        universityId: numeric(draft.universityId),
        specialtyId: numeric(draft.specialtyId),
        degreeTitle: draft.degreeTitle.trim() ? draft.degreeTitle : null,
        professionalAssociation: draft.professionalAssociation.trim() ? draft.professionalAssociation : null,
        licenseNumber: draft.licenseNumber.trim() ? draft.licenseNumber : null,
        graduationYear: draft.graduationYear ? Number(draft.graduationYear) : null,
        termOrSemester: draft.termOrSemester.trim() ? draft.termOrSemester : null,
      } : null,
      employment: !isStudent && draft.includeEmployment ? {
        companyId: numeric(draft.companyId),
        positionId: numeric(draft.positionId),
        area: draft.area.trim() ? draft.area : null,
        workingAddress: draft.workingAddress.trim() ? draft.workingAddress : null,
        workPhone: draft.workPhone.trim() ? draft.workPhone : null,
        workExtension: draft.workExtension.trim() ? draft.workExtension : null,
        workEmail: email(draft.workEmail),
      } : null,
    } as unknown as AdminAssociateDataInput;
  };

  const save = async () => {
    const payload = buildPayload();
    const errors = validateAdminAssociateData(payload, { isStudent });
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      setError("Revisa los campos marcados.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (photoFile) {
        const photoForm = new FormData();
        photoForm.set("image", photoFile);
        const photoResponse = await fetch(`/api/afiliaciones/asociados/person/${personId}/photo`, { method: "POST", body: photoForm });
        const photoBody = await photoResponse.json();
        if (!photoResponse.ok) throw new Error(photoBody.message);
      }
      const endpoint = variant === "applicant" && applicationId
        ? `/api/afiliaciones/expedientes/${applicationId}/datos`
        : `/api/afiliaciones/asociados/person/${personId}`;
      const response = await fetch(endpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await response.json();
      if (!response.ok) {
        if (body.errors && typeof body.errors === "object") {
          const normalizedErrors = Object.fromEntries(
            Object.entries(body.errors).map(([key, value]) => [key, Array.isArray(value) ? String(value[0] ?? "") : String(value ?? "")]),
          );
          setFieldErrors(normalizedErrors);
        }
        throw new Error(body.message);
      }
      toast.success(variant === "applicant" ? "Datos del postulante actualizados." : "Datos del asociado actualizados.");
      onSaved?.();
      onClose();
      router.refresh();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "No fue posible actualizar los datos.");
    } finally {
      setSaving(false);
    }
  };

  if (!open || !Number.isInteger(personId) || personId <= 0) return null;
  if (typeof document === "undefined") return null;

  const initials = `${user?.person?.firstName?.charAt(0) ?? ""}${user?.person?.paternalLastName?.charAt(0) ?? ""}`.toUpperCase();
  const avatarSrc = photoPreview ?? user?.affiliateAvatarUrl ?? null;
  const fieldError = (key: string) => fieldErrors[key] ? <span className="text-xs font-semibold text-red-600">{fieldErrors[key]}</span> : null;

  return createPortal(
    <div role="dialog" aria-modal="true" aria-labelledby="admin-associate-data-title" className="fixed inset-0 z-[1000001] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-[2px]">
      <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-100 px-6 py-4">
          <h2 id="admin-associate-data-title" className="font-black text-slate-800">{variant === "applicant" ? "Editar datos del postulante" : "Editar datos del asociado"}</h2>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="rounded-full p-1.5 text-slate-500 hover:bg-slate-100"><X size={18} /></button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
        {variant === "associate" && (
        <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-[#172a45] text-lg font-black text-white">
            {avatarSrc ? <img src={avatarSrc} alt="Fotografía del asociado" className="h-full w-full object-cover" /> : initials || <Camera size={22} />}
          </div>
          <div>
            <p className="text-sm font-bold text-slate-700">Fotografía</p>
            <p className="text-xs text-slate-500">JPG, PNG o WEBP de hasta 5 MB.</p>
            <button type="button" onClick={() => photoInputRef.current?.click()} className="mt-2 inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:border-[#b48a37] hover:text-[#9b7530]">
              <Camera size={14} /> {avatarSrc ? "Cambiar foto" : "Subir foto"}
            </button>
            <input ref={photoInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handlePhoto} />
          </div>
        </div>
        )}

        <p className="mt-4 text-xs font-black uppercase tracking-widest text-[#9b7530]">Datos personales</p>
        <div className="mt-2 grid gap-4 sm:grid-cols-2">
          <label className="grid gap-1.5 text-sm font-semibold text-slate-700">Nombres<input className={inputClass} value={draft.firstName} onChange={(e) => setDraft({ ...draft, firstName: e.target.value })} />{fieldError("identity.firstName")}</label>
          <label className="grid gap-1.5 text-sm font-semibold text-slate-700">Apellido paterno<input className={inputClass} value={draft.paternalLastName} onChange={(e) => setDraft({ ...draft, paternalLastName: e.target.value })} />{fieldError("identity.paternalLastName")}</label>
          <label className="grid gap-1.5 text-sm font-semibold text-slate-700">Apellido materno<input className={inputClass} value={draft.maternalLastName} onChange={(e) => setDraft({ ...draft, maternalLastName: e.target.value })} />{fieldError("identity.maternalLastName")}</label>
          <div className="grid gap-1.5"><AppSelect label="Tipo de documento" value={draft.documentType} options={documentOptions} onChange={(value) => setDraft({ ...draft, documentType: value })} placeholder="Seleccione" />{fieldError("identity.documentType")}</div>
          <label className="grid gap-1.5 text-sm font-semibold text-slate-700">Número de documento<input className={inputClass} value={draft.documentNumber} onChange={(e) => setDraft({ ...draft, documentNumber: e.target.value })} />{fieldError("identity.documentNumber")}</label>
          <label className="grid gap-1.5 text-sm font-semibold text-slate-700">Fecha de nacimiento<input type="date" className={inputClass} value={draft.birthDate} onChange={(e) => setDraft({ ...draft, birthDate: e.target.value })} />{fieldError("identity.birthDate")}</label>
          <div className="grid gap-1.5"><AppSelect label="Género" value={draft.gender} options={genderOptions} onChange={(value) => setDraft({ ...draft, gender: value })} placeholder="Seleccione" />{fieldError("identity.gender")}</div>
          <AppSelect label="Nacionalidad" value={draft.nationalityId} options={countries.map((item) => ({ value: item.id, label: item.name }))} onChange={(value) => setDraft({ ...draft, nationalityId: value })} placeholder="Seleccione" searchable />
        </div>

        <p className="mt-6 text-xs font-black uppercase tracking-widest text-[#9b7530]">Contacto</p>
        <div className="mt-2 grid gap-4 sm:grid-cols-3">
          <label className="grid gap-1.5 text-sm font-semibold text-slate-700">Celular<input className={inputClass} value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} />{fieldError("contact.phone")}</label>
          <label className="grid gap-1.5 text-sm font-semibold text-slate-700">Correo de contacto<input type="email" className={inputClass} value={draft.primaryEmail} onChange={(e) => setDraft({ ...draft, primaryEmail: e.target.value })} />{fieldError("contact.primaryEmail")}</label>
          <label className="grid gap-1.5 text-sm font-semibold text-slate-700">Correo secundario<input type="email" className={inputClass} value={draft.secondaryEmail} onChange={(e) => setDraft({ ...draft, secondaryEmail: e.target.value })} />{fieldError("contact.secondaryEmail")}</label>
        </div>

        <p className="mt-6 text-xs font-black uppercase tracking-widest text-[#9b7530]">Dirección</p>
        <div className="mt-2 grid gap-4 sm:grid-cols-2">
          <label className="grid gap-1.5 text-sm font-semibold text-slate-700 sm:col-span-2">Dirección<input className={inputClass} value={draft.street} onChange={(e) => setDraft({ ...draft, street: e.target.value })} />{fieldError("address.street")}</label>
          <label className="grid gap-1.5 text-sm font-semibold text-slate-700 sm:col-span-2">Referencia<input className={inputClass} value={draft.reference} onChange={(e) => setDraft({ ...draft, reference: e.target.value })} />{fieldError("address.reference")}</label>
          <div className="grid gap-1.5"><AppSelect label="País" value={draft.countryId} options={countries.map((item) => ({ value: item.id, label: item.name }))} onChange={(value) => setDraft({ ...draft, countryId: value, departmentId: "", provinceId: "", districtId: "" })} placeholder="Seleccione" searchable />{fieldError("address.countryId")}</div>
          {isPeru && (
            <>
              <div className="grid gap-1.5"><AppSelect label="Departamento" value={draft.departmentId} options={departments.map((item) => ({ value: item.id, label: item.name }))} onChange={(value) => setDraft({ ...draft, departmentId: value, provinceId: "", districtId: "" })} placeholder="Seleccione" />{fieldError("address.departmentId")}</div>
              <AppSelect label="Provincia" value={draft.provinceId} options={provinces.map((item) => ({ value: item.id, label: item.name }))} onChange={(value) => setDraft({ ...draft, provinceId: value, districtId: "" })} placeholder="Seleccione" />
              <div className="grid gap-1.5"><AppSelect label="Distrito" value={draft.districtId} options={districts.map((item) => ({ value: item.id, label: item.name }))} onChange={(value) => setDraft({ ...draft, districtId: value })} placeholder="Seleccione" />{fieldError("address.districtId")}</div>
            </>
          )}
          {!isPeru && draft.countryId && (
            <>
              <label className="grid gap-1.5 text-sm font-semibold text-slate-700">Región / Estado<input className={inputClass} value={draft.foreignRegion} onChange={(e) => setDraft({ ...draft, foreignRegion: e.target.value })} />{fieldError("address.foreignRegion")}</label>
              <label className="grid gap-1.5 text-sm font-semibold text-slate-700">Ciudad<input className={inputClass} value={draft.foreignCity} onChange={(e) => setDraft({ ...draft, foreignCity: e.target.value })} />{fieldError("address.foreignCity")}</label>
            </>
          )}
          <label className="grid gap-1.5 text-sm font-semibold text-slate-700">Código postal (opcional)<input className={inputClass} value={draft.postalCode} onChange={(e) => setDraft({ ...draft, postalCode: e.target.value.replace(/[^\dA-Za-z-]/g, "") })} /></label>
        </div>

        <div className="mt-6 flex items-center justify-between">
          <p className="text-xs font-black uppercase tracking-widest text-[#9b7530]">Formación académica</p>
          <label className="flex items-center gap-2 text-xs font-bold text-slate-600"><input type="checkbox" checked={draft.includeAcademic} onChange={(e) => setDraft({ ...draft, includeAcademic: e.target.checked })} /> Registrar</label>
        </div>
        {draft.includeAcademic && (
          <div className="mt-2 grid gap-4 sm:grid-cols-2">
            <AppSelect label="Nivel de estudio" value={draft.studyLevel} options={studyLevelOptions} onChange={(value) => setDraft({ ...draft, studyLevel: value })} placeholder="Seleccione" />
            <div className="grid gap-1.5"><AppSelect label="Universidad" value={draft.universityId} options={universities.map((item) => ({ value: item.id, label: item.name }))} onChange={(value) => setDraft({ ...draft, universityId: value })} placeholder="Seleccione" searchable />{fieldError("academic.universityId")}</div>
            <div className="grid gap-1.5"><AppSelect label="Especialidad" value={draft.specialtyId} options={specialties.map((item) => ({ value: item.id, label: item.name }))} onChange={(value) => setDraft({ ...draft, specialtyId: value })} placeholder="Seleccione" searchable />{fieldError("academic.specialtyId")}</div>
            <div className="grid gap-1.5"><AppSelect label="Grado" value={draft.degreeId} options={degrees.map((item) => ({ value: item.id, label: item.name }))} onChange={(value) => setDraft({ ...draft, degreeId: value })} placeholder="Seleccione" searchable />{fieldError("academic.degreeId")}</div>
            <label className="grid gap-1.5 text-sm font-semibold text-slate-700">Título / grado<input className={inputClass} value={draft.degreeTitle} onChange={(e) => setDraft({ ...draft, degreeTitle: e.target.value })} />{fieldError("academic.degreeTitle")}</label>
            <label className="grid gap-1.5 text-sm font-semibold text-slate-700">Año de egreso<input type="number" className={inputClass} value={draft.graduationYear} onChange={(e) => setDraft({ ...draft, graduationYear: e.target.value })} />{fieldError("academic.graduationYear")}</label>
            <label className="grid gap-1.5 text-sm font-semibold text-slate-700">Colegiatura<input className={inputClass} value={draft.professionalAssociation} onChange={(e) => setDraft({ ...draft, professionalAssociation: e.target.value })} />{fieldError("academic.professionalAssociation")}</label>
            <label className="grid gap-1.5 text-sm font-semibold text-slate-700">Número de colegiatura<input className={inputClass} value={draft.licenseNumber} onChange={(e) => setDraft({ ...draft, licenseNumber: e.target.value })} />{fieldError("academic.licenseNumber")}</label>
            <label className="grid gap-1.5 text-sm font-semibold text-slate-700">Ciclo / semestre<input className={inputClass} value={draft.termOrSemester} onChange={(e) => setDraft({ ...draft, termOrSemester: e.target.value })} />{fieldError("academic.termOrSemester")}</label>
          </div>
        )}

        {!isStudent && (
          <>
            <div className="mt-6 flex items-center justify-between">
              <p className="text-xs font-black uppercase tracking-widest text-[#9b7530]">Información laboral</p>
              <label className="flex items-center gap-2 text-xs font-bold text-slate-600"><input type="checkbox" checked={draft.includeEmployment} onChange={(e) => setDraft({ ...draft, includeEmployment: e.target.checked })} /> Registrar</label>
            </div>
            {draft.includeEmployment && (
              <div className="mt-2 grid gap-4 sm:grid-cols-2">
                <div className="grid gap-1.5"><AppSelect label="Empresa" value={draft.companyId} options={companies.map((item) => ({ value: item.id, label: item.name }))} onChange={(value) => setDraft({ ...draft, companyId: value })} placeholder="Seleccione" searchable />{fieldError("employment.companyId")}</div>
                <div className="grid gap-1.5"><AppSelect label="Cargo" value={draft.positionId} options={positions.map((item) => ({ value: item.id, label: item.name }))} onChange={(value) => setDraft({ ...draft, positionId: value })} placeholder="Seleccione" searchable />{fieldError("employment.positionId")}</div>
                <label className="grid gap-1.5 text-sm font-semibold text-slate-700">Área<input className={inputClass} value={draft.area} onChange={(e) => setDraft({ ...draft, area: e.target.value })} />{fieldError("employment.area")}</label>
                <label className="grid gap-1.5 text-sm font-semibold text-slate-700">Teléfono laboral<input className={inputClass} value={draft.workPhone} onChange={(e) => setDraft({ ...draft, workPhone: e.target.value })} />{fieldError("employment.workPhone")}</label>
                <label className="grid gap-1.5 text-sm font-semibold text-slate-700 sm:col-span-2">Dirección laboral<input className={inputClass} value={draft.workingAddress} onChange={(e) => setDraft({ ...draft, workingAddress: e.target.value })} />{fieldError("employment.workingAddress")}</label>
                <label className="grid gap-1.5 text-sm font-semibold text-slate-700">Anexo<input className={inputClass} value={draft.workExtension} onChange={(e) => setDraft({ ...draft, workExtension: e.target.value })} />{fieldError("employment.workExtension")}</label>
                <label className="grid gap-1.5 text-sm font-semibold text-slate-700">Correo laboral<input type="email" className={inputClass} value={draft.workEmail} onChange={(e) => setDraft({ ...draft, workEmail: e.target.value })} />{fieldError("employment.workEmail")}</label>
              </div>
            )}
          </>
        )}

        <div className="mt-6 flex items-center justify-between">
          <p className="text-xs font-black uppercase tracking-widest text-[#9b7530]">Documentos</p>
          {documentApplicationId && <span className="text-[11px] font-semibold text-slate-400">Expediente #{documentApplicationId}</span>}
        </div>
        <p className="mt-1 text-[11px] font-medium text-slate-500">No se elimina ningún documento: al subir uno nuevo, el anterior queda como versión anterior.</p>
        <input ref={documentInputRef} type="file" accept="application/pdf,image/jpeg,image/png,image/webp" className="hidden" onChange={uploadDocument} />

        {documentsLoading ? (
          <p className="mt-3 flex items-center gap-2 text-[11px] font-semibold text-slate-400"><span className="h-3 w-3 animate-spin rounded-full border-2 border-[#C5A059] border-t-transparent" /> Cargando documentos...</p>
        ) : !documentApplicationId ? (
          <p className="mt-3 rounded-xl border border-amber-100 bg-amber-50 p-3 text-xs font-semibold text-amber-700">La persona no tiene un expediente; no se pueden adjuntar documentos.</p>
        ) : (
          <div className="mt-3 space-y-2">
            {requiredSlots.map((slot) => {
              const versions = documentsForSlot(slot);
              const current = versions[0];
              const previous = versions.slice(1);
              return (
                <div key={slot} className="rounded-xl border border-slate-200 bg-white p-3">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-2 text-sm font-bold text-slate-700">
                        {ASSOCIATE_DOCUMENT_SLOT_LABELS[slot]}
                        <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700">Obligatorio</span>
                      </p>
                      {current
                        ? (
                          <p className="mt-1 flex flex-wrap items-center gap-2 text-xs font-semibold text-emerald-700">
                            <CheckCircle2 size={13} /> <span className="truncate">{current.fileName}</span>
                            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                              {previous.length > 0 ? "Versión actual (corregida)" : "Versión actual"}
                            </span>
                          </p>
                        )
                        : <p className="mt-1 text-xs font-medium text-slate-400">Pendiente de adjuntar</p>}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {current?.url && <a href={current.url} target="_blank" rel="noreferrer" className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50">Ver</a>}
                      <button type="button" disabled={uploadingSlot !== null} onClick={() => chooseDocument(slot)} className="inline-flex items-center gap-1.5 rounded-lg border border-[#ead9b8] bg-[#fbf4e7] px-3 py-1.5 text-xs font-bold text-[#7f561e] hover:bg-[#f7ecd7] disabled:opacity-50">
                        <Upload size={13} /> {uploadingSlot === slot ? "Subiendo..." : current ? "Subir nueva versión" : "Adjuntar"}
                      </button>
                    </div>
                  </div>
                  {previous.length > 0 && (
                    <details className="mt-2 border-t border-slate-100 pt-2">
                      <summary className="cursor-pointer list-none text-[11px] font-bold text-slate-500">{previous.length} versión(es) anterior(es)</summary>
                      <ul className="mt-2 space-y-1.5">
                        {previous.map((version) => (
                          <li key={version.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 text-[11px]">
                            <span className="min-w-0 truncate font-semibold text-slate-600">Versión anterior · {displayDate(version.createdAt)} · {version.fileName}</span>
                            {version.url && <a href={version.url} target="_blank" rel="noreferrer" className="font-bold text-[#936B2E] hover:underline">Ver</a>}
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                </div>
              );
            })}

            <details className="rounded-xl border border-slate-200 bg-white p-3">
              <summary className="cursor-pointer list-none text-xs font-bold text-slate-600">Documentos opcionales</summary>
              <div className="mt-3 space-y-2">
                {optionalSlots.map((slot) => {
                  const versions = documentsForSlot(slot);
                  const current = versions[0];
                  const previous = versions.slice(1);
                  return (
                    <div key={slot} className="rounded-xl border border-slate-100 bg-slate-50 p-2.5">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                          <p className="flex items-center gap-2 text-xs font-bold text-slate-600"><FileText size={13} /> {ASSOCIATE_DOCUMENT_SLOT_LABELS[slot]}</p>
                          <p className="mt-1 truncate text-[11px] font-medium text-slate-500">
                            {current ? `${current.fileName}${previous.length > 0 ? ` · ${previous.length} versión(es) anterior(es)` : ""}` : "Sin adjuntar"}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          {current?.url && <a href={current.url} target="_blank" rel="noreferrer" className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50">Ver</a>}
                          <button type="button" disabled={uploadingSlot !== null} onClick={() => chooseDocument(slot)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50">
                            <Upload size={13} /> {uploadingSlot === slot ? "Subiendo..." : current ? "Subir nueva versión" : "Adjuntar"}
                          </button>
                        </div>
                      </div>
                      {previous.length > 0 && (
                        <details className="mt-2 border-t border-slate-200 pt-2">
                          <summary className="cursor-pointer list-none text-[11px] font-bold text-slate-500">{previous.length} versión(es) anterior(es)</summary>
                          <ul className="mt-2 space-y-1.5">
                            {previous.map((version) => (
                              <li key={version.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white px-3 py-2 text-[11px]">
                                <span className="min-w-0 truncate font-semibold text-slate-600">Versión anterior · {displayDate(version.createdAt)} · {version.fileName}</span>
                                {version.url && <a href={version.url} target="_blank" rel="noreferrer" className="font-bold text-[#936B2E] hover:underline">Ver</a>}
                              </li>
                            ))}
                          </ul>
                        </details>
                      )}
                    </div>
                  );
                })}
              </div>
            </details>
          </div>
        )}

        {error && <p role="alert" className="mt-4 text-sm font-semibold text-red-700">{error}</p>}
        </div>

        <div className="flex shrink-0 justify-end gap-2 border-t border-slate-100 px-6 py-4">
          <button type="button" onClick={onClose} className="rounded-xl px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100">Cancelar</button>
          <button type="button" disabled={saving} onClick={() => void save()} className="rounded-xl bg-[#172a45] px-4 py-2 text-sm font-bold text-white disabled:opacity-60">
            {saving ? "Guardando..." : "Guardar cambios"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
