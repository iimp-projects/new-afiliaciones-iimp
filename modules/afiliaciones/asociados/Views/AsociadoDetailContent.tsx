"use client";

import { UserCircle, MapPin, Briefcase, GraduationCap, Phone, Mail } from "lucide-react";

export function AsociadoDetailContent({ tab, user }: { tab: string; user: any }) {
  if (tab !== "profile") {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-slate-400">
        <p className="font-bold">El contenido de esta pestaña está en construcción.</p>
      </div>
    );
  }

  const person = user.person;
  const address = person?.addresses?.[0];
  const academic = person?.academicInfos?.[0];
  const employment = person?.employmentInfos?.[0];

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* 1. Datos Personales */}
      <section className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <h3 className="text-sm font-black text-[#C5A059] uppercase tracking-widest mb-4 flex items-center gap-2">
          <UserCircle size={18} /> Información Personal
        </h3>
        <div className="grid grid-cols-2 gap-y-4 gap-x-6">
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Documento</p>
            <p className="text-sm font-bold text-slate-700">{person?.documentType} {person?.documentNumber}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Fecha Nacimiento</p>
            <p className="text-sm font-bold text-slate-700">
              {person?.birthDate ? new Date(person.birthDate).toLocaleDateString('es-PE') : "No registrado"}
            </p>
          </div>
          <div className="col-span-2">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Nacionalidad</p>
            <p className="text-sm font-bold text-slate-700">{person?.nationality?.name || "Perú"}</p>
          </div>
        </div>
      </section>

      {/* 2. Contacto y Ubicación */}
      <section className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <h3 className="text-sm font-black text-[#C5A059] uppercase tracking-widest mb-4 flex items-center gap-2">
          <MapPin size={18} /> Contacto y Ubicación
        </h3>
        <div className="grid grid-cols-2 gap-y-4 gap-x-6">
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Correo Principal</p>
            <p className="text-sm font-bold text-slate-700 flex items-center gap-2">
              <Mail size={14} className="text-slate-400" /> {user.email}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Teléfono</p>
            <p className="text-sm font-bold text-slate-700 flex items-center gap-2">
              <Phone size={14} className="text-slate-400" /> {person?.contacts?.[0]?.phoneNumber || "No registrado"}
            </p>
          </div>
          <div className="col-span-2">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Dirección Registrada</p>
            <p className="text-sm font-bold text-slate-700">
              {address ? `${address.street}, ${address.district?.name}, ${address.district?.province?.name}` : "No registrada"}
            </p>
          </div>
        </div>
      </section>

      {/* 3. Formación Académica */}
      {academic && (
        <section className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h3 className="text-sm font-black text-[#C5A059] uppercase tracking-widest mb-4 flex items-center gap-2">
            <GraduationCap size={18} /> Formación Académica
          </h3>
          <div className="grid grid-cols-2 gap-y-4 gap-x-6">
            <div className="col-span-2">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Institución</p>
              <p className="text-sm font-bold text-slate-700">{academic.university?.name || "Otra Institución"}</p>
            </div>
            <div className="col-span-2">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Especialidad</p>
              <p className="text-sm font-bold text-slate-700">{academic.specialty?.name || "Ingeniería de Minas"}</p>
            </div>
          </div>
        </section>
      )}

      {/* 4. Empleo Actual */}
      {employment && (
        <section className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h3 className="text-sm font-black text-[#C5A059] uppercase tracking-widest mb-4 flex items-center gap-2">
            <Briefcase size={18} /> Empleo Actual
          </h3>
          <div className="grid grid-cols-2 gap-y-4 gap-x-6">
            <div className="col-span-2">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Empresa</p>
              <p className="text-sm font-bold text-slate-700">{employment.company?.name || "Profesional Independiente"}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Cargo</p>
              <p className="text-sm font-bold text-slate-700">{employment.position?.name || "Asesor / Consultor"}</p>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}