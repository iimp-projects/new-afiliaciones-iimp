"use client";

import { Camera, CheckCircle2, LoaderCircle, Mail, Phone, ShieldCheck, UserRound } from "lucide-react";
import { ChangeEvent, useEffect, useState } from "react";

type Profile = {
  personal: { firstName: string; paternalLastName: string; maternalLastName: string | null; documentType: string; documentNumber: string; avatarUrl: string | null };
  contact: { email: string; phone: string | null };
  account: { roleName: string; roleSlug: string; status: string };
};

const label = (value: string) => value.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());

function Detail({ label: title, value }: { label: string; value: string | null }) {
  return <div><p className="text-xs font-bold uppercase tracking-wide text-slate-400">{title}</p><p className="mt-1 text-sm font-semibold text-slate-700 break-words">{value || "No registrado"}</p></div>;
}

export function InternalProfileView() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [phone, setPhone] = useState("");
  const [avatar, setAvatar] = useState<File | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadProfile() {
    setLoading(true);
    try {
      const response = await fetch("/api/mi-perfil", { cache: "no-store" });
      const body = await response.json();
      if (!response.ok || !body.success) throw new Error(body.message || "No pudimos cargar tu perfil.");
      setProfile(body.data);
      setPhone(body.data.contact.phone || "");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No pudimos cargar tu perfil.");
    } finally { setLoading(false); }
  }

  useEffect(() => { void loadProfile(); }, []);

  function changeAvatar(event: ChangeEvent<HTMLInputElement>) {
    setAvatar(event.target.files?.[0] ?? null);
    setMessage(null);
  }

  async function save() {
    setSaving(true); setError(null); setMessage(null);
    try {
      const formData = new FormData();
      formData.set("phone", phone);
      if (avatar) formData.set("avatar", avatar);
      const response = await fetch("/api/mi-perfil", { method: "PATCH", body: formData });
      const body = await response.json();
      if (!response.ok || !body.success) throw new Error(body.message || "No pudimos guardar tus cambios.");
      setProfile(body.data); setPhone(body.data.contact.phone || ""); setAvatar(null); setIsEditing(false);
      setMessage("Tu información fue actualizada correctamente.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "No pudimos guardar tus cambios."); }
    finally { setSaving(false); }
  }

  if (loading) return <div className="flex min-h-[50vh] items-center justify-center text-slate-500"><LoaderCircle className="mr-2 animate-spin" size={20} /> Cargando perfil…</div>;
  if (!profile) return <div className="rounded-xl border border-red-100 bg-red-50 p-5 text-sm font-semibold text-red-700">{error || "No fue posible cargar el perfil."}</div>;

  const fullName = [profile.personal.firstName, profile.personal.paternalLastName, profile.personal.maternalLastName].filter(Boolean).join(" ");
  const initials = `${profile.personal.firstName[0] || ""}${profile.personal.paternalLastName[0] || ""}`.toUpperCase();

  return <div className="mx-auto w-full max-w-5xl space-y-6 pb-8">
    <header><h1 className="text-2xl font-black tracking-tight text-slate-800">Mi perfil</h1><p className="mt-1 text-sm text-slate-500">Administra tu información personal y datos de contacto.</p></header>
    {(message || error) && <div className={`flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold ${error ? "border-red-100 bg-red-50 text-red-700" : "border-emerald-100 bg-emerald-50 text-emerald-700"}`}><CheckCircle2 size={18} />{error || message}</div>}

    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-[#c39254] bg-slate-100 text-lg font-black text-[#7f561e]">
            {profile.personal.avatarUrl ? <img src={profile.personal.avatarUrl} alt="Foto de perfil" className="h-full w-full object-cover" /> : initials}
          </div>
          <div><h2 className="text-xl font-black text-slate-800">{fullName}</h2><p className="mt-1 text-sm font-bold text-[#1d4f7a]">{profile.account.roleName}</p><p className="mt-1 text-sm text-slate-500">{profile.contact.email}</p></div>
        </div>
        <span className="inline-flex w-fit rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">Cuenta {label(profile.account.status)}</span>
      </div>
    </section>

    <section className="grid gap-6 lg:grid-cols-2">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="mb-5 flex items-center gap-2 text-slate-800"><UserRound size={19} className="text-[#c39254]" /><h2 className="font-black">Datos personales</h2></div><div className="grid gap-5 sm:grid-cols-2"><Detail label="Nombres" value={profile.personal.firstName} /><Detail label="Apellido paterno" value={profile.personal.paternalLastName} /><Detail label="Apellido materno" value={profile.personal.maternalLastName} /><Detail label="Tipo de documento" value={label(profile.personal.documentType)} /><Detail label="Número de documento" value={profile.personal.documentNumber} /></div></div>
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="mb-5 flex items-center gap-2 text-slate-800"><ShieldCheck size={19} className="text-[#c39254]" /><h2 className="font-black">Información de cuenta</h2></div><div className="grid gap-5"><Detail label="Rol" value={profile.account.roleName} /><Detail label="Estado de cuenta" value={label(profile.account.status)} /></div></div>
    </section>

    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="mb-5 flex items-center justify-between gap-3"><div className="flex items-center gap-2 text-slate-800"><Phone size={19} className="text-[#c39254]" /><h2 className="font-black">Datos de contacto</h2></div>{!isEditing && <button onClick={() => { setIsEditing(true); setError(null); setMessage(null); }} className="text-sm font-bold text-[#1d4f7a] hover:underline">Editar</button>}</div>
      <div className="grid gap-5 md:grid-cols-2"><Detail label="Correo institucional" value={profile.contact.email} />
        <div><p className="text-xs font-bold uppercase tracking-wide text-slate-400">Teléfono</p>{isEditing ? <input value={phone} onChange={(event) => setPhone(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 outline-none focus:border-[#1d4f7a]" aria-label="Teléfono" /> : <p className="mt-1 text-sm font-semibold text-slate-700">{profile.contact.phone || "No registrado"}</p>}</div></div>
      {isEditing && <div className="mt-6 border-t border-slate-100 pt-5"><label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"><Camera size={16} />Cambiar foto<input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={changeAvatar} /></label>{avatar && <p className="mt-2 text-xs font-medium text-slate-500">Nueva foto: {avatar.name}</p>}<div className="mt-5 flex gap-3"><button onClick={save} disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-[#1d4f7a] px-4 py-2 text-sm font-bold text-white disabled:opacity-60">{saving && <LoaderCircle size={16} className="animate-spin" />}{saving ? "Guardando…" : "Guardar cambios"}</button><button onClick={() => { setIsEditing(false); setPhone(profile.contact.phone || ""); setAvatar(null); setError(null); }} disabled={saving} className="rounded-lg px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100">Cancelar</button></div></div>}
    </section>
    <p className="flex items-center gap-2 text-xs text-slate-400"><Mail size={14} />Los datos institucionales y de identidad se administran por los canales autorizados.</p>
  </div>;
}
