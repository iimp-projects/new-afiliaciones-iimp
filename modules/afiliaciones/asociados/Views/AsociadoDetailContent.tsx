"use client";

import React from "react";
import { UserCircle, MapPin, Briefcase, GraduationCap, Activity, ShieldCheck, Mail, Phone } from "lucide-react";

// Componente para estandarizar los campos de datos (Igual a Expedientes)
const DataField = ({ label, value, fullWidth = false }: { label: string; value: any; fullWidth?: boolean }) => (
  <div className={`flex flex-col gap-1 ${fullWidth ? "sm:col-span-2 lg:col-span-3" : ""}`}>
    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{label}</span>
    <span className="text-[13px] font-semibold text-slate-800">
      {value || <span className="text-slate-300 italic font-medium">No registrado</span>}
    </span>
  </div>
);

export function AsociadoDetailContent({ tab, user }: { tab: string; user: any }) {
  const person = user.person || {};
  const address = person.addresses?.[0];
  const academic = person.academicInfos?.[0];
  const employment = person.employmentInfos?.[0];

  // ==========================================
  // PESTAÑA: RESUMEN GENERAL
  // ==========================================
  if (tab === "resumen") {
    return (
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="bg-slate-50 px-5 py-4 border-b border-slate-200 flex items-center gap-3">
            <Activity size={18} className="text-[#C5A059]" />
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-wide">Estado Institucional</h3>
          </div>
          <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-6">
            <DataField label="Membresía" value={user.role?.name || "Asociado"} />
            <DataField label="Fecha de Inscripción" value={new Date(user.createdAt).toLocaleDateString('es-PE')} />
            <DataField label="Código de Asociado" value={person.documentNumber} />
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Situación Actual</span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 w-max text-[10px] font-bold uppercase tracking-widest">
                <ShieldCheck size={14} /> HÁBIL
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // PESTAÑA: DATOS PERSONALES
  // ==========================================
  if (tab === "personal") {
    const fullName = `${person.firstName || ""} ${person.paternalLastName || ""} ${person.maternalLastName || ""}`.trim();
    const fullAddress = address ? `${address.street}, ${address.district?.name || ""}, ${address.district?.province?.name || ""}` : null;
    
    return (
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="bg-slate-50 px-5 py-4 border-b border-slate-200 flex items-center gap-3">
            <UserCircle size={18} className="text-[#C5A059]" />
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-wide">Identidad y Contacto</h3>
          </div>
          <div className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <DataField label="Nombres y Apellidos" value={fullName} fullWidth />
            <DataField label={`Documento (${person.documentType || "DNI"})`} value={person.documentNumber} />
            <DataField label="Fecha Nacimiento" value={person.birthDate ? new Date(person.birthDate).toLocaleDateString('es-PE') : null} />
            <DataField label="Nacionalidad" value={person.nationality?.name || "Perú"} />
            
            <div className="col-span-1 sm:col-span-2 lg:col-span-3 pt-4 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-6 mt-2">
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Correo Principal</span>
                <span className="text-[13px] font-semibold text-slate-800 flex items-center gap-2"><Mail size={14} className="text-slate-400" /> {user.email}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Teléfono</span>
                <span className="text-[13px] font-semibold text-slate-800 flex items-center gap-2"><Phone size={14} className="text-slate-400" /> {person.contacts?.[0]?.phoneNumber || "No registrado"}</span>
              </div>
              <DataField label="Dirección de Residencia" value={fullAddress} fullWidth />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // PESTAÑA: FORMACIÓN ACADÉMICA
  // ==========================================
  if (tab === "academico") {
    return (
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="bg-slate-50 px-5 py-4 border-b border-slate-200 flex items-center gap-3">
            <GraduationCap size={18} className="text-[#C5A059]" />
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-wide">Estudios Superiores</h3>
          </div>
          <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-6">
            <DataField label="Universidad / Institución" value={academic?.university?.name || "No registrado"} fullWidth />
            <DataField label="Grado / Título" value={academic?.degreeTitle} />
            <DataField label="Especialidad" value={academic?.specialty?.name || "Ingeniería de Minas"} />
            <DataField label="Año de Egreso" value={academic?.graduationYear} />
            {academic?.professionalAssociation && (
               <DataField label="Colegio Profesional" value={`${academic.professionalAssociation} (CIP: ${academic.licenseNumber || "S/N"})`} fullWidth />
            )}
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // PESTAÑA: EXPERIENCIA LABORAL
  // ==========================================
  if (tab === "laboral") {
    return (
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="bg-slate-50 px-5 py-4 border-b border-slate-200 flex items-center gap-3">
            <Briefcase size={18} className="text-[#C5A059]" />
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-wide">Empleo Actual</h3>
          </div>
          <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-6">
            <DataField label="Empresa / Institución" value={employment?.company?.name || "No registrado"} fullWidth />
            <DataField label="Cargo" value={employment?.position?.name} />
            <DataField label="Área / Departamento" value={employment?.area} />
            <DataField label="Correo Corporativo" value={employment?.workEmail} />
            <DataField label="Teléfono Trabajo" value={employment?.workPhone} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center p-12 text-slate-400 bg-white rounded-2xl border border-slate-200 border-dashed animate-in fade-in duration-300">
      <p className="font-bold">No hay información disponible.</p>
    </div>
  );
}