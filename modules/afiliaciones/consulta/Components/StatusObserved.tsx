"use client";

import React, { useState } from "react";
import { Search, CheckCircle2, AlertTriangle, CloudUpload } from "lucide-react";
import { ApplicationStatusData } from "../Models/ApplicationStatus";

interface ExtendedApplicationStatusData extends Partial<ApplicationStatusData> {
  id: number | string;
  applicationCode?: string;
  observations?: string[];
  expirationDate?: string;
}

interface Props {
  data: ExtendedApplicationStatusData;
  onUploadSuccess?: () => void;
}

interface SponsorData {
  personId?: number;
  fullName: string;
  email: string;
  iimpCode: string;
  dni: string;
}

export const StatusObserved: React.FC<Props> = ({ data, onUploadSuccess }) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [correctionDraft, setCorrectionDraft] = useState<Record<string, any>>(() => (data as any).draftData ?? {});
  const [savingCorrection, setSavingCorrection] = useState(false);

  // Estados para búsqueda de Aval Sustituto
  const [sponsorDni, setSponsorDni] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [foundSponsor, setFoundSponsor] = useState<SponsorData | null>(null);

  // Estados de proceso
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const observedFields = Array.from(new Set(((data as any).pendingObservations ?? []).flatMap((item: any) => item.fieldPaths ?? []))) as string[];
  const isSponsorRejected = (data as any).areas?.sponsors?.status === "OBSERVED";
  const fieldLabels: Record<string, string> = {
    names: "Nombres", fatherLastName: "Apellido paterno", motherLastName: "Apellido materno", birthDate: "Fecha de nacimiento", gender: "Género", phone: "Celular", primaryEmail: "Correo principal", secondaryEmail: "Correo secundario", address: "Dirección", companyTaxId: "RUC", companyName: "Empresa", area: "Área", positionName: "Cargo", workPhone: "Teléfono laboral", workEmail: "Correo laboral", workingAddress: "Dirección laboral", degreeTitle: "Título o grado", specialty: "Especialidad", professionalAssociation: "Colegio profesional", registrationNumber: "Número de colegiatura", sponsorDocumentNumber: "DNI del aval", declarationDocumentId: "Declaración jurada firmada"
  };
  const readPath = (path: string) => path.split(".").reduce((value: any, key) => value?.[key], correctionDraft) ?? "";
  const writePath = (path: string, value: string) => setCorrectionDraft((previous) => {
    const next = structuredClone(previous);
    const keys = path.split("."); let cursor: any = next;
    keys.forEach((key, index) => { if (index === keys.length - 1) cursor[key] = value; else { cursor[key] ??= /^\d+$/.test(keys[index + 1]) ? [] : {}; cursor = cursor[key]; } });
    return next;
  });
  const isFilePath = (path: string) => ["photo", "identityDocument", "universityLetter", "declarationDocumentId"].includes(path.split(".").at(-1) ?? "");
  const uploadCorrectionFile = async (path: string, file?: File) => {
    if (!file) return;
    const trackingCode = (data as any).trackingCode;
    if (!trackingCode) return setErrorMessage("No se encontró el código de seguimiento del expediente.");
    setErrorMessage(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("folder", `afiliaciones/${trackingCode}/subsanaciones`);
      const response = await fetch("/api/afiliaciones/postulacion/upload", { method: "POST", body: formData });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || "No se pudo subir el archivo.");
      writePath(path, result.data.url);
    } catch (error: any) { setErrorMessage(error.message || "No se pudo subir el archivo."); }
  };
  const saveCorrection = async () => {
    const trackingCode = (data as any).trackingCode;
    if (!trackingCode) return setErrorMessage("No se encontró el código de seguimiento del expediente.");
    setSavingCorrection(true); setErrorMessage(null);
    try {
      const response = await fetch(`/api/afiliaciones/postulacion/${trackingCode}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ currentStep: 1, draftData: correctionDraft }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "No se pudo guardar la corrección.");
      setSuccessMessage("Corrección guardada. El área responsable podrá reevaluar su expediente.");
      onUploadSuccess?.();
    } catch (error: any) { setErrorMessage(error.message); } finally { setSavingCorrection(false); }
  };

  // Buscar aval por DNI
  const handleSearchSponsor = async () => {
    if (sponsorDni.length !== 8) return;

    // Resolver ID de la solicitud
    const appId = 
      data?.id || 
      (data as any)?.applicationId || 
      (data as any)?.application_id;

    setIsSearching(true);
    setErrorMessage(null);
    setFoundSponsor(null);

    try {
      const url = appId
        ? `/api/afiliaciones/postulacion/validate-sponsor?documentNumber=${sponsorDni}&applicationId=${appId}`
        : `/api/afiliaciones/postulacion/validate-sponsor?documentNumber=${sponsorDni}`;

      const response = await fetch(url);
      const resData = await response.json();

      if (!response.ok || !resData.success) {
        throw new Error(resData?.message || "No se encontró ningún socio activo con ese DNI.");
      }

      const sponsorInfo = resData.data || resData;

      setFoundSponsor({
        personId: sponsorInfo.id || sponsorInfo.personId,
        fullName: sponsorInfo.fullName,
        email: sponsorInfo.email,
        iimpCode: sponsorInfo.sponsorCode || sponsorInfo.iimpCode,
        dni: sponsorDni,
      });
    } catch (err: any) {
      setErrorMessage(err.message || "Error al buscar el aval.");
    } finally {
      setIsSearching(false);
    }
  };

// Guardar reemplazo en Base de Datos
  const handleSubmitReplacement = async () => {
    if (!foundSponsor) return;

    // 🔍 Inspeccionar en consola del navegador la estructura real
    console.log("📌 PROP DATA COMPLETA RECIBIDA:", data);

    // Búsqueda profunda de application_id en cualquier posible propiedad
    const appId = 
      data?.id || 
      (data as any)?.applicationId || 
      (data as any)?.application_id || 
      (data as any)?.application?.id || 
      (data as any)?.membershipApplication?.id;

    console.log("👉 ID de solicitud resuelto:", appId);

    if (!appId) {
      setErrorMessage(
        "Error: No se pudo obtener el ID del expediente. Revisa la consola del navegador (F12) para ver la estructura de 'data'."
      );
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const response = await fetch("/api/consulta/reemplazar-aval", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          application_id: Number(appId), // 👈 Asegúrate de convertir a Number
          sponsor_person_id: foundSponsor.personId,
          sponsor_code: foundSponsor.iimpCode,
          dni: foundSponsor.dni,
          status: "PENDING",
        }),
      });

      const resData = await response.json();

      if (!response.ok || !resData.success) {
        throw new Error(resData.error || "Error al guardar el nuevo aval.");
      }

      setSuccessMessage(`Se registró exitosamente a ${foundSponsor.fullName}.`);
      setFoundSponsor(null);
      setSponsorDni("");

      setTimeout(() => {
        if (onUploadSuccess) {
          onUploadSuccess();
        } else {
          window.location.reload();
        }
      }, 1200);

    } catch (err: any) {
      console.error("Error al reemplazar aval:", err);
      setErrorMessage(err.message || "No se pudo actualizar la base de datos.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {/* Columna Izquierda: Detalle de Observaciones + Acciones */}
      <div className="md:col-span-2 space-y-6">
        {/* Mensajes Globales de Error / Éxito */}
        {errorMessage && (
          <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-600 font-bold text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" /> {errorMessage}
          </div>
        )}

        {successMessage && (
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 font-bold text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" /> {successMessage}
          </div>
        )}

        {/* Observaciones del Comité */}
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-3">
          <div className="flex items-center gap-2 text-amber-800 font-semibold text-sm">
            <span>⚠️</span> Observaciones del Comité
          </div>
          <ul className="text-xs text-slate-700 space-y-2 list-disc pl-4">
            {data.observations && data.observations.length > 0 ? (
              data.observations.map((obs, idx) => <li key={idx}>{obs}</li>)
            ) : (
              <li>Por favor, revise los requerimientos o avales rechazados e ingrese la nueva información.</li>
            )}
          </ul>
        </div>

        {observedFields.length > 0 && (
          <div className="p-5 bg-white border border-slate-200 rounded-2xl space-y-4 shadow-sm">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide">Campos observados para corregir</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {observedFields.map((path) => {
                const field = path.split(".").at(-1) ?? path;
                const type = field.includes("Email") ? "email" : field.includes("Date") ? "date" : field.includes("DocumentNumber") || field === "phone" || field === "workPhone" || field === "companyTaxId" ? "text" : "text";
                if (isFilePath(path)) return <label key={path} className="text-xs font-semibold text-slate-700"><span className="block mb-1">{fieldLabels[field] ?? field}</span><input type="file" accept={field === "photo" ? ".jpg,.jpeg,.png" : ".pdf,.jpg,.jpeg,.png"} onChange={(event) => uploadCorrectionFile(path, event.target.files?.[0])} className="w-full text-xs file:mr-3 file:border-0 file:rounded-lg file:bg-amber-100 file:px-3 file:py-2 file:text-amber-800" /><span className="block mt-1 text-[10px] text-slate-400">{typeof readPath(path) === "string" && readPath(path) ? "Archivo cargado. Puede reemplazarlo si es necesario." : "Seleccione el archivo corregido."}</span></label>;
                return <label key={path} className="text-xs font-semibold text-slate-700"><span className="block mb-1">{fieldLabels[field] ?? field}</span><input type={type} value={String(readPath(path) ?? "")} onChange={(event) => writePath(path, event.target.value)} className="w-full h-10 px-3 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#C5A059]" /></label>;
              })}
            </div>
            <button type="button" onClick={saveCorrection} disabled={savingCorrection} className="w-full h-11 bg-[#C5A059] hover:bg-[#b08e4b] text-white font-bold text-xs rounded-xl disabled:opacity-50">{savingCorrection ? "Guardando..." : "Guardar correcciones"}</button>
          </div>
        )}

        {/* MÓDULO: Reemplazar Aval Observado */}
        {isSponsorRejected && <div className="p-5 bg-white border border-slate-200 rounded-2xl space-y-4 shadow-sm">
          <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
            1. Reemplazar Aval Rechazado
          </h4>
          
          <div className="space-y-3">
            <label className="text-xs font-semibold text-slate-700 block">DNI del Nuevo Aval</label>
            <div className="flex gap-2">
              <input
                type="text"
                maxLength={8}
                placeholder="Ingrese DNI (8 dígitos)"
                value={sponsorDni}
                onChange={(e) => setSponsorDni(e.target.value.replace(/\D/g, ""))}
                className="flex-1 h-10 px-3 rounded-xl border border-slate-300 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#C5A059]"
              />
              <button
                type="button"
                onClick={handleSearchSponsor}
                disabled={isSearching || sponsorDni.length !== 8}
                className="px-4 h-10 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-medium transition-colors disabled:opacity-40 flex items-center gap-1.5"
              >
                {isSearching ? "Buscando..." : <><Search size={14} /> Buscar</>}
              </button>
            </div>
          </div>

          {/* Datos del Aval Encontrado */}
          {foundSponsor && (
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-[10px] uppercase text-slate-400 font-bold block">Nombre Completo</span>
                  <span className="font-bold text-slate-800">{foundSponsor.fullName}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase text-slate-400 font-bold block">Código IIMP</span>
                  <span className="font-medium text-slate-700">{foundSponsor.iimpCode}</span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleSubmitReplacement}
                disabled={isSubmitting}
                className="w-full h-10 bg-[#C5A059] hover:bg-[#b08e4b] text-white font-bold text-xs rounded-xl transition-colors shadow-sm disabled:opacity-50"
              >
                {isSubmitting ? "Enviando Solicitud..." : "Confirmar y Enviar a Nuevo Aval"}
              </button>
            </div>
          )}
        </div>}

        {/* Dropzone Subsanación de Documentos */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-slate-700 block">
            2. Actualizar Documentación Subsanada
          </label>
          <div className="border-2 border-dashed border-slate-200 hover:border-amber-500 rounded-2xl p-6 text-center bg-slate-50/50 hover:bg-amber-50/10 transition-colors cursor-pointer relative">
            <input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={handleFileChange}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            <div className="w-10 h-10 bg-amber-100/60 rounded-full flex items-center justify-center mx-auto mb-2 text-amber-800">
              <CloudUpload className="w-5 h-5" />
            </div>
            <p className="text-xs font-medium text-slate-700">
              {selectedFile ? selectedFile.name : "Seleccionar archivo o arrastrar aquí PDF, JPG"}
            </p>
            <p className="text-[11px] text-slate-400 mt-1">(Max 5MB)</p>
          </div>
        </div>

        <button
          disabled={!selectedFile}
          onClick={onUploadSuccess}
          className="w-full h-11 bg-slate-800 hover:bg-slate-900 text-white font-medium text-xs rounded-xl transition-colors disabled:opacity-40"
        >
          Corregir Documentación
        </button>
      </div>

      {/* Columna Derecha: Detalle del Trámite */}
      <div className="space-y-4">
        <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-3">
          <h5 className="text-xs font-bold text-slate-800">Detalles del Trámite</h5>
          <div>
            <span className="text-[10px] uppercase text-slate-400 block font-semibold">N° de Expediente</span>
            <span className="text-xs font-bold text-slate-700">{data.applicationCode}</span>
          </div>
          <div>
            <span className="text-[10px] uppercase text-slate-400 block font-semibold">Plazo de Subsanación</span>
            <span className="text-xs font-bold text-red-600 flex items-center gap-1">
              ⏳ Vence en {data.expirationDate || "5 días"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
