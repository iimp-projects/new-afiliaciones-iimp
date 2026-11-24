"use client";

/* eslint-disable react-hooks/set-state-in-effect, @typescript-eslint/no-explicit-any, @next/next/no-img-element -- payload del drawer sin tipar y vista previa local. */

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { BriefcaseBusiness, Building2, Camera, CheckCircle2, Download, FileText, Info, Search, Upload, UserMinus, X } from "lucide-react";
import { toast } from "sonner";
import { AppSelect } from "@/modules/shared/Components/Form";
import { isValidRuc } from "@/modules/afiliaciones/payments/Rules/BillingDocumentRules";
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
type DataTab = "personal" | "academic" | "employment" | "documents";

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
    employmentStatus: string;
    companyTaxId: string;
    companyName: string;
    positionName: string;
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
const employmentStatuses = [
  { value: "EMPLOYED", title: "Trabajo en una empresa", description: "Trabajo para una empresa, institución u organización.", icon: Building2 },
  { value: "SELF_EMPLOYED", title: "Trabajo de forma independiente", description: "Trabajo por cuenta propia o presto servicios profesionales.", icon: BriefcaseBusiness },
  { value: "NOT_WORKING", title: "Actualmente no me encuentro laborando", description: "No mantengo relación laboral ni actividad profesional independiente.", icon: UserMinus },
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
  const draft = user?.draftData ?? person.applications?.[0]?.draftData ?? {};
  const draftPersonal = draft?.personalInformation ?? {};
  const draftAcademic = Array.isArray(draft?.academicStudies) ? draft.academicStudies[0] : null;
  const draftEmployment = draft?.employmentInformation ?? null;
  const toId = (value: any) => (value === null || value === undefined || value === "" ? null : Number.isFinite(Number(value)) ? Number(value) : null);
  const pick = (preferred: any, fallback: any) => (preferred === undefined || preferred === null || preferred === "" ? fallback : preferred);
  const hasEmployment = Boolean(employment || draftEmployment);
  const employmentStatus = draftEmployment?.employmentStatus
    ?? (draftEmployment?.isUnemployed ? "NOT_WORKING" : draftEmployment?.isIndependent ? "SELF_EMPLOYED" : employment ? "EMPLOYED" : "");
  const academicInitial = draftAcademic
    ? {
        studyLevel: academic?.studyLevel ?? "BACHELOR",
        degreeId: toId(draftAcademic.degreeId),
        universityId: toId(draftAcademic.institutionId),
        specialtyId: toId(draftAcademic.specialtyId),
        degreeTitle: pick(draftAcademic.degreeTitle, academic?.degreeTitle) ? String(pick(draftAcademic.degreeTitle, academic?.degreeTitle)) : "",
        professionalAssociation: pick(draftAcademic.professionalAssociation, academic?.professionalAssociation) ? String(pick(draftAcademic.professionalAssociation, academic?.professionalAssociation)) : "",
        licenseNumber: pick(draftAcademic.registrationNumber, academic?.licenseNumber) ? String(pick(draftAcademic.registrationNumber, academic?.licenseNumber)) : "",
        graduationYear: toId(draftAcademic.graduationYear),
        termOrSemester: draftAcademic.cycle === null || draftAcademic.cycle === undefined ? "" : String(draftAcademic.cycle),
      }
    : academic ? {
        studyLevel: academic.studyLevel,
        degreeId: academic.degreeId ?? null,
        universityId: academic.universityId ?? null,
        specialtyId: academic.specialtyId ?? null,
        degreeTitle: academic.degreeTitle ?? "",
        professionalAssociation: academic.professionalAssociation ?? "",
        licenseNumber: academic.licenseNumber ?? "",
        graduationYear: academic.graduationYear ?? null,
        termOrSemester: academic.termOrSemester ?? "",
      } : null;
  return {
    identity: {
      firstName: pick(draftPersonal.names, person.firstName) ?? "",
      paternalLastName: pick(draftPersonal.fatherLastName, person.paternalLastName) ?? "",
      maternalLastName: pick(draftPersonal.motherLastName, person.maternalLastName) ?? "",
      documentType: pick(draftPersonal.documentType, person.documentType) ?? "DNI",
      documentNumber: pick(draftPersonal.documentNumber, person.documentNumber) ?? "",
      birthDate: pick(draftPersonal.birthDate, person.birthDate ? new Date(person.birthDate).toISOString().slice(0, 10) : "") ?? "",
      gender: pick(draftPersonal.gender, person.gender) ?? "",
      nationalityId: toId(draftPersonal.nationalityId) ?? person.nationalityId ?? null,
    },
    contact: {
      phone: pick(draftPersonal.phone, contact?.phoneNumber) ?? "",
      primaryEmail: pick(draftPersonal.primaryEmail, contact?.email) ?? "",
      secondaryEmail: pick(draftPersonal.secondaryEmail, alternate?.email) ?? "",
    },
    address: {
      street: pick(draftPersonal.address, address?.street) ?? "",
      reference: address?.reference ?? "",
      countryId: toId(draftPersonal.countryId) ?? address?.countryId ?? null,
      departmentId: toId(draftPersonal.departmentId) ?? address?.district?.province?.department?.id ?? null,
      provinceId: toId(draftPersonal.provinceId) ?? address?.district?.province?.id ?? null,
      districtId: toId(draftPersonal.districtId) ?? address?.district?.id ?? null,
      postalCode: pick(draftPersonal.postalCode, address?.zipCode) ?? "",
      foreignRegion: pick(draftPersonal.foreignRegion, address?.foreignRegion) ?? "",
      foreignCity: pick(draftPersonal.foreignCity, address?.foreignCity) ?? "",
    },
    academic: academicInitial,
    employment: hasEmployment ? {
      employmentStatus,
      companyTaxId: pick(draftEmployment?.companyTaxId, employment?.company?.taxId) ?? "",
      companyName: pick(draftEmployment?.companyName, employment?.company?.name) ?? "",
      positionName: pick(pick(draftEmployment?.positionName, draftEmployment?.position), employment?.position?.name) ?? "",
      companyId: employment?.companyId ?? null,
      positionId: employment?.positionId ?? null,
      area: pick(draftEmployment?.area, employment?.area) ?? "",
      workingAddress: pick(draftEmployment?.workingAddress, employment?.workingAddress) ?? "",
      workPhone: pick(draftEmployment?.workPhone, employment?.workPhone) ?? "",
      workExtension: pick(draftEmployment?.workExtension, employment?.workExtension) ?? "",
      workEmail: pick(draftEmployment?.workEmail, employment?.workEmail) ?? "",
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
    employmentStatus: initial.employment?.employmentStatus ?? "",
    companyTaxId: text(initial.employment?.companyTaxId),
    companyName: text(initial.employment?.companyName),
    positionName: text(initial.employment?.positionName),
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
  const [activeTab, setActiveTab] = useState<DataTab>("personal");
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
  const [generatingDeclaration, setGeneratingDeclaration] = useState(false);
  const [draft, setDraft] = useState(() => buildDraft(buildAdminAssociateDataInitial(user)));
  const [countries, setCountries] = useState<Item[]>([]);
  const [departments, setDepartments] = useState<Item[]>([]);
  const [provinces, setProvinces] = useState<Item[]>([]);
  const [districts, setDistricts] = useState<Item[]>([]);
  const [universities, setUniversities] = useState<Item[]>([]);
  const [specialties, setSpecialties] = useState<Item[]>([]);
  const [degrees, setDegrees] = useState<DegreeItem[]>([]);
  const [isSearchingRuc, setIsSearchingRuc] = useState(false);
  const [rucState, setRucState] = useState<"IDLE" | "LOADING" | "VERIFIED" | "NOT_FOUND" | "SERVICE_ERROR">("IDLE");
  const [rucFeedback, setRucFeedback] = useState<string | null>(null);

  const isPeru = draft.countryId === "1";
  const dataTabs: { id: DataTab; label: string }[] = [
    { id: "personal", label: "Datos personales" },
    { id: "academic", label: "Formación académica" },
    ...(!isStudent ? [{ id: "employment" as const, label: "Información laboral" }] : []),
    { id: "documents", label: "Documentos" },
  ];
  const tabForField = (field: string): DataTab =>
    field.startsWith("academic.")
      ? "academic"
      : field.startsWith("employment.")
        ? "employment"
        : "personal";

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
    setActiveTab("personal");
    setRucState("IDLE");
    setRucFeedback(null);
    setGeneratingDeclaration(false);
    setError(null);
    setFieldErrors({});
    setPhotoFile(null);
    setPhotoPreview(null);
    void loadDocuments();
    void fetch("/api/catalogs/countries").then((r) => r.json()).then(setCountries).catch(() => undefined);
    void fetch("/api/catalogs/universities").then((r) => r.json()).then(setUniversities).catch(() => undefined);
    void fetch("/api/catalogs/specialties").then((r) => r.json()).then(setSpecialties).catch(() => undefined);
    void fetch("/api/catalogs/degrees").then((r) => r.json()).then((body) => setDegrees(body.data ?? [])).catch(() => undefined);
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
  const optionalSlots: AssociateDocumentSlot[] = [
    ...(isStudent ? (["SWORN_DECLARATION"] as AssociateDocumentSlot[]) : []),
    "CV",
    "DEGREE_CERTIFICATE",
    "RECOMMENDATION_LETTER",
    "PAYMENT_VOUCHER",
    "OTHER",
  ];

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

  const selectEmploymentStatus = (status: string) => {
    setDraft({
      ...draft,
      employmentStatus: status,
      ...(status === "NOT_WORKING"
        ? { companyTaxId: "", companyName: "", positionName: "", area: "", workingAddress: "", workPhone: "", workExtension: "", workEmail: "", companyId: "", positionId: "" }
        : {}),
      ...(status === "SELF_EMPLOYED" ? { companyId: "", positionId: "", workExtension: "" } : {}),
    });
    setRucState("IDLE");
    setRucFeedback(null);
  };

  const searchRuc = async () => {
    const ruc = draft.companyTaxId.trim();
    if (!isValidRuc(ruc)) {
      setFieldErrors((previous) => ({ ...previous, "employment.companyTaxId": "Ingrese un RUC válido de 11 dígitos." }));
      return;
    }
    setIsSearchingRuc(true);
    setRucState("LOADING");
    setRucFeedback(null);
    try {
      const response = await fetch("/api/afiliaciones/postulacion/validate-ruc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ruc }),
      });
      const body = await response.json().catch(() => null);
      if (response.ok && body?.success) {
        setDraft((previous) => ({
          ...previous,
          companyName: body.data?.razonSocial ?? previous.companyName,
          workingAddress: body.data?.direccion ?? previous.workingAddress,
        }));
        setRucState("VERIFIED");
        setRucFeedback("RUC verificado correctamente por SUNAT.");
      } else if (body?.status === "NOT_FOUND") {
        setRucState("NOT_FOUND");
        setRucFeedback("No encontramos información para este RUC. Puede completar los datos manualmente.");
      } else {
        setRucState("SERVICE_ERROR");
        setRucFeedback("No pudimos consultar SUNAT en este momento. Puede completar los datos manualmente.");
      }
    } catch {
      setRucState("SERVICE_ERROR");
      setRucFeedback("No pudimos consultar SUNAT en este momento. Puede completar los datos manualmente.");
    } finally {
      setIsSearchingRuc(false);
    }
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
      employment: !isStudent && draft.employmentStatus ? {
        employmentStatus: draft.employmentStatus as "EMPLOYED" | "SELF_EMPLOYED" | "NOT_WORKING",
        companyId: null,
        positionId: null,
        companyName: draft.companyName.trim() ? draft.companyName : null,
        positionName: draft.positionName.trim() ? draft.positionName : null,
        companyTaxId: draft.companyTaxId.trim() ? draft.companyTaxId : null,
        area: draft.area.trim() ? draft.area : null,
        workingAddress: draft.workingAddress.trim() ? draft.workingAddress : null,
        workPhone: draft.workPhone.trim() ? draft.workPhone : null,
        workExtension: draft.workExtension.trim() ? draft.workExtension : null,
        workEmail: email(draft.workEmail),
      } : null,
    } as unknown as AdminAssociateDataInput;
  };

  const buildDeclarationDraft = () => {
    const person = user?.person ?? {};
    const baseDraft = user?.draftData ?? person.applications?.[0]?.draftData ?? {};
    const baseAcademic = Array.isArray(baseDraft.academicStudies) ? baseDraft.academicStudies[0] ?? {} : {};
    const numberOrUndefined = (value: string) => (value ? Number(value) : undefined);
    const specialtyName = specialties.find((item) => String(item.id) === draft.specialtyId)?.name;
    return {
      ...baseDraft,
      membershipType: isStudent ? "STUDENT" : "ACTIVE",
      personalInformation: {
        ...(baseDraft.personalInformation ?? {}),
        names: draft.firstName,
        fatherLastName: draft.paternalLastName,
        motherLastName: draft.maternalLastName,
        documentType: draft.documentType,
        documentNumber: draft.documentNumber,
        birthDate: draft.birthDate,
        gender: draft.gender,
        nationalityId: numberOrUndefined(draft.nationalityId),
        phone: draft.phone,
        primaryEmail: draft.primaryEmail,
        secondaryEmail: draft.secondaryEmail,
        countryId: numberOrUndefined(draft.countryId),
        departmentId: numberOrUndefined(draft.departmentId),
        provinceId: numberOrUndefined(draft.provinceId),
        districtId: numberOrUndefined(draft.districtId),
        address: draft.street,
        postalCode: draft.postalCode,
        foreignRegion: draft.foreignRegion,
        foreignCity: draft.foreignCity,
      },
      academicStudies: draft.includeAcademic ? [{
        ...baseAcademic,
        institutionId: numberOrUndefined(draft.universityId),
        otherInstitution: undefined,
        specialtyId: numberOrUndefined(draft.specialtyId),
        specialty: specialtyName ?? baseAcademic.specialty ?? "",
        degreeId: numberOrUndefined(draft.degreeId),
        degreeTitle: draft.degreeTitle,
        professionalAssociation: draft.professionalAssociation,
        registrationNumber: draft.licenseNumber,
        graduationYear: numberOrUndefined(draft.graduationYear),
        cycle: numberOrUndefined(draft.termOrSemester),
      }] : [],
      employmentInformation: !isStudent && draft.employmentStatus ? {
        employmentStatus: draft.employmentStatus,
        isIndependent: draft.employmentStatus === "SELF_EMPLOYED",
        isUnemployed: draft.employmentStatus === "NOT_WORKING",
        companyName: draft.companyName,
        positionName: draft.positionName,
        companyTaxId: draft.companyTaxId,
        area: draft.area,
        workPhone: draft.workPhone,
        workExtension: draft.workExtension,
        workEmail: draft.workEmail,
        workingAddress: draft.workingAddress,
      } : {},
      endorsements: baseDraft.endorsements ?? {},
    };
  };

  const generateDeclaration = async () => {
    const scopedApplicationId = applicationId ?? documentApplicationId;
    if (!scopedApplicationId) {
      setError("No se encontró un expediente asociado para generar la declaración jurada.");
      return;
    }
    setGeneratingDeclaration(true);
    setError(null);
    try {
      const response = await fetch("/api/afiliaciones/postulacion/generate-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draft: buildDeclarationDraft(), applicationId: scopedApplicationId }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.message ?? "No fue posible generar la declaración jurada.");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "Declaracion_Jurada_IIMP.pdf";
      link.click();
      URL.revokeObjectURL(url);
    } catch (generateError) {
      setError(generateError instanceof Error ? generateError.message : "No fue posible generar la declaración jurada.");
    } finally {
      setGeneratingDeclaration(false);
    }
  };

  const save = async () => {
    const payload = buildPayload();
    const errors = validateAdminAssociateData(payload, { isStudent });
    setFieldErrors(errors);
    const errorFields = Object.keys(errors);
    if (errorFields.length > 0) {
      setActiveTab(tabForField(errorFields[0]));
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
          const errorFields = Object.keys(normalizedErrors);
          if (errorFields.length > 0) setActiveTab(tabForField(errorFields[0]));
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
      <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-100 px-6 py-4">
          <h2 id="admin-associate-data-title" className="font-black text-slate-800">{variant === "applicant" ? "Editar datos del postulante" : "Editar datos del asociado"}</h2>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="rounded-full p-1.5 text-slate-500 hover:bg-slate-100"><X size={18} /></button>
        </div>

        <nav role="tablist" aria-label="Secciones de edición" className="flex shrink-0 overflow-x-auto border-b border-slate-100 bg-white px-2 sm:px-6">
          {dataTabs.map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setActiveTab(tab.id)}
                className={`min-w-max border-b-[3px] px-3 py-3 text-xs font-bold transition-colors ${active ? "border-[#C5A059] text-[#C5A059]" : "border-transparent text-slate-500 hover:text-[#C5A059]"}`}
              >
                {tab.label}
              </button>
            );
          })}
        </nav>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
        {activeTab === "personal" && (
        <>
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

        <div className="mt-2 grid gap-4 sm:grid-cols-2">
          <label className="grid gap-1.5 text-sm font-semibold text-slate-700"><span>Nombres <span className="text-red-500">*</span></span><input className={inputClass} value={draft.firstName} onChange={(e) => setDraft({ ...draft, firstName: e.target.value })} />{fieldError("identity.firstName")}</label>
          <label className="grid gap-1.5 text-sm font-semibold text-slate-700"><span>Apellido paterno <span className="text-red-500">*</span></span><input className={inputClass} value={draft.paternalLastName} onChange={(e) => setDraft({ ...draft, paternalLastName: e.target.value })} />{fieldError("identity.paternalLastName")}</label>
          <label className="grid gap-1.5 text-sm font-semibold text-slate-700"><span>Apellido materno <span className="font-normal text-slate-400">(opcional)</span></span><input className={inputClass} value={draft.maternalLastName} onChange={(e) => setDraft({ ...draft, maternalLastName: e.target.value })} />{fieldError("identity.maternalLastName")}</label>
          <div className="grid gap-1.5"><AppSelect label="Tipo de documento" required disabled value={draft.documentType} options={documentOptions} onChange={(value) => setDraft({ ...draft, documentType: value })} placeholder="Seleccione" />{fieldError("identity.documentType")}</div>
          <label className="grid gap-1.5 text-sm font-semibold text-slate-700"><span>Número de documento <span className="text-red-500">*</span></span><input disabled className={`${inputClass} disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500`} value={draft.documentNumber} onChange={(e) => setDraft({ ...draft, documentNumber: e.target.value })} />{fieldError("identity.documentNumber")}</label>
          <label className="grid gap-1.5 text-sm font-semibold text-slate-700"><span>Fecha de nacimiento <span className="text-red-500">*</span></span><input type="date" className={inputClass} value={draft.birthDate} onChange={(e) => setDraft({ ...draft, birthDate: e.target.value })} />{fieldError("identity.birthDate")}</label>
          <div className="grid gap-1.5"><AppSelect label="Género" required value={draft.gender} options={genderOptions} onChange={(value) => setDraft({ ...draft, gender: value })} placeholder="Seleccione" />{fieldError("identity.gender")}</div>
          <AppSelect label="Nacionalidad" value={draft.nationalityId} options={countries.map((item) => ({ value: item.id, label: item.name }))} onChange={(value) => setDraft({ ...draft, nationalityId: value })} placeholder="Seleccione" searchable />
        </div>

        <p className="mt-6 text-xs font-black uppercase tracking-widest text-[#9b7530]">Contacto</p>
        <div className="mt-2 grid gap-4 sm:grid-cols-3">
          <label className="grid gap-1.5 text-sm font-semibold text-slate-700"><span>Celular <span className="text-red-500">*</span></span><input className={inputClass} value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} />{fieldError("contact.phone")}</label>
          <label className="grid gap-1.5 text-sm font-semibold text-slate-700"><span>Correo de contacto <span className="text-red-500">*</span></span><input type="email" className={inputClass} value={draft.primaryEmail} onChange={(e) => setDraft({ ...draft, primaryEmail: e.target.value })} />{fieldError("contact.primaryEmail")}</label>
          <label className="grid gap-1.5 text-sm font-semibold text-slate-700">Correo secundario<input type="email" className={inputClass} value={draft.secondaryEmail} onChange={(e) => setDraft({ ...draft, secondaryEmail: e.target.value })} />{fieldError("contact.secondaryEmail")}</label>
        </div>

        <p className="mt-6 text-xs font-black uppercase tracking-widest text-[#9b7530]">Dirección</p>
        <div className="mt-2 grid gap-4 sm:grid-cols-2">
          <label className="grid gap-1.5 text-sm font-semibold text-slate-700 sm:col-span-2"><span>Dirección <span className="text-red-500">*</span></span><input className={inputClass} value={draft.street} onChange={(e) => setDraft({ ...draft, street: e.target.value })} />{fieldError("address.street")}</label>
          <label className="grid gap-1.5 text-sm font-semibold text-slate-700 sm:col-span-2">Referencia<input className={inputClass} value={draft.reference} onChange={(e) => setDraft({ ...draft, reference: e.target.value })} />{fieldError("address.reference")}</label>
          <div className="grid gap-1.5"><AppSelect label="País" required value={draft.countryId} options={countries.map((item) => ({ value: item.id, label: item.name }))} onChange={(value) => setDraft({ ...draft, countryId: value, departmentId: "", provinceId: "", districtId: "" })} placeholder="Seleccione" searchable />{fieldError("address.countryId")}</div>
          {isPeru && (
            <>
              <div className="grid gap-1.5"><AppSelect label="Departamento" value={draft.departmentId} options={departments.map((item) => ({ value: item.id, label: item.name }))} onChange={(value) => setDraft({ ...draft, departmentId: value, provinceId: "", districtId: "" })} placeholder="Seleccione" />{fieldError("address.departmentId")}</div>
              <AppSelect label="Provincia" value={draft.provinceId} options={provinces.map((item) => ({ value: item.id, label: item.name }))} onChange={(value) => setDraft({ ...draft, provinceId: value, districtId: "" })} placeholder="Seleccione" />
              <div className="grid gap-1.5"><AppSelect label="Distrito" required value={draft.districtId} options={districts.map((item) => ({ value: item.id, label: item.name }))} onChange={(value) => setDraft({ ...draft, districtId: value })} placeholder="Seleccione" />{fieldError("address.districtId")}</div>
            </>
          )}
          {!isPeru && draft.countryId && (
            <>
              <label className="grid gap-1.5 text-sm font-semibold text-slate-700"><span>Región / Estado <span className="text-red-500">*</span></span><input className={inputClass} value={draft.foreignRegion} onChange={(e) => setDraft({ ...draft, foreignRegion: e.target.value })} />{fieldError("address.foreignRegion")}</label>
              <label className="grid gap-1.5 text-sm font-semibold text-slate-700"><span>Ciudad <span className="text-red-500">*</span></span><input className={inputClass} value={draft.foreignCity} onChange={(e) => setDraft({ ...draft, foreignCity: e.target.value })} />{fieldError("address.foreignCity")}</label>
            </>
          )}
          <label className="grid gap-1.5 text-sm font-semibold text-slate-700">Código postal (opcional)<input className={inputClass} value={draft.postalCode} onChange={(e) => setDraft({ ...draft, postalCode: e.target.value.replace(/[^\dA-Za-z-]/g, "") })} /></label>
        </div>
        </>
        )}

        {activeTab === "academic" && (
        <>
        <div className="flex items-center justify-end">
          <label className="flex items-center gap-2 text-xs font-bold text-slate-600"><input type="checkbox" checked={draft.includeAcademic} onChange={(e) => setDraft({ ...draft, includeAcademic: e.target.checked })} /> Registrar</label>
        </div>
        {draft.includeAcademic ? (
          <div className="mt-2 grid gap-4 sm:grid-cols-2">
            <AppSelect label="Nivel de estudio" value={draft.studyLevel} options={studyLevelOptions} onChange={(value) => setDraft({ ...draft, studyLevel: value })} placeholder="Seleccione" />
            <div className="grid gap-1.5"><AppSelect label="Universidad" required value={draft.universityId} options={universities.map((item) => ({ value: item.id, label: item.name }))} onChange={(value) => setDraft({ ...draft, universityId: value })} placeholder="Seleccione" searchable />{fieldError("academic.universityId")}</div>
            <div className="grid gap-1.5"><AppSelect label="Especialidad" required value={draft.specialtyId} options={specialties.map((item) => ({ value: item.id, label: item.name }))} onChange={(value) => setDraft({ ...draft, specialtyId: value })} placeholder="Seleccione" searchable />{fieldError("academic.specialtyId")}</div>
            <div className="grid gap-1.5"><AppSelect label="Grado" required={!isStudent} value={draft.degreeId} options={degrees.map((item) => ({ value: item.id, label: item.name }))} onChange={(value) => setDraft({ ...draft, degreeId: value })} placeholder="Seleccione" searchable />{fieldError("academic.degreeId")}</div>
            <label className="grid gap-1.5 text-sm font-semibold text-slate-700"><span>Título / grado {!isStudent && <span className="text-red-500">*</span>}</span><input className={inputClass} value={draft.degreeTitle} onChange={(e) => setDraft({ ...draft, degreeTitle: e.target.value })} />{fieldError("academic.degreeTitle")}</label>
            <label className="grid gap-1.5 text-sm font-semibold text-slate-700"><span>Año de egreso {!isStudent && <span className="text-red-500">*</span>}</span><input type="number" className={inputClass} value={draft.graduationYear} onChange={(e) => setDraft({ ...draft, graduationYear: e.target.value })} />{fieldError("academic.graduationYear")}</label>
            <label className="grid gap-1.5 text-sm font-semibold text-slate-700">Colegiatura<input className={inputClass} value={draft.professionalAssociation} onChange={(e) => setDraft({ ...draft, professionalAssociation: e.target.value })} />{fieldError("academic.professionalAssociation")}</label>
            <label className="grid gap-1.5 text-sm font-semibold text-slate-700">Número de colegiatura<input className={inputClass} value={draft.licenseNumber} onChange={(e) => setDraft({ ...draft, licenseNumber: e.target.value })} />{fieldError("academic.licenseNumber")}</label>
            <label className="grid gap-1.5 text-sm font-semibold text-slate-700"><span>Ciclo / semestre {isStudent && <span className="text-red-500">*</span>}</span><input className={inputClass} value={draft.termOrSemester} onChange={(e) => setDraft({ ...draft, termOrSemester: e.target.value })} />{fieldError("academic.termOrSemester")}</label>
          </div>
        ) : (
          <p className="mt-2 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm font-medium text-slate-500">Sin formación académica registrada. Active &quot;Registrar&quot; para agregarla.</p>
        )}
        </>
        )}

        {!isStudent && activeTab === "employment" && (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              {employmentStatuses.map((option) => {
                const Icon = option.icon;
                const selected = draft.employmentStatus === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => selectEmploymentStatus(option.value)}
                    className={selected ? "rounded-2xl border-2 border-[#C5A059] bg-[#FFF9EC] p-4 text-left shadow-sm" : "rounded-2xl border border-slate-200 bg-white p-4 text-left transition hover:border-[#D6A84A]"}
                  >
                    <span className={selected ? "flex h-9 w-9 items-center justify-center rounded-xl bg-[#C5A059] text-white" : "flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-600"}><Icon size={18} /></span>
                    <span className="mt-3 block text-xs font-black text-slate-800">{option.title}</span>
                    <span className="mt-1 block text-[11px] leading-4 text-slate-500">{option.description}</span>
                  </button>
                );
              })}
            </div>
            {fieldError("employment.employmentStatus")}

            {draft.employmentStatus === "NOT_WORKING" && (
              <div className="mt-4 flex gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
                <CheckCircle2 className="mt-0.5 shrink-0 text-emerald-600" size={18} />
                <div>
                  <p className="font-black">Sin actividad laboral actual</p>
                  <p className="mt-1 text-xs leading-5">Se guardará que el asociado no cuenta con información laboral vigente.</p>
                </div>
              </div>
            )}

            {(draft.employmentStatus === "EMPLOYED" || draft.employmentStatus === "SELF_EMPLOYED") && (
              <>
                <div className="mt-5 rounded-xl border border-[#E8D09E] bg-[#FCFAF6] p-4">
                  <label className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-700">
                    {draft.employmentStatus === "EMPLOYED" ? "RUC de la empresa" : "RUC (opcional)"}
                    <Info size={14} className="text-[#A67C00]" />
                  </label>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <input
                      value={draft.companyTaxId}
                      onChange={(e) => {
                        setDraft({ ...draft, companyTaxId: e.target.value.replace(/\D/g, "").slice(0, 11) });
                        setRucState("IDLE");
                        setRucFeedback(null);
                      }}
                      placeholder="Ingrese el RUC de 11 dígitos"
                      className={`${inputClass} flex-1`}
                    />
                    <button type="button" onClick={() => void searchRuc()} disabled={isSearchingRuc || draft.companyTaxId.length !== 11} className="h-11 shrink-0 rounded-xl bg-[#C5A059] px-4 text-sm font-bold text-white transition hover:bg-[#A67C00] disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400">
                      {isSearchingRuc ? "Consultando..." : "Consultar"}
                    </button>
                  </div>
                  {fieldError("employment.companyTaxId")}
                  {rucFeedback && <p className={`mt-2 text-xs font-semibold ${rucState === "VERIFIED" ? "text-emerald-700" : "text-amber-700"}`}>{rucFeedback}</p>}
                </div>

                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
                    <span>{draft.employmentStatus === "EMPLOYED" ? "Empresa o institución" : "Nombre comercial"} {draft.employmentStatus === "EMPLOYED" ? <span className="text-red-500">*</span> : <span className="font-normal text-slate-400">(opcional)</span>}</span>
                    <input className={inputClass} value={draft.companyName} onChange={(e) => setDraft({ ...draft, companyName: e.target.value })} />
                    {fieldError("employment.companyName")}
                  </label>
                  <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
                    <span>{draft.employmentStatus === "EMPLOYED" ? "Área o departamento" : "Especialidad o área profesional"}</span>
                    <input className={inputClass} value={draft.area} onChange={(e) => setDraft({ ...draft, area: e.target.value })} />
                    {fieldError("employment.area")}
                  </label>
                  <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
                    <span>{draft.employmentStatus === "EMPLOYED" ? "Cargo" : "Actividad principal / profesión"} <span className="text-red-500">*</span></span>
                    <input className={inputClass} value={draft.positionName} onChange={(e) => setDraft({ ...draft, positionName: e.target.value })} />
                    {fieldError("employment.positionName")}
                  </label>
                  <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
                    <span>{draft.employmentStatus === "EMPLOYED" ? "Correo corporativo" : "Correo profesional"} <span className="text-red-500">*</span></span>
                    <input type="email" className={inputClass} value={draft.workEmail} onChange={(e) => setDraft({ ...draft, workEmail: e.target.value })} />
                    {fieldError("employment.workEmail")}
                  </label>
                  <label className="grid gap-1.5 text-sm font-semibold text-slate-700 sm:col-span-2">
                    <span>{draft.employmentStatus === "EMPLOYED" ? "Dirección de la empresa" : "Dirección profesional"} <span className="text-red-500">*</span></span>
                    <input className={inputClass} value={draft.workingAddress} onChange={(e) => setDraft({ ...draft, workingAddress: e.target.value })} />
                    {fieldError("employment.workingAddress")}
                  </label>
                  <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
                    <span>Teléfono <span className="text-red-500">*</span></span>
                    <input className={inputClass} value={draft.workPhone} onChange={(e) => setDraft({ ...draft, workPhone: e.target.value })} />
                    {fieldError("employment.workPhone")}
                  </label>
                  {draft.employmentStatus === "EMPLOYED" && (
                    <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
                      <span>Anexo <span className="font-normal text-slate-400">(opcional)</span></span>
                      <input className={inputClass} value={draft.workExtension} onChange={(e) => setDraft({ ...draft, workExtension: e.target.value })} />
                      {fieldError("employment.workExtension")}
                    </label>
                  )}
                </div>
              </>
            )}
          </>
        )}

        {activeTab === "documents" && (
        <>
        <div className="flex items-center justify-between">
          {documentApplicationId && <span className="text-[11px] font-semibold text-slate-400">Expediente #{documentApplicationId}</span>}
        </div>
        <p className="mt-1 text-[11px] font-medium text-slate-500">No se elimina ningún documento: al subir uno nuevo, el anterior queda como versión anterior.</p>
        {!isStudent && (
          <div className="mt-3 rounded-xl border border-[#E8D09E] bg-[#FCFAF6] p-4">
            <p className="text-xs font-black uppercase tracking-widest text-[#A67C00]">Declaración jurada</p>
            <p className="mt-1 text-xs leading-5 text-slate-600">Genera el PDF con los datos actuales del asociado, fírmalo y súbelo en &quot;Declaración jurada firmada&quot;.</p>
            <button
              type="button"
              onClick={() => void generateDeclaration()}
              disabled={generatingDeclaration || (!applicationId && !documentApplicationId)}
              className="mt-3 inline-flex h-11 items-center gap-2 rounded-xl bg-[#C5A059] px-5 text-sm font-black text-white transition hover:bg-[#A67C00] disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
            >
              <Download size={16} /> {generatingDeclaration ? "Generando..." : "Generar y descargar declaración"}
            </button>
            {!applicationId && !documentApplicationId && <p className="mt-2 text-[11px] font-semibold text-amber-700">No se encontró un expediente asociado para generar la declaración.</p>}
          </div>
        )}
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
        </>
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
