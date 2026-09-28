"use client";

import { Camera, CheckCircle2, Mail, Pencil, Phone, ShieldCheck, UserRound, X } from "lucide-react";
import { type ChangeEvent, useEffect, useState } from "react";
import { ProfileCard, ProfileReadField } from "@/modules/shared/Components/Profile/ProfilePresentation";

type Profile = {
  personal: { firstName: string; paternalLastName: string; maternalLastName: string | null; documentType: string; documentNumber: string; avatarUrl: string | null };
  contact: { email: string; phone: string | null };
  account: { roleName: string; roleSlug: string; status: string };
};

const label = (value: string) => value.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());

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
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadProfile(); }, []);

  function changeAvatar(event: ChangeEvent<HTMLInputElement>) {
    setAvatar(event.target.files?.[0] ?? null);
    setMessage(null);
  }

  function cancelEdit() {
    setIsEditing(false);
    setPhone(profile?.contact.phone || "");
    setAvatar(null);
    setError(null);
    setMessage(null);
  }

  async function save() {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const formData = new FormData();
      formData.set("phone", phone);
      if (avatar) formData.set("avatar", avatar);
      const response = await fetch("/api/mi-perfil", { method: "PATCH", body: formData });
      const body = await response.json();
      if (!response.ok || !body.success) throw new Error(body.message || "No pudimos guardar tus cambios.");
      setProfile(body.data);
      setPhone(body.data.contact.phone || "");
      setAvatar(null);
      setIsEditing(false);
      setMessage("Tu información fue actualizada correctamente.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No pudimos guardar tus cambios.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div aria-label="Cargando perfil" className="h-64 animate-pulse rounded-2xl bg-slate-100" />;
  if (!profile) return <p role="alert" className="text-sm font-semibold text-red-700">{error || "No fue posible cargar el perfil."}</p>;

  const fullName = [profile.personal.firstName, profile.personal.paternalLastName, profile.personal.maternalLastName].filter(Boolean).join(" ");
  const initials = `${profile.personal.firstName[0] || ""}${profile.personal.paternalLastName[0] || ""}`.toUpperCase();

  return (
    <main className="w-full space-y-3 pb-8">
      <header className="relative h-[150px] w-full overflow-hidden">
        <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-0 w-[82%] overflow-hidden [mask-image:linear-gradient(to_right,transparent_0%,black_15%,black_100%)] [-webkit-mask-image:linear-gradient(to_right,transparent_0%,black_15%,black_100%)]">
          <img src="/images/iimp/fondo-asociado-hero.png" alt="" className="absolute inset-0 h-full w-full object-cover object-[center_52%]" />
          <div className="absolute inset-0 bg-[#C5A059]/16" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#F8F4EC]/10 via-[#C5A059]/5 to-[#9A742E]/10" />
        </div>
        <div className="relative z-20 flex h-full max-w-[460px] flex-col justify-center px-4 lg:px-5">
          <p className="text-sm font-bold text-[#a67c00]">Mi cuenta</p>
          <h1 className="mt-0.5 text-3xl font-black tracking-tight text-[#172a45]">Mi perfil</h1>
          <p className="mt-1 text-sm text-slate-600">Mantén actualizada tu información personal y de contacto.</p>
        </div>
        <div className="absolute right-5 top-1/2 z-30 -translate-y-1/2 lg:right-6">
          {isEditing ? <div className="flex items-center gap-2">
            <button type="button" onClick={cancelEdit} disabled={saving} className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white/95 px-4 text-sm font-semibold text-[#172a45] shadow-sm backdrop-blur-sm transition hover:border-slate-300 hover:bg-white"><X size={16} />Cancelar</button>
            <button type="button" onClick={() => void save()} disabled={saving} className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#172a45] bg-[#172a45] px-4 text-sm font-bold text-white shadow-md transition hover:border-[#102038] hover:bg-[#102038] disabled:cursor-not-allowed disabled:opacity-60"><CheckCircle2 size={16} />{saving ? "Guardando..." : "Guardar cambios"}</button>
          </div> : <button type="button" onClick={() => { setIsEditing(true); setError(null); setMessage(null); }} className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#172a45] bg-[#172a45] px-4 text-sm font-bold text-white shadow-md transition hover:border-[#102038] hover:bg-[#102038] hover:shadow-lg"><Pencil size={16} />Editar perfil</button>}
        </div>
        {message && <p role="status" className="absolute bottom-2 left-4 z-30 rounded-lg bg-emerald-50/90 px-3 py-1.5 text-xs font-semibold text-emerald-700 shadow-sm">{message}</p>}
        {error && <p role="alert" className="absolute bottom-2 left-4 z-30 rounded-lg bg-red-50/90 px-3 py-1.5 text-xs font-semibold text-red-700 shadow-sm">{error}</p>}
      </header>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="grid lg:grid-cols-[29%_71%]">
          <aside className="relative overflow-hidden bg-[#173253] p-5 text-white">
            <img src="/images/logo-iimp.png" alt="Instituto de Ingenieros de Minas del Perú" className="h-9 w-auto brightness-0 invert" />
            <div className="mt-4 flex items-center gap-4">
              <label className={`group relative shrink-0 ${isEditing ? "cursor-pointer" : ""}`}>
                <div className="grid h-20 w-20 place-items-center overflow-hidden rounded-full border-[3px] border-white/30 bg-[#f7f1e4] text-xl font-black text-[#9b7530] shadow-lg">
                  {profile.personal.avatarUrl ? <img src={profile.personal.avatarUrl} alt={fullName} className="h-full w-full object-cover" /> : initials}
                  {isEditing && <div className="absolute inset-0 flex flex-col items-center justify-center rounded-full bg-[#173253]/70 text-white opacity-0 transition-opacity duration-200 group-hover:opacity-100"><Camera size={18} /><span className="mt-1 text-[10px] font-semibold">Cambiar foto</span></div>}
                </div>
                {isEditing && <><span className="absolute -bottom-1 -right-1 grid h-7 w-7 place-items-center rounded-full border-2 border-[#173253] bg-white text-[#173253] shadow-md"><Camera size={13} strokeWidth={2.2} /></span><input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={changeAvatar} /></>}
              </label>
              <div className="min-w-0"><h2 className="line-clamp-2 break-words text-base font-black leading-tight tracking-tight">{fullName}</h2><p className="mt-0.5 text-sm text-white/85">{profile.account.roleName}</p><span className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-emerald-400/20 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-emerald-100"><span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />Cuenta {label(profile.account.status)}</span></div>
            </div>
            <div className="my-4 h-px bg-white/15" />
            <div className="grid grid-cols-2 gap-4"><div><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/50">Documento</p><p className="mt-1 text-sm font-normal text-white/90">{profile.personal.documentNumber}</p></div><div><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/50">Correo</p><p className="mt-1 break-words text-sm font-normal text-white/90">{profile.contact.email}</p></div></div>
            <blockquote className="relative mt-4 overflow-hidden rounded-xl border border-white/10 bg-white/[0.05] px-4 py-3 pl-10 text-white/80"><span aria-hidden="true" className="absolute left-3 top-1 font-serif text-[30px] font-black leading-none text-[#d5b77b]">“</span><p className="text-[11px] italic leading-5">Los datos institucionales se administran por los canales autorizados.</p></blockquote>
            <div aria-hidden="true" className="pointer-events-none absolute -bottom-12 -left-10 h-28 w-40 rounded-full bg-[#C5A059]/80 blur-[1px]" />
          </aside>

          <div className="relative p-5"><h2 className="flex items-center gap-2 font-extrabold text-[#172a45]"><UserRound size={20} color="#b48a37" />Información personal</h2><div className="mt-5 grid gap-5 sm:grid-cols-2"><ProfileReadField label="Nombres" value={profile.personal.firstName} /><ProfileReadField label="Apellido paterno" value={profile.personal.paternalLastName} /><ProfileReadField label="Apellido materno" value={profile.personal.maternalLastName} /><ProfileReadField label="Tipo de documento" value={label(profile.personal.documentType)} /><ProfileReadField label="Número de documento" value={profile.personal.documentNumber} /></div></div>
        </div>
      </section>

      <section className="grid gap-3 lg:grid-cols-2">
        <ProfileCard title="Contacto" icon={<Phone color="#b48a37" />}><div className="grid gap-5 md:grid-cols-2"><ProfileReadField label="Correo institucional" value={profile.contact.email} /><div><p className="text-[10px] font-bold uppercase tracking-[.13em] text-slate-400">Teléfono</p>{isEditing ? <input value={phone} onChange={(event) => setPhone(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-[#172a45] outline-none focus:border-[#172a45]" aria-label="Teléfono" /> : <p className="mt-1 text-sm font-semibold text-[#172a45]">{profile.contact.phone || "No registrado"}</p>}{isEditing && avatar && <p className="mt-2 text-xs font-medium text-slate-500">Nueva foto: {avatar.name}</p>}</div></div></ProfileCard>
        <ProfileCard title="Cuenta y seguridad" icon={<ShieldCheck color="#b48a37" />}><div className="grid gap-5"><ProfileReadField label="Rol" value={profile.account.roleName} /><ProfileReadField label="Estado de cuenta" value={label(profile.account.status)} /></div></ProfileCard>
      </section>
      <p className="flex items-center gap-2 px-1 text-xs text-slate-400"><Mail size={14} />Solo el teléfono y la foto de perfil pueden editarse desde esta pantalla.</p>
    </main>
  );
}
