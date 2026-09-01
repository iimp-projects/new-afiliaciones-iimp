import React, { useState } from "react";
import {
  User,
  GraduationCap,
  Briefcase,
  Users,
  Copy,
  Check,
  ExternalLink,
} from "lucide-react";

import { DataField } from "../../../Utils/expedientes.utils";

// ============================================================
// MINI-COMPONENTE PARA EL BOTÓN DE COPIAR (Independiente)
// ============================================================
const BotonCopiar = ({ texto }: { texto: string }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!texto) return;
    try {
      await navigator.clipboard.writeText(texto);
      setCopied(true);
      // Desaparece el mensaje después de 2 segundos
      setTimeout(() => setCopied(false), 2000); 
    } catch (err) {
      console.error("Error al copiar: ", err);
    }
  };

  return (
    <button
      onClick={handleCopy}
      className="relative p-1 text-slate-400 hover:bg-slate-100 hover:text-[#C5A059] rounded transition-colors focus:outline-none"
      title="Copiar texto"
    >
      {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
      {copied && (
        <span className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[10px] font-bold px-2.5 py-1 rounded-md shadow-lg whitespace-nowrap animate-in fade-in slide-in-from-bottom-1 z-50">
          ¡Copiado!
        </span>
      )}
    </button>
  );
};

// ============================================================
// COMPONENTE PRINCIPAL
// ============================================================

interface DatosTabProps {
  payload: any;
}

export function DatosTab({ payload }: DatosTabProps) {
  const draft = payload.draftData || {};
  const personalInfo = draft.personalInformation || {};
  const academicStudy = draft.academicStudies?.[0] || {};
  const employmentInfo = draft.employmentInformation || {};
  const endorsements = draft.endorsements || {};
  const approvals = payload.approvals || [];
  const isStudent = payload.affiliateType === "STUDENT";

  // Función para agrupar enlaces y el botón de copiar
  const renderConAcciones = (
    text: string | null | undefined,
    opciones?: { copiar?: boolean; link?: string }
  ) => {
    if (!text) return <span className="text-slate-400 font-normal">No registrado</span>;

    return (
      <div className="flex items-center gap-2">
        {opciones?.link ? (
          <a
            href={opciones.link}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1 font-medium transition-colors"
            title="Abrir enlace externo"
          >
            {text}
            <ExternalLink size={14} className="shrink-0" />
          </a>
        ) : (
          <span>{text}</span>
        )}

        {opciones?.copiar && <BotonCopiar texto={text} />}
      </div>
    );
  };

  const rawNames = `${personalInfo.names || payload.person?.firstName || ""} ${
    personalInfo.fatherLastName || payload.person?.paternalLastName || ""
  } ${
    personalInfo.motherLastName || payload.person?.maternalLastName || ""
  }`.trim();

  const generoLabel =
    personalInfo.gender === "MALE"
      ? "Masculino"
      : personalInfo.gender === "FEMALE"
      ? "Femenino"
      : personalInfo.gender;

  const universidadName =
    academicStudy.otherInstitution ||
    payload.person?.academicInfos?.[0]?.university?.name ||
    (academicStudy.institutionId ? "Institución Registrada" : "");

  const paisName = personalInfo.resolvedCountry || "No registrado";
  const paisCode = personalInfo.resolvedCountryCode?.toString().trim().toLowerCase() || null;
  const paisFlagUrl = paisCode ? `https://flagcdn.com/w80/${paisCode}.png` : null;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300 pb-10">
      
      {/* DATOS PERSONALES */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="bg-slate-50 px-5 py-4 border-b border-slate-200 flex items-center gap-3">
          <User size={18} className="text-slate-600" />
          <h3 className="text-sm font-black text-slate-800 uppercase tracking-wide">
            Datos Personales
          </h3>
        </div>

        <div className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <DataField label="Nombres y Apellidos" value={rawNames} fullWidth />

          <DataField
            label={`Documento (${payload.documentType || "DNI"})`}
            value={renderConAcciones(payload.documentNumber, {
              copiar: true,
              link: payload.documentType === "DNI" || !payload.documentType 
                ? "https://serviciosportal.reniec.gob.pe/cetdnipi/inicio.htm" 
                : undefined,
            })}
          />

          <div className="hidden lg:block" />

          <DataField label="Fecha Nacimiento" value={personalInfo.birthDate} />
          <DataField label="Género" value={generoLabel} />

          <div className="hidden lg:block" />

          <DataField
            label="Correo Principal"
            value={renderConAcciones(personalInfo.primaryEmail || payload.email, { copiar: true })}
          />

          <DataField
            label="Correo Secundario"
            value={renderConAcciones(personalInfo.secondaryEmail, { copiar: true })}
          />

          <div className="hidden lg:block" />

          <DataField
            label="Celular"
            value={renderConAcciones(personalInfo.phone || payload.phone, { copiar: true })}
          />

          <DataField label="Teléfono Fijo" value={personalInfo.landline} />

          <div className="hidden lg:block" />

          <DataField label="Dirección de Residencia" value={personalInfo.address} fullWidth />

          {/* UBICACIÓN */}
          <div className="col-span-1 sm:col-span-2 lg:col-span-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 pt-4 border-t border-slate-100 mt-2">
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">País</span>
              <div className="flex items-center gap-2 min-h-[28px]">
                {paisFlagUrl && (
                  <img
                    src={paisFlagUrl}
                    alt={`Bandera de ${paisName}`}
                    title={paisName}
                    className="w-7 h-7 rounded-full object-cover border border-slate-200 shadow-sm shrink-0"
                    loading="lazy"
                  />
                )}
                <span className="text-sm font-semibold text-slate-800">{paisName}</span>
              </div>
            </div>

            <DataField label="Departamento" value={personalInfo.resolvedDepartment || "No registrado"} />
            <DataField label="Provincia" value={personalInfo.resolvedProvince || "No registrado"} />
            <DataField label="Distrito" value={personalInfo.resolvedDistrict || "No registrado"} />
          </div>
        </div>
      </div>

      {/* FORMACIÓN ACADÉMICA */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="bg-slate-50 px-5 py-4 border-b border-slate-200 flex items-center gap-3">
          <GraduationCap size={18} className="text-slate-600" />
          <h3 className="text-sm font-black text-slate-800 uppercase tracking-wide">
            Formación Académica
          </h3>
        </div>

        <div className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <DataField
            label="Universidad / Institución"
            value={renderConAcciones(universidadName, { link: "https://enlinea.sunedu.gob.pe/" })}
            fullWidth
          />

          <DataField label="Grado / Título" value={academicStudy.degreeTitle} />
          <DataField label="Especialidad" value={academicStudy.specialty} />
          <DataField label="Año de Ingreso" value={academicStudy.admissionYear} />
          <DataField label="Año de Egreso" value={academicStudy.graduationYear} />

          {!isStudent && (
            <>
              <DataField label="Colegio Profesional" value={academicStudy.professionalAssociation} />
              <DataField label="N° Registro (CIP)" value={academicStudy.registrationNumber} />
            </>
          )}
        </div>
      </div>

      {/* INFORMACIÓN LABORAL */}
      {!isStudent && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="bg-slate-50 px-5 py-4 border-b border-slate-200 flex items-center gap-3">
            <Briefcase size={18} className="text-slate-600" />
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-wide">
              Información Laboral
            </h3>
          </div>

          <div className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <DataField label="Empresa / Institución" value={employmentInfo.companyName} fullWidth />

            <DataField
              label="RUC Empresa"
              value={renderConAcciones(employmentInfo.companyTaxId, {
                copiar: true,
                link: "https://e-consultaruc.sunat.gob.pe/cl-ti-itmrconsruc/FrameCriterioBusquedaWeb.jsp",
              })}
            />

            <DataField label="Cargo" value={employmentInfo.positionName} />
            <DataField label="Área / Departamento" value={employmentInfo.area} />
            
            <DataField 
              label="Correo Corporativo" 
              value={renderConAcciones(employmentInfo.workEmail, { copiar: true })} 
            />

            <DataField
              label="Teléfono Trabajo"
              value={
                employmentInfo.workPhone
                  ? `${employmentInfo.workPhone} ${
                      employmentInfo.workExtension ? `(Anexo: ${employmentInfo.workExtension})` : ""
                    }`
                  : null
              }
            />

            <DataField label="Dirección Laboral" value={employmentInfo.workingAddress} fullWidth />
          </div>
        </div>
      )}

      {/* AVALES */}
      {/* {!isStudent && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="bg-slate-50 px-5 py-4 border-b border-slate-200 flex items-center gap-3">
            <Users size={18} className="text-slate-600" />
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-wide">
              Avales Presentados
            </h3>
          </div>

          <div className="p-5 space-y-4"> */}
            {/* AVAL 1 */}
            {/* <div className="p-4 rounded-xl border border-slate-100 bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  Aval 1 - DNI {endorsements.firstEndorsement?.sponsorDocumentNumber}
                </span>
                <span className="text-[14px] font-bold text-slate-800 capitalize">
                  {endorsements.firstEndorsement?.sponsorFullName?.toLowerCase() || "No registrado"}
                </span>
                <span className="text-[12px] font-medium text-slate-500">
                  {endorsements.firstEndorsement?.sponsorEmail}
                </span>
              </div>
              {approvals[0] && (
                <span
                  className={`w-max px-3 py-1.5 text-[11px] font-bold uppercase rounded-lg border ${
                    approvals[0].status === "APPROVED"
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                      : approvals[0].status === "REJECTED"
                      ? "bg-red-50 text-red-700 border-red-200"
                      : "bg-amber-50 text-amber-700 border-amber-200"
                  }`}
                >
                  {approvals[0].status === "APPROVED"
                    ? "Respaldado"
                    : approvals[0].status === "REJECTED"
                    ? "Rechazado"
                    : "Pendiente de respuesta"}
                </span>
              )}
            </div> */}

            {/* AVAL 2 */}
            {/* <div className="p-4 rounded-xl border border-slate-100 bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  Aval 2 - DNI {endorsements.secondEndorsement?.sponsorDocumentNumber}
                </span>
                <span className="text-[14px] font-bold text-slate-800 capitalize">
                  {endorsements.secondEndorsement?.sponsorFullName?.toLowerCase() || "No registrado"}
                </span>
                <span className="text-[12px] font-medium text-slate-500">
                  {endorsements.secondEndorsement?.sponsorEmail}
                </span>
              </div>
              {approvals[1] && (
                <span
                  className={`w-max px-3 py-1.5 text-[11px] font-bold uppercase rounded-lg border ${
                    approvals[1].status === "APPROVED"
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                      : approvals[1].status === "REJECTED"
                      ? "bg-red-50 text-red-700 border-red-200"
                      : "bg-amber-50 text-amber-700 border-amber-200"
                  }`}
                >
                  {approvals[1].status === "APPROVED"
                    ? "Respaldado"
                    : approvals[1].status === "REJECTED"
                    ? "Rechazado"
                    : "Pendiente de respuesta"}
                </span>
              )}
            </div> */}
          {/* </div>
        </div>
      )} */}
    </div>
  );
}