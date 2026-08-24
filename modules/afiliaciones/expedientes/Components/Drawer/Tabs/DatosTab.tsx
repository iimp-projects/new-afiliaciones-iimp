import React from "react";

import {
  User,
  GraduationCap,
  Briefcase,
  Users,
} from "lucide-react";

import { DataField } from "../../../Utils/expedientes.utils";

interface DatosTabProps {
  payload: any;
}

export function DatosTab({
  payload,
}: DatosTabProps) {

  const draft =
    payload.draftData || {};

  const personalInfo =
    draft.personalInformation || {};

  const academicStudy =
    draft.academicStudies?.[0] || {};

  const employmentInfo =
    draft.employmentInformation || {};

  const endorsements =
    draft.endorsements || {};

  const approvals =
    payload.approvals || [];

  const isStudent =
    payload.affiliateType ===
    "STUDENT";

  // ============================================================
  // NOMBRES Y APELLIDOS
  // ============================================================

  const rawNames =
    `${personalInfo.names || payload.person?.firstName || ""} ${
      personalInfo.fatherLastName ||
      payload.person?.paternalLastName ||
      ""
    } ${
      personalInfo.motherLastName ||
      payload.person?.maternalLastName ||
      ""
    }`.trim();

  // ============================================================
  // GÉNERO
  // ============================================================

  const generoLabel =
    personalInfo.gender === "MALE"
      ? "Masculino"
      : personalInfo.gender ===
        "FEMALE"
      ? "Femenino"
      : personalInfo.gender;

  // ============================================================
  // UNIVERSIDAD
  // ============================================================

  const universidadName =
    academicStudy.otherInstitution ||
    payload.person?.academicInfos?.[0]
      ?.university?.name ||
    (academicStudy.institutionId
      ? "Institución Registrada"
      : "");

  // ============================================================
  // PAÍS
  // ============================================================

  const paisName =
    personalInfo.resolvedCountry ||
    "No registrado";

  const paisCode =
    personalInfo.resolvedCountryCode
      ?.toString()
      .trim()
      .toLowerCase() || null;

  // ============================================================
  // FLAG CDN
  //
  // PE -> Perú
  // CO -> Colombia
  // AR -> Argentina
  // CA -> Canadá
  //
  // El código viene del backend.
  // ============================================================

  const paisFlagUrl =
    paisCode
      ? `https://flagcdn.com/w80/${paisCode}.png`
      : null;

  console.log(
    "[DatosTab] PAÍS",
    {
      paisName,
      paisCode,
      paisFlagUrl,
    }
  );

  return (

    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300 pb-10">

      {/* ============================================================
          DATOS PERSONALES
      ============================================================ */}

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">

        <div className="bg-slate-50 px-5 py-4 border-b border-slate-200 flex items-center gap-3">

          <User
            size={18}
            className="text-slate-600"
          />

          <h3 className="text-sm font-black text-slate-800 uppercase tracking-wide">
            Datos Personales
          </h3>

        </div>

        <div className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">

          <DataField
            label="Nombres y Apellidos"
            value={rawNames}
            fullWidth
          />

          <DataField
            label={`Documento (${
              payload.documentType ||
              "DNI"
            })`}
            value={
              payload.documentNumber
            }
          />

          <div className="hidden lg:block" />

          <DataField
            label="Fecha Nacimiento"
            value={
              personalInfo.birthDate
            }
          />

          <DataField
            label="Género"
            value={generoLabel}
          />

          <div className="hidden lg:block" />

          <DataField
            label="Correo Principal"
            value={
              personalInfo.primaryEmail ||
              payload.email
            }
          />

          <DataField
            label="Correo Secundario"
            value={
              personalInfo.secondaryEmail
            }
          />

          <div className="hidden lg:block" />

          <DataField
            label="Celular"
            value={
              personalInfo.phone ||
              payload.phone
            }
          />

          <DataField
            label="Teléfono Fijo"
            value={
              personalInfo.landline
            }
          />

          <div className="hidden lg:block" />

          <DataField
            label="Dirección de Residencia"
            value={
              personalInfo.address
            }
            fullWidth
          />

          {/* ========================================================
              UBICACIÓN
          ======================================================== */}

          <div className="col-span-1 sm:col-span-2 lg:col-span-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 pt-4 border-t border-slate-100 mt-2">

            {/* ======================================================
                PAÍS
            ====================================================== */}

            <div className="flex flex-col gap-1">

              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                País
              </span>

              <div className="flex items-center gap-2 min-h-[28px]">

                {paisFlagUrl && (

                  <img
                    src={paisFlagUrl}
                    alt={`Bandera de ${paisName}`}
                    title={paisName}
                    className="
                      w-7
                      h-7
                      rounded-full
                      object-cover
                      border
                      border-slate-200
                      shadow-sm
                      shrink-0
                    "
                    loading="lazy"

                    onError={(
                      event
                    ) => {

                      console.error(
                        "[DatosTab] Error cargando bandera:",
                        paisFlagUrl
                      );

                      event.currentTarget.style.display =
                        "none";
                    }}
                  />

                )}

                <span className="text-sm font-semibold text-slate-800">
                  {paisName}
                </span>

              </div>

            </div>

            {/* ======================================================
                DEPARTAMENTO
            ====================================================== */}

            <DataField
              label="Departamento"
              value={
                personalInfo.resolvedDepartment ||
                "No registrado"
              }
            />

            {/* ======================================================
                PROVINCIA
            ====================================================== */}

            <DataField
              label="Provincia"
              value={
                personalInfo.resolvedProvince ||
                "No registrado"
              }
            />

            {/* ======================================================
                DISTRITO
            ====================================================== */}

            <DataField
              label="Distrito"
              value={
                personalInfo.resolvedDistrict ||
                "No registrado"
              }
            />

          </div>

        </div>

      </div>

      {/* ============================================================
          FORMACIÓN ACADÉMICA
      ============================================================ */}

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">

        <div className="bg-slate-50 px-5 py-4 border-b border-slate-200 flex items-center gap-3">

          <GraduationCap
            size={18}
            className="text-slate-600"
          />

          <h3 className="text-sm font-black text-slate-800 uppercase tracking-wide">
            Formación Académica
          </h3>

        </div>

        <div className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">

          <DataField
            label="Universidad / Institución"
            value={
              universidadName
            }
            fullWidth
          />

          <DataField
            label="Grado / Título"
            value={
              academicStudy.degreeTitle
            }
          />

          <DataField
            label="Especialidad"
            value={
              academicStudy.specialty
            }
          />

          <DataField
            label="Año de Ingreso"
            value={
              academicStudy.admissionYear
            }
          />

          <DataField
            label="Año de Egreso"
            value={
              academicStudy.graduationYear
            }
          />

          {!isStudent && (

            <>

              <DataField
                label="Colegio Profesional"
                value={
                  academicStudy.professionalAssociation
                }
              />

              <DataField
                label="N° Registro (CIP)"
                value={
                  academicStudy.registrationNumber
                }
              />

            </>

          )}

        </div>

      </div>

      {/* ============================================================
          INFORMACIÓN LABORAL
      ============================================================ */}

      {!isStudent && (

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">

          <div className="bg-slate-50 px-5 py-4 border-b border-slate-200 flex items-center gap-3">

            <Briefcase
              size={18}
              className="text-slate-600"
            />

            <h3 className="text-sm font-black text-slate-800 uppercase tracking-wide">
              Información Laboral
            </h3>

          </div>

          <div className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">

            <DataField
              label="Empresa / Institución"
              value={
                employmentInfo.companyName
              }
              fullWidth
            />

            <DataField
              label="RUC Empresa"
              value={
                employmentInfo.companyTaxId
              }
            />

            <DataField
              label="Cargo"
              value={
                employmentInfo.positionName
              }
            />

            <DataField
              label="Área / Departamento"
              value={
                employmentInfo.area
              }
            />

            <DataField
              label="Correo Corporativo"
              value={
                employmentInfo.workEmail
              }
            />

            <DataField
              label="Teléfono Trabajo"
              value={
                employmentInfo.workPhone
                  ? `${
                      employmentInfo.workPhone
                    } ${
                      employmentInfo.workExtension
                        ? `(Anexo: ${
                            employmentInfo.workExtension
                          })`
                        : ""
                    }`
                  : null
              }
            />

            <DataField
              label="Dirección Laboral"
              value={
                employmentInfo.workingAddress
              }
              fullWidth
            />

          </div>

        </div>

      )}

      {/* ============================================================
          AVALES
      ============================================================ */}

      {!isStudent && (

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">

          <div className="bg-slate-50 px-5 py-4 border-b border-slate-200 flex items-center gap-3">

            <Users
              size={18}
              className="text-slate-600"
            />

            <h3 className="text-sm font-black text-slate-800 uppercase tracking-wide">
              Avales Presentados
            </h3>

          </div>

          <div className="p-5 space-y-4">

            {/* ======================================================
                AVAL 1
            ====================================================== */}

            <div className="p-4 rounded-xl border border-slate-100 bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">

              <div className="flex flex-col gap-1">

                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">

                  Aval 1 - DNI{" "}

                  {
                    endorsements
                      .firstEndorsement
                      ?.sponsorDocumentNumber
                  }

                </span>

                <span className="text-[14px] font-bold text-slate-800 capitalize">

                  {
                    endorsements
                      .firstEndorsement
                      ?.sponsorFullName
                      ?.toLowerCase() ||
                    "No registrado"
                  }

                </span>

                <span className="text-[12px] font-medium text-slate-500">

                  {
                    endorsements
                      .firstEndorsement
                      ?.sponsorEmail
                  }

                </span>

              </div>

              {approvals[0] && (

                <span
                  className={`w-max px-3 py-1.5 text-[11px] font-bold uppercase rounded-lg border ${
                    approvals[0].status ===
                    "APPROVED"
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                      : approvals[0].status ===
                        "REJECTED"
                      ? "bg-red-50 text-red-700 border-red-200"
                      : "bg-amber-50 text-amber-700 border-amber-200"
                  }`}
                >

                  {
                    approvals[0].status ===
                    "APPROVED"
                      ? "Respaldado"
                      : approvals[0].status ===
                        "REJECTED"
                      ? "Rechazado"
                      : "Pendiente de respuesta"
                  }

                </span>

              )}

            </div>

            {/* ======================================================
                AVAL 2
            ====================================================== */}

            <div className="p-4 rounded-xl border border-slate-100 bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">

              <div className="flex flex-col gap-1">

                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">

                  Aval 2 - DNI{" "}

                  {
                    endorsements
                      .secondEndorsement
                      ?.sponsorDocumentNumber
                  }

                </span>

                <span className="text-[14px] font-bold text-slate-800 capitalize">

                  {
                    endorsements
                      .secondEndorsement
                      ?.sponsorFullName
                      ?.toLowerCase() ||
                    "No registrado"
                  }

                </span>

                <span className="text-[12px] font-medium text-slate-500">

                  {
                    endorsements
                      .secondEndorsement
                      ?.sponsorEmail
                  }

                </span>

              </div>

              {approvals[1] && (

                <span
                  className={`w-max px-3 py-1.5 text-[11px] font-bold uppercase rounded-lg border ${
                    approvals[1].status ===
                    "APPROVED"
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                      : approvals[1].status ===
                        "REJECTED"
                      ? "bg-red-50 text-red-700 border-red-200"
                      : "bg-amber-50 text-amber-700 border-amber-200"
                  }`}
                >

                  {
                    approvals[1].status ===
                    "APPROVED"
                      ? "Respaldado"
                      : approvals[1].status ===
                        "REJECTED"
                      ? "Rechazado"
                      : "Pendiente de respuesta"
                  }

                </span>

              )}

            </div>

          </div>

        </div>

      )}

    </div>
  );
}