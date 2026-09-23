"use client";

import "./AssociateProfileView.css";

/* eslint-disable react-hooks/set-state-in-effect, @next/next/no-img-element */

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";

import {
  BriefcaseBusiness,
  CheckCircle2,
  ChevronRight,
  GraduationCap,
  LockKeyhole,
  MapPin,
  Pencil,
  ShieldCheck,
  UserRound,
  BadgeCheck,
  Camera,
  Plus,
  X,
} from "lucide-react";

import { AppSelect } from "@/modules/shared/Components/Form";
import { PROFILE_CONTENT } from "../Config/ProfileContent";
import type { AssociateProfileDTO } from "../Services/AssociateProfileService";
import { formatCalendarDate } from "../Utils/calendarDate";

type Item = {
  id: number;
  name: string;
};

type Draft = {
  firstName: string;
  paternalLastName: string;
  maternalLastName: string;
  birthDate: string;
  gender: string;
  nationalityId: string;
  primaryPhone: string;
  secondaryEmail: string;
  street: string;
  reference: string;
  countryId: string;
  departmentId: string;
  provinceId: string;
  districtId: string;
};
type EmploymentDraft = { companyId: string; positionId: string; area: string; workingAddress: string; workPhone: string; workExtension: string; workEmail: string };

const gold = "#b48a37";
const missing = "No registrado";
const genderOptions = [
  { value: "MALE", label: "Masculino" },
  { value: "FEMALE", label: "Femenino" },
  { value: "OTHER", label: "Otro" },
  { value: "PREFER_NOT_TO_SAY", label: "Prefiero no decirlo" },
];

const show = (value: string | number | null | undefined) => value || missing;
const genderLabel = (value: string | null) =>
  genderOptions.find((option) => option.value === value)?.label ?? missing;

const date = (value: string | null) => formatCalendarDate(value) ?? missing;
const dateTime = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat("es-PE", { dateStyle: "medium" }).format(new Date(value))
    : missing;
const membershipStatusLabels: Record<string, string> = {
  ACTIVE: "Activa",
  INACTIVE: "Inactiva",
  PENDING: "Pendiente",
};
const membershipStatusLabel = (value: string) => membershipStatusLabels[value] ?? value;

function Read({ label, value }: { label: string | null; value: string | number | null | undefined }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-[.13em] text-slate-400">
        {label ?? missing}
      </p>

      <p className="mt-1 text-sm font-semibold text-[#172a45]">{show(value)}</p>
    </div>
  );
}

function Card({ title, icon, children, tone = "default" }: { title: string; icon: React.ReactNode; children: React.ReactNode; tone?: "default" | "membership" }) {
  return (
    <section className={`rounded-2xl border p-5 shadow-sm ${tone === "membership" ? "border-[#e6d2a5] bg-[#fcfaf5]" : "border-slate-200 bg-white"}`}>
      <h2 className={`flex items-center gap-2 border-b pb-3 font-extrabold text-[#172a45] ${tone === "membership" ? "border-[#ead9b9]" : "border-slate-100"}`}>
        {icon}
        {title}
      </h2>

      <div className="mt-4">{children}</div>
    </section>
  );
}

export function AssociateProfileView() {
  const [p, setP] = useState<AssociateProfileDTO | null>(null);
  const [employmentOpen, setEmploymentOpen] = useState(false);
  const [employmentSaving, setEmploymentSaving] = useState(false);
  const [employmentError, setEmploymentError] = useState<string | null>(null);
  const [employmentCatalog, setEmploymentCatalog] = useState<{ companies: Item[]; positions: Item[] }>({ companies: [], positions: [] });
  const [employment, setEmployment] = useState<EmploymentDraft>({ companyId: "", positionId: "", area: "", workingAddress: "", workPhone: "", workExtension: "", workEmail: "" });

  const [edit, setEdit] = useState(false);
  const [saving, setSaving] = useState(false);

  const [err, setErr] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const [d, setD] = useState<Draft>({
    firstName: "", paternalLastName: "", maternalLastName: "", birthDate: "", gender: "", nationalityId: "",
    primaryPhone: "",
    secondaryEmail: "",
    street: "",
    reference: "",
    countryId: "",
    departmentId: "",
    provinceId: "",
    districtId: "",
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [profileImageFile, setProfileImageFile] = useState<File | null>(null);
  const [profileImagePreview, setProfileImagePreview] = useState<string | null>(null);

  const clearProfileImage = () => {
    if (profileImagePreview) URL.revokeObjectURL(profileImagePreview);
    setProfileImageFile(null);
    setProfileImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleProfileImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) { setErr("Selecciona una imagen JPG, PNG o WEBP."); event.target.value = ""; return; }
    if (file.size > 5 * 1024 * 1024) { setErr("La fotografía no puede superar los 5 MB."); event.target.value = ""; return; }
    if (profileImagePreview) URL.revokeObjectURL(profileImagePreview);
    setErr(null);
    setProfileImageFile(file);
    setProfileImagePreview(URL.createObjectURL(file));
    event.target.value = "";
  };

  const [countries, setCountries] = useState<Item[]>([]);
  const [departments, setDepartments] = useState<Item[]>([]);
  const [provinces, setProvinces] = useState<Item[]>([]);
  const [districts, setDistricts] = useState<Item[]>([]);

  /* PROFILE */

  useEffect(() => {
    void fetch("/api/mi-cuenta/perfil")
      .then((r) => r.json())
      .then((b) => {
        if (b.success) {
          setP(b.data);
          return;
        }

        setErr(b.message);
      })
      .catch(() => {
        setErr("No fue posible cargar tu perfil.");
      });
  }, []);

  const openEmployment = () => {
    setEmploymentError(null);
    setEmployment({ companyId: p?.professional?.companyId ? String(p.professional.companyId) : "", positionId: p?.professional?.positionId ? String(p.professional.positionId) : "", area: p?.professional?.area ?? "", workingAddress: p?.professional?.workingAddress ?? "", workPhone: p?.professional?.workPhone ?? "", workExtension: p?.professional?.workExtension ?? "", workEmail: p?.professional?.workEmail ?? "" });
    setEmploymentOpen(true);
    void fetch("/api/mi-cuenta/perfil/laboral").then((response) => response.json()).then((body) => { if (body.success) setEmploymentCatalog(body.data); else setEmploymentError(body.message); }).catch(() => setEmploymentError("No fue posible cargar los catálogos laborales."));
  };
  const saveEmployment = async () => {
    setEmploymentSaving(true); setEmploymentError(null);
    try { const response = await fetch("/api/mi-cuenta/perfil/laboral", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...employment, companyId: Number(employment.companyId), positionId: employment.positionId ? Number(employment.positionId) : null, area: employment.area || null, workingAddress: employment.workingAddress || null, workPhone: employment.workPhone || null, workExtension: employment.workExtension || null, workEmail: employment.workEmail || null }) }); const body = await response.json(); if (!response.ok) throw new Error(body.message); setP(body.data); setEmploymentOpen(false); toast.success("Tu información laboral fue actualizada correctamente."); } catch (error) { setEmploymentError(error instanceof Error ? error.message : "No pudimos guardar los cambios. Inténtalo nuevamente."); } finally { setEmploymentSaving(false); }
  };

  useEffect(() => () => { if (profileImagePreview) URL.revokeObjectURL(profileImagePreview); }, [profileImagePreview]);

  /* COUNTRIES */

  useEffect(() => {
    void fetch("/api/catalogs/countries")
      .then((r) => r.json())
      .then(setCountries);
  }, []);

  /* DEPARTMENTS */

  useEffect(() => {
    if (!d.countryId) {
      setDepartments([]);
      return;
    }

    void fetch(`/api/catalogs/${d.countryId}/departments`)
      .then((r) => r.json())
      .then(setDepartments);
  }, [d.countryId]);

  /* PROVINCES */

  useEffect(() => {
    if (!d.departmentId) {
      setProvinces([]);
      return;
    }

    void fetch(`/api/catalogs/${d.departmentId}/provinces`)
      .then((r) => r.json())
      .then(setProvinces);
  }, [d.departmentId]);

  /* DISTRICTS */

  useEffect(() => {
    if (!d.provinceId) {
      setDistricts([]);
      return;
    }

    void fetch(`/api/catalogs/${d.provinceId}/districts`)
      .then((r) => r.json())
      .then(setDistricts);
  }, [d.provinceId]);

  /* LOADING / ERROR */

  if (err && !p) {
    return (
      <p role="alert" className="text-sm font-semibold text-red-700">
        {err}
      </p>
    );
  }

  if (!p) {
    return (
      <div
        aria-label="Cargando perfil"
        className="h-64 animate-pulse rounded-2xl bg-slate-100"
      />
    );
  }

  /* START EDIT */

  const start = () => {
    setErr(null);
    setNote(null);

    setD({
      firstName: p.identity.firstName, paternalLastName: p.identity.paternalLastName, maternalLastName: p.identity.maternalLastName ?? "", birthDate: p.identity.birthDate?.slice(0, 10) ?? "", gender: p.identity.gender ?? "", nationalityId: String(p.identity.nationalityId ?? ""),
      primaryPhone: p.contact.primaryPhone ?? "",
      secondaryEmail: p.contact.secondaryEmail ?? "",
      street: p.address.street ?? "",
      reference: p.address.reference ?? "",
      countryId: String(p.address.countryId ?? ""),
      departmentId: String(p.address.departmentId ?? ""),
      provinceId: String(p.address.provinceId ?? ""),
      districtId: String(p.address.districtId ?? ""),
    });

    setEdit(true);
  };

  /* SAVE */

  const save = async () => {
    setSaving(true);
    setErr(null);
    setNote(null);

    try {
      let response = await fetch("/api/mi-cuenta/perfil/contacto", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          primaryPhone: d.primaryPhone,
          secondaryEmail: d.secondaryEmail || null,
        }),
      });

      let body = await response.json();

      if (!response.ok) {
        throw new Error(body.message);
      }

      response = await fetch("/api/mi-cuenta/perfil/direccion", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          street: d.street,
          reference: d.reference || null,
          countryId: d.countryId ? Number(d.countryId) : null,
          districtId: d.districtId ? Number(d.districtId) : null,
        }),
      });

      body = await response.json();

      if (!response.ok) {
        throw new Error(body.message);
      }

      setP(body.data);
      clearProfileImage();
      setEdit(false);

      setNote("Tus datos se actualizaron correctamente.");
    } catch (error) {
      setErr(
        error instanceof Error ? error.message : "No fue posible guardar.",
      );
    } finally {
      setSaving(false);
    }
  };

  /* DATA */

  const names = p.identity.fullName.split(/\s+/);

  const initials = names
    .slice(0, 2)
    .map((x) => x[0])
    .join("");

  const member =
    p.membership.type === "STUDENT" ? "Asociado estudiante" : "Asociado activo";
  const isStudent = p.membership.type === "STUDENT";

  const opts = (
    label: string,
    value: string,
    items: Item[],
    change: (value: string) => void,
    disabled = false,
  ) => (
    <AppSelect
      label={label}
      value={value}
      options={items.map((x) => ({
        value: x.id,
        label: x.name,
      }))}
      onChange={change}
      placeholder="Seleccione"
      disabled={disabled}
      searchable={label === "País"}
    />
  );

  /* VIEW */

  return (
    <main className="w-full space-y-3 pb-8">
      {/* HERO */}
      <header className="relative h-[150px] w-full overflow-hidden">
  {/* PAISAJE MINERO + TINTE INSTITUCIONAL */}
  <div
    aria-hidden="true"
    className="pointer-events-none absolute inset-y-0 right-0 w-[82%] sm:w-[82%] md:w-[82%] lg:w-[80%] xl:w-[80%] 2xl:w-[78%] overflow-hidden [mask-image:linear-gradient(to_right,transparent_0%,black_15%,black_100%)] [-webkit-mask-image:linear-gradient(to_right,transparent_0%,black_15%,black_100%)]"
  >
    {/* FOTO ORIGINAL */}
    <img
      src="/images/iimp/fondo-asociado-hero.png"
      alt=""
      className="absolute inset-0 h-full w-full object-cover object-[center_52%]"
    />

    {/* TINTE DORADO IIMP MUY SUAVE */}
    <div
      className="absolute inset-0 bg-[#C5A059]/16"
    />

    {/* VELO CÁLIDO PARA INTEGRAR LA FOTO */}
    <div
      className="absolute inset-0 bg-gradient-to-r from-[#F8F4EC]/10 via-[#C5A059]/5 to-[#9A742E]/10"
    />
  </div>

  {/* TEXTO IZQUIERDO */}
  <div
    className="relative z-20 flex h-full max-w-[460px] flex-col justify-center px-4 lg:px-5"
  >
    <p className="text-sm font-bold text-[#a67c00]">
      Mi cuenta
    </p>

    <h1 className="mt-0.5 text-3xl font-black tracking-tight text-[#172a45]">
      Mi perfil
    </h1>

    <p className="mt-1 text-sm text-slate-600">
      Mantén actualizada tu información personal y profesional.
    </p>
  </div>

  {/* ACCIONES */}
  <div
    className="absolute right-5 top-1/2 z-30 -translate-y-1/2 lg:right-6"
  >
    {edit ? (
      <div className="flex items-center gap-2">
        {/* CANCELAR */}
        <button
          type="button"
          onClick={() => {
            clearProfileImage();
            setEdit(false);
            setErr(null);
            setNote(null);
          }}
          className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white/95 px-4 text-sm font-semibold text-[#172a45] shadow-sm backdrop-blur-sm transition hover:border-slate-300 hover:bg-white"
        >
          <X size={16} />
          Cancelar
        </button>

        {/* GUARDAR */}
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving}
          className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#172a45] bg-[#172a45] px-4 text-sm font-bold text-white shadow-md transition hover:border-[#102038] hover:bg-[#102038] disabled:cursor-not-allowed disabled:opacity-60"
        >
          <CheckCircle2 size={16} />
          {saving ? "Guardando..." : "Guardar cambios"}
        </button>
      </div>
    ) : (
      /* EDITAR PERFIL */
      <button
        type="button"
        onClick={start}
        className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#172a45] bg-[#172a45] px-4 text-sm font-bold text-white shadow-md transition hover:border-[#102038] hover:bg-[#102038] hover:shadow-lg"
      >
        <Pencil size={16} />
        Editar perfil
      </button>
    )}
  </div>

  {/* MENSAJES */}
  {note && (
    <p
      role="status"
      className="absolute bottom-2 left-4 z-30 rounded-lg bg-emerald-50/90 px-3 py-1.5 text-xs font-semibold text-emerald-700 shadow-sm"
    >
      {note}
    </p>
  )}

  {err && (
    <p
      role="alert"
      className="absolute bottom-2 left-4 z-30 rounded-lg bg-red-50/90 px-3 py-1.5 text-xs font-semibold text-red-700 shadow-sm"
    >
      {err}
    </p>
  )}
</header>

     {/* PRESENTACIÓN + INFORMACIÓN PERSONAL */}
<section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
  <div className="grid lg:grid-cols-[29%_71%]">

    {/* PERFIL INSTITUCIONAL */}
    <aside
      className="relative overflow-hidden bg-[#173253] p-5 text-white"
    >
      {/* LOGO */}
      <img
        src="/images/logo-iimp.png"
        alt="Instituto de Ingenieros de Minas del Perú"
        className="h-9 w-auto brightness-0 invert"
      />

      {/* PERFIL */}
      <div className="mt-4 flex items-center gap-4">

        {/* FOTO + CÁMARA */}
        <div
          className={`group relative shrink-0 ${edit ? "cursor-pointer" : ""}`}
          onClick={() => edit && fileInputRef.current?.click()}
        >
          <div
            className="grid h-20 w-20 place-items-center overflow-hidden rounded-full border-[3px] border-white/30 bg-[#f7f1e4] text-xl font-black text-[#9b7530] shadow-lg"
          >
            {profileImagePreview || p.identity.image ? (
              <img
                src={profileImagePreview ?? p.identity.image ?? ""}
                alt={p.identity.fullName}
                className="h-full w-full object-cover"
              />
            ) : (
              initials
            )}
            {edit && (
              <div className="absolute inset-0 flex flex-col items-center justify-center rounded-full bg-[#173253]/70 text-white opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                <Camera size={18} />
                <span className="mt-1 text-[10px] font-semibold">Cambiar foto</span>
              </div>
            )}
          </div>

          {/* BOTÓN CÁMARA VISUAL */}
          <button
            type="button"
            title="Actualizar fotografía"
            aria-label="Cambiar foto de perfil"
            disabled={!edit}
            onClick={(event) => { event.stopPropagation(); fileInputRef.current?.click(); }}
            className="absolute -bottom-1 -right-1 grid h-7 w-7 place-items-center rounded-full border-2 border-[#173253] bg-white text-[#173253] shadow-md transition hover:bg-[#f7f1e4]"
          >
            <Camera size={13} strokeWidth={2.2} />
          </button>
          <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleProfileImageChange} />
        </div>

        {/* DATOS PRINCIPALES */}
        <div className="min-w-0">
          <h2 className="line-clamp-2 break-words text-base font-black leading-tight tracking-tight">
            {p.identity.fullName}
          </h2>

          <p className="mt-0.5 text-sm text-white/85">
            {member}
          </p>

          <span
            className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-emerald-400/20 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-emerald-100"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
            {membershipStatusLabel(p.membership.status)}
          </span>
        </div>
      </div>

      {/* SEPARADOR */}
      <div className="my-4 h-px bg-white/15" />

      {/* CÓDIGO + MIEMBRO DESDE */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p
            className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/50"
          >
            Código
          </p>

          <p className="mt-1 text-sm font-normal text-white/90">
            {show(p.membership.code)}
          </p>
        </div>

        <div>
          <p
            className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/50"
          >
            Miembro desde
          </p>

          <p className="mt-1 text-sm font-normal text-white/90">
            {dateTime(p.membership.memberSince)}
          </p>
        </div>
      </div>

      {/* FRASE INSTITUCIONAL */}
      <blockquote className="relative mt-4 overflow-hidden rounded-xl border border-white/10 bg-white/[0.05] px-4 py-3 pl-10 text-white/80">
        <span aria-hidden="true" className="absolute left-3 top-1 font-serif text-[30px] font-black leading-none text-[#d5b77b]">
          “
        </span>
        <p className="text-[11px] italic leading-5">{PROFILE_CONTENT.heroMessage}</p>
      </blockquote>

      {/* DETALLE DORADO INFERIOR */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-12 -left-10 h-28 w-40 rounded-full bg-[#C5A059]/80 blur-[1px]"
      />
    </aside>

    {/* INFORMACIÓN PERSONAL */}
    <div className="relative p-5">

      {/* HEADER */}
      <div className="flex items-start justify-between gap-4">
        <h2
          className="flex items-center gap-2 font-extrabold text-[#172a45]"
        >
          <UserRound size={20} color={gold} />
          Información personal
        </h2>

        {/* DATOS VERIFICADOS */}
        <span
          className="inline-flex items-center gap-1.5 rounded-full border border-emerald-100 bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-700"
        >
          <BadgeCheck size={12} />
          Datos verificados
        </span>
      </div>

      {edit ? (
        <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          <label className="grid gap-1.5 text-[10px] font-bold uppercase tracking-[.13em] text-slate-400">
            Nombres
            <input
              type="text"
              value={d.firstName}
              onChange={(event) => setD({ ...d, firstName: event.target.value })}
              className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-normal normal-case tracking-normal text-slate-800 outline-none transition focus:border-[#b48a37] focus:ring-2 focus:ring-[#b48a37]/10"
            />
          </label>
          <label className="grid gap-1.5 text-[10px] font-bold uppercase tracking-[.13em] text-slate-400">
            Apellido paterno
            <input
              type="text"
              value={d.paternalLastName}
              onChange={(event) => setD({ ...d, paternalLastName: event.target.value })}
              className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-normal normal-case tracking-normal text-slate-800 outline-none transition focus:border-[#b48a37] focus:ring-2 focus:ring-[#b48a37]/10"
            />
          </label>
          <label className="grid gap-1.5 text-[10px] font-bold uppercase tracking-[.13em] text-slate-400">
            Apellido materno
            <input
              type="text"
              value={d.maternalLastName}
              onChange={(event) => setD({ ...d, maternalLastName: event.target.value })}
              className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-normal normal-case tracking-normal text-slate-800 outline-none transition focus:border-[#b48a37] focus:ring-2 focus:ring-[#b48a37]/10"
            />
          </label>
          <label className="grid gap-1.5 text-[10px] font-bold uppercase tracking-[.13em] text-slate-400">
            Tipo y número de documento
            <input
              type="text"
              disabled
              readOnly
              value={`${p.identity.documentType} ${p.identity.documentNumber}`}
              className="h-10 w-full cursor-not-allowed rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-normal normal-case tracking-normal text-slate-500 outline-none"
            />
          </label>
          <label className="grid gap-1.5 text-[10px] font-bold uppercase tracking-[.13em] text-slate-400">
            Fecha de nacimiento
            <input
              type="date"
              value={d.birthDate}
              onChange={(event) => setD({ ...d, birthDate: event.target.value })}
              className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-normal text-slate-800 outline-none transition focus:border-[#b48a37] focus:ring-2 focus:ring-[#b48a37]/10"
            />
          </label>
          <AppSelect
            label="Género"
            value={d.gender}
            options={genderOptions}
            onChange={(value) => setD({ ...d, gender: value })}
            placeholder="Seleccione"
          />
          <AppSelect
            label="Nacionalidad"
            value={d.nationalityId}
            options={countries.map((country) => ({ value: country.id, label: country.name }))}
            onChange={(value) => setD({ ...d, nationalityId: value })}
            placeholder="Seleccione"
            searchable
          />
        </div>
      ) : (
        <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {[
            ["Nombres", p.identity.firstName],
            ["Apellido paterno", p.identity.paternalLastName],
            ["Apellido materno", p.identity.maternalLastName],
            ["Tipo de documento", p.identity.documentType],
            ["Número de documento", p.identity.documentNumber],
            ["Fecha de nacimiento", date(p.identity.birthDate)],
            ["Género", genderLabel(p.identity.gender)],
            ["Nacionalidad", p.identity.nationality],
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2.5">
              <Read label={label} value={value} />
            </div>
          ))}
        </div>
      )}

      {/* FRASE DESTACADA */}
      <blockquote
        className="relative mt-4 overflow-hidden rounded-xl border border-[#efe5d5] bg-gradient-to-r from-[#fbf8f1] to-[#f8f4ec] px-5 py-4 pl-14 italic text-[#7b6241]"
      >
        {/* COMILLAS GRANDES */}
        <span
          aria-hidden="true"
          className="absolute left-4 top-1 font-serif text-[46px] font-black leading-none text-[#d5b77b]"
        >
          “
        </span>

        <p className="text-sm leading-6">
          {PROFILE_CONTENT.quote}
        </p>
      </blockquote>
    </div>
  </div>
</section>

     {/* CONTACTO + DIRECCIÓN */}
<Card title="Contacto y dirección" icon={<MapPin color={gold} />}>
  {edit ? (
    <div className="grid gap-4 lg:grid-cols-2">
      <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
        Celular
        <input
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          value={d.primaryPhone}
          onChange={(event) =>
            setD({
              ...d,
              primaryPhone: event.target.value,
            })
          }
          placeholder="Ej. 987 654 321"
          className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-[#b48a37] focus:ring-2 focus:ring-[#b48a37]/10"
        />
      </label>

      <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
        Correo secundario
        <input
          type="email"
          inputMode="email"
          autoComplete="email"
          value={d.secondaryEmail}
          onChange={(event) =>
            setD({
              ...d,
              secondaryEmail: event.target.value,
            })
          }
          placeholder="correo@ejemplo.com"
          className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-[#b48a37] focus:ring-2 focus:ring-[#b48a37]/10"
        />
      </label>

      <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
        Dirección
        <input
          type="text"
          autoComplete="street-address"
          value={d.street}
          onChange={(event) =>
            setD({
              ...d,
              street: event.target.value,
            })
          }
          placeholder="Ej. Av. Javier Prado 123"
          className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-[#b48a37] focus:ring-2 focus:ring-[#b48a37]/10"
        />
      </label>

      <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
        Referencia
        <input
          type="text"
          value={d.reference}
          onChange={(event) =>
            setD({
              ...d,
              reference: event.target.value,
            })
          }
          placeholder="Ej. Frente al parque principal"
          className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-[#b48a37] focus:ring-2 focus:ring-[#b48a37]/10"
        />
      </label>

      {opts("País", d.countryId, countries, (value) =>
        setD({
          ...d,
          countryId: value,
          departmentId: "",
          provinceId: "",
          districtId: "",
        }),
      )}

      {opts(
        "Departamento",
        d.departmentId,
        departments,
        (value) =>
          setD({
            ...d,
            departmentId: value,
            provinceId: "",
            districtId: "",
          }),
        !d.countryId,
      )}

      {opts(
        "Provincia",
        d.provinceId,
        provinces,
        (value) =>
          setD({
            ...d,
            provinceId: value,
            districtId: "",
          }),
        !d.departmentId,
      )}

      {opts(
        "Distrito",
        d.districtId,
        districts,
        (value) =>
          setD({
            ...d,
            districtId: value,
          }),
        !d.provinceId,
      )}
    </div>
  ) : (
    <div className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
      {[
        ["Correo principal", p.contact.primaryEmail],
        ["Correo secundario", p.contact.secondaryEmail],
        ["Celular", p.contact.primaryPhone],
        ["Dirección", p.address.street],
        ["Referencia", p.address.reference],
        ["País", p.address.country],
        ["Departamento", p.address.department],
        ["Provincia", p.address.province],
        ["Distrito", p.address.district],
      ].map(([label, value]) => (
        <Read key={label} label={label} value={value} />
      ))}
    </div>
  )}
</Card>
      {/* INFORMACIÓN COMPLEMENTARIA */}

      <div className="grid gap-3 xl:grid-cols-2">
        {/* INFORMACIÓN LABORAL */}
        {!isStudent && (
          <Card
            title="Información laboral"
            icon={<BriefcaseBusiness color={gold} />}
          >
            {employmentOpen ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-1 text-sm font-semibold text-slate-700">Empresa<select value={employment.companyId} onChange={(event) => setEmployment({ ...employment, companyId: event.target.value })} className="h-10 rounded-lg border border-slate-200 px-3 text-sm"><option value="">Seleccione</option>{employmentCatalog.companies.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
                <label className="grid gap-1 text-sm font-semibold text-slate-700">Cargo<select value={employment.positionId} onChange={(event) => setEmployment({ ...employment, positionId: event.target.value })} className="h-10 rounded-lg border border-slate-200 px-3 text-sm"><option value="">No registrado</option>{employmentCatalog.positions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
                <label className="grid gap-1 text-sm font-semibold text-slate-700">Área<input value={employment.area} onChange={(event) => setEmployment({ ...employment, area: event.target.value })} className="h-10 rounded-lg border border-slate-200 px-3 text-sm" /></label>
                <label className="grid gap-1 text-sm font-semibold text-slate-700">Teléfono laboral<input value={employment.workPhone} onChange={(event) => setEmployment({ ...employment, workPhone: event.target.value })} className="h-10 rounded-lg border border-slate-200 px-3 text-sm" /></label>
                <label className="grid gap-1 text-sm font-semibold text-slate-700 sm:col-span-2">Dirección laboral<input value={employment.workingAddress} onChange={(event) => setEmployment({ ...employment, workingAddress: event.target.value })} className="h-10 rounded-lg border border-slate-200 px-3 text-sm" /></label>
                {employmentError && <p role="alert" className="text-sm font-semibold text-red-700 sm:col-span-2">{employmentError}</p>}
                <div className="flex justify-end gap-2 sm:col-span-2"><button type="button" onClick={() => setEmploymentOpen(false)} className="rounded-lg px-3 py-2 text-xs font-bold text-slate-600">Cancelar</button><button type="button" disabled={employmentSaving || !employment.companyId} onClick={() => void saveEmployment()} className="rounded-lg bg-[#172a45] px-3 py-2 text-xs font-bold text-white disabled:opacity-60">{employmentSaving ? "Guardando..." : "Guardar"}</button></div>
              </div>
            ) : p.professional ? (
              <><button type="button" onClick={openEmployment} className="float-right -mt-12 inline-flex items-center gap-1 text-xs font-bold text-[#9b7530] hover:text-[#7f5f25]"><Pencil size={14} />Editar</button><div className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
                {[
                  ["Empresa", p.professional.company],
                  ["RUC", p.professional.companyTaxId],
                  ["Cargo", p.professional.position],
                  ["Área", p.professional.area],
                  ["Sector", p.professional.companySector],
                  ["Actividad", p.professional.companyIndustry],
                  ["Correo laboral", p.professional.workEmail],
                  ["Teléfono laboral", p.professional.workPhone],
                  ["Anexo laboral", p.professional.workExtension],
                  ["Dirección laboral", p.professional.workingAddress],
                  ["Correo de empresa", p.professional.companyEmail],
                  ["Teléfono de empresa", p.professional.companyPhone],
                  ["Dirección de empresa", p.professional.companyAddress],
                ].map(([label, value]) => (
                  <Read key={label} label={label} value={value} />
                ))}
              </div></>
            ) : (
              <div><p className="text-sm text-slate-600">Aún no has registrado información laboral.</p><p className="mt-1 text-xs leading-5 text-slate-500">Mantén actualizada tu situación profesional desde aquí.</p><button type="button" onClick={openEmployment} className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-[#dec28b] px-3 py-2 text-xs font-bold text-[#8a6828] transition hover:bg-[#fcfaf5]"><Plus size={14} />Agregar información laboral</button></div>
            )}
          </Card>
        )}

        {/* ACADÉMICA */}
        <div className={isStudent ? "xl:col-span-2" : undefined}>
          <Card title="Formación académica" icon={<GraduationCap color={gold} />}>
            {p.academic.length ? (
              <ol className="border-l border-[#ead9b9] pl-5">
                {p.academic.map((academic, index) => (
                  <li key={index} className="relative pb-4 last:pb-0">
                    <span
                      className="absolute -left-[24px] top-1.5 h-2 w-2 rounded-full bg-[#b48a37]"
                    />

                    <b className="text-sm text-[#172a45]">
                      {show(academic.university)}
                    </b>

                    <p className="mt-1 text-sm text-slate-500">
                      {[academic.specialty, academic.degree]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-sm text-slate-500">
                Aún no has registrado formación académica.
              </p>
            )}
          </Card>
        </div>

        {/* MEMBRESÍA */}
        <Card title="Mi membresía" icon={<ShieldCheck color={gold} />} tone="membership">
          <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
            <Read label="Tipo" value={member} />

            <div>
              <p className="text-[10px] font-bold uppercase tracking-[.13em] text-slate-400">Estado</p>
              <span className="mt-1 inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-800">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
                {membershipStatusLabel(p.membership.status)}
              </span>
            </div>

            <Read label="Código" value={p.membership.code} />

            <Read
              label="Fecha de ingreso"
              value={dateTime(p.membership.memberSince)}
            />
          </div>

          <Link
            href="/intranet/mi-cuenta/membresia"
            className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-[#9b7530] transition hover:text-[#7f5f25]"
          >
            Ver detalle de membresía
            <ChevronRight size={16} />
          </Link>
        </Card>

        {/* SEGURIDAD */}
        <Card title="Cuenta y seguridad" icon={<LockKeyhole color={gold} />}>
          <div className="grid gap-4">
            <Read label="Correo de acceso" value={p.account.email} />

            <Read label="Último acceso" value={dateTime(p.account.lastLoginAt)} />

            <Read
              label="Última actualización"
              value={dateTime(p.membership.updatedAt)}
            />
          </div>
        </Card>
      </div>
    </main>
  );
}
