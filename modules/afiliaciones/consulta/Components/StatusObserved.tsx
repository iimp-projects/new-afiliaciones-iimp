"use client";

import React, { useState } from "react";
import { Search, CheckCircle2, AlertTriangle, CloudUpload, ExternalLink } from "lucide-react";
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

/**
 * Lee un valor anidado del draftData dado un path "a.b.c".
 * Si el valor es un objeto {url, name, type} (campo de archivo), lo retorna completo.
 */
const readPath = (draft: Record<string, any>, path: string): any =>
  path.split(".").reduce((value: any, key) => value?.[key], draft) ?? "";

/**
 * Extrae la URL de un campo de archivo, que puede ser:
 *   - un string directo (declarationDocumentId)
 *   - un objeto {url, name, type} (photo, identityDocument, universityLetter)
 */
const extractUrl = (value: any): string | null => {
  if (!value) return null;
  if (typeof value === "string" && value.startsWith("http")) return value;
  if (typeof value === "object" && value.url) return value.url as string;
  return null;
};

/**
 * Escribe un valor en el draft clonando el objeto de forma inmutable.
 * Para campos de archivo, guarda el objeto completo {url, name, type}.
 */
const writePath = (
  previous: Record<string, any>,
  path: string,
  value: any
): Record<string, any> => {
  const next = structuredClone(previous);
  const keys = path.split(".");
  let cursor: any = next;
  keys.forEach((key, index) => {
    if (index === keys.length - 1) {
      cursor[key] = value;
    } else {
      cursor[key] ??= /^\d+$/.test(keys[index + 1]) ? [] : {};
      cursor = cursor[key];
    }
  });
  return next;
};

/** Campos que apuntan a un archivo (foto, DNI, declaración, constancia). */
const isFilePath = (path: string) =>
  ["photo", "identityDocument", "universityLetter", "declarationDocumentId"].includes(
    path.split(".").at(-1) ?? ""
  );

const fieldLabels: Record<string, string> = {
  names: "Nombres",
  fatherLastName: "Apellido paterno",
  motherLastName: "Apellido materno",
  birthDate: "Fecha de nacimiento",
  gender: "Género",
  phone: "Celular",
  primaryEmail: "Correo principal",
  secondaryEmail: "Correo secundario",
  address: "Dirección",
  companyTaxId: "RUC",
  companyName: "Empresa",
  area: "Área",
  positionName: "Cargo",
  workPhone: "Teléfono laboral",
  workEmail: "Correo laboral",
  workingAddress: "Dirección laboral",
  degreeTitle: "Título o grado",
  specialty: "Especialidad",
  professionalAssociation: "Colegio profesional",
  registrationNumber: "Número de colegiatura",
  sponsorDocumentNumber: "DNI del aval",
  declarationDocumentId: "Declaración jurada firmada",
  identityDocument: "Documento de Identidad",
  photo: "Fotografía",
  universityLetter: "Carta / Certificado universitario",
};

export const StatusObserved: React.FC<Props> = ({ data, onUploadSuccess }) => {
  // Estado del draft que el usuario puede editar
  const [correctionDraft, setCorrectionDraft] = useState<Record<string, any>>(
    () => (data as any).draftData ?? {}
  );
  // Estado de carga por campo de archivo (key = path del campo)
  const [uploadingField, setUploadingField] = useState<Record<string, boolean>>({});
  const [savingCorrection, setSavingCorrection] = useState(false);
  // Estado de carga de URL pre-firmada para ver archivo actual (key = path)
  const [openingFile, setOpeningFile] = useState<Record<string, boolean>>({});
  // Vista previa local del archivo recién seleccionado (key = path, value = {objectUrl, name, type})
  const [localPreview, setLocalPreview] = useState<Record<string, { objectUrl: string; name: string; type: string }>>({});

  // Estados para búsqueda de Aval Sustituto
  const [sponsorDni, setSponsorDni] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [foundSponsor, setFoundSponsor] = useState<SponsorData | null>(null);

  // Estados de proceso
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // ─────────────────────────────────────────────────────────────────────
  // Campos observados que debe corregir el postulante
  // ─────────────────────────────────────────────────────────────────────
  const observedFields = Array.from(
    new Set(
      ((data as any).pendingObservations ?? []).flatMap((item: any) => item.fieldPaths ?? [])
    )
  ) as string[];

  const isSponsorRejected = (data as any).areas?.sponsors?.status === "OBSERVED";

  // ─────────────────────────────────────────────────────────────────────
  // Sube UN archivo a S3 y actualiza el draft local con el objeto {url,name,type}
  // ─────────────────────────────────────────────────────────────────────
  // ─────────────────────────────────────────────────────────────────────
  // Abre el archivo actual usando una URL pre-firmada (evita AccessDenied en S3)
  // ─────────────────────────────────────────────────────────────────────
  const openCurrentFile = async (path: string, s3Url: string) => {
    setOpeningFile((prev) => ({ ...prev, [path]: true }));
    try {
      const res = await fetch(
        `/api/afiliaciones/postulacion/file?url=${encodeURIComponent(s3Url)}`
      );
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || "No se pudo obtener el archivo.");
      window.open(json.data.url, "_blank", "noopener,noreferrer");
    } catch (error: any) {
      setErrorMessage(error.message || "No se pudo abrir el archivo.");
    } finally {
      setOpeningFile((prev) => ({ ...prev, [path]: false }));
    }
  };

  const uploadCorrectionFile = async (path: string, file?: File) => {
    if (!file) return;
    const trackingCode = (data as any).trackingCode;
    if (!trackingCode) {
      setErrorMessage("No se encontró el código de seguimiento del expediente.");
      return;
    }
    setErrorMessage(null);
    setUploadingField((prev) => ({ ...prev, [path]: true }));

    // Vista previa local inmediata antes de subir
    const objectUrl = URL.createObjectURL(file);
    setLocalPreview((prev) => ({ ...prev, [path]: { objectUrl, name: file.name, type: file.type } }));

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("folder", `afiliaciones/${trackingCode}/subsanaciones`);
      const response = await fetch("/api/afiliaciones/postulacion/upload", {
        method: "POST",
        body: formData,
      });
      const result = await response.json();
      if (!response.ok || !result.success)
        throw new Error(result.message || "No se pudo subir el archivo.");

      const fieldKey = path.split(".").at(-1) ?? path;
      // Para declarationDocumentId se guarda solo la URL (string).
      // Para photo, identityDocument, universityLetter se guarda el objeto {url,name,type}.
      const newValue =
        fieldKey === "declarationDocumentId"
          ? result.data.url
          : { url: result.data.url, name: file.name, type: file.type };

      setCorrectionDraft((prev) => writePath(prev, path, newValue));
    } catch (error: any) {
      setErrorMessage(error.message || "No se pudo subir el archivo.");
      // Limpiar preview si falló la subida
      setLocalPreview((prev) => {
        const next = { ...prev };
        delete next[path];
        return next;
      });
    } finally {
      setUploadingField((prev) => ({ ...prev, [path]: false }));
    }
  };

  // ─────────────────────────────────────────────────────────────────────
  // Guarda el draft corregido en la BD y además actualiza membership_documents
  // ─────────────────────────────────────────────────────────────────────
  const saveCorrection = async () => {
    const trackingCode = (data as any).trackingCode;
    if (!trackingCode) {
      setErrorMessage("No se encontró el código de seguimiento del expediente.");
      return;
    }
    setSavingCorrection(true);
    setErrorMessage(null);
    try {
      // 1️⃣  Persistir draftData en membership_applications
      const patchRes = await fetch(`/api/afiliaciones/postulacion/${trackingCode}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentStep: 1, draftData: correctionDraft }),
      });
      const patchResult = await patchRes.json();
      if (!patchRes.ok) throw new Error(patchResult.error || "No se pudo guardar la corrección.");

      setSuccessMessage(
        "Corrección guardada correctamente. El área responsable reevaluará su expediente."
      );
      onUploadSuccess?.();
    } catch (error: any) {
      setErrorMessage(error.message);
    } finally {
      setSavingCorrection(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────
  // Buscar aval por DNI
  // ─────────────────────────────────────────────────────────────────────
  const handleSearchSponsor = async () => {
    if (sponsorDni.length !== 8) return;
    const appId =
      data?.id || (data as any)?.applicationId || (data as any)?.application_id;
    setIsSearching(true);
    setErrorMessage(null);
    setFoundSponsor(null);
    try {
      const url = appId
        ? `/api/afiliaciones/postulacion/validate-sponsor?documentNumber=${sponsorDni}&applicationId=${appId}`
        : `/api/afiliaciones/postulacion/validate-sponsor?documentNumber=${sponsorDni}`;
      const response = await fetch(url);
      const resData = await response.json();
      if (!response.ok || !resData.success)
        throw new Error(resData?.message || "No se encontró ningún socio activo con ese DNI.");
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

  // ─────────────────────────────────────────────────────────────────────
  // Guardar reemplazo de Aval en la BD
  // ─────────────────────────────────────────────────────────────────────
  const handleSubmitReplacement = async () => {
    if (!foundSponsor) return;
    const appId =
      data?.id ||
      (data as any)?.applicationId ||
      (data as any)?.application_id ||
      (data as any)?.application?.id ||
      (data as any)?.membershipApplication?.id;

    if (!appId) {
      setErrorMessage(
        "Error: No se pudo obtener el ID del expediente. Revise la consola del navegador (F12)."
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
          application_id: Number(appId),
          sponsor_person_id: foundSponsor.personId,
          sponsor_code: foundSponsor.iimpCode,
          dni: foundSponsor.dni,
          status: "PENDING",
        }),
      });
      const resData = await response.json();
      if (!response.ok || !resData.success)
        throw new Error(resData.error || "Error al guardar el nuevo aval.");
      setSuccessMessage(`Se registró exitosamente a ${foundSponsor.fullName}.`);
      setFoundSponsor(null);
      setSponsorDni("");
      setTimeout(() => {
        if (onUploadSuccess) onUploadSuccess();
        else window.location.reload();
      }, 1200);
    } catch (err: any) {
      setErrorMessage(err.message || "No se pudo actualizar la base de datos.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────
  // Determina si algún campo de archivo del draft ha sido modificado
  // respecto al draftData original recibido
  // ─────────────────────────────────────────────────────────────────────
  const originalDraft = (data as any).draftData ?? {};
  const hasFileChanges = observedFields.some((path) => {
    if (!isFilePath(path)) return false;
    const original = extractUrl(readPath(originalDraft, path));
    const current = extractUrl(readPath(correctionDraft, path));
    return current && current !== original;
  });
  const hasTextChanges = observedFields.some((path) => {
    if (isFilePath(path)) return false;
    return readPath(correctionDraft, path) !== readPath(originalDraft, path);
  });
  const hasPendingChanges = hasFileChanges || hasTextChanges;

  // ─────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {/* Columna Izquierda */}
      <div className="md:col-span-2 space-y-6">
        {/* Mensajes globales */}
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
            <span>⚠️</span> Observaciones del Evaluador
          </div>
          <ul className="text-xs text-slate-700 space-y-2 list-disc pl-4">
            {data.observations && data.observations.length > 0 ? (
              data.observations.map((obs, idx) => (
                <li key={idx}>
                  <span
                    className="inline-block align-top [&>p]:inline [&>p]:m-0"
                    dangerouslySetInnerHTML={{ __html: obs }}
                  />
                </li>
              ))
            ) : (
              <li>Por favor, revise los requerimientos o avales rechazados e ingrese la nueva información.</li>
            )}
          </ul>
        </div>

        {/* ── Campos observados para corregir ── */}
        {observedFields.length > 0 && (
          <div className="p-5 bg-white border border-slate-200 rounded-2xl space-y-5 shadow-sm">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
              Campos a corregir
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {observedFields.map((path) => {
                const fieldKey = path.split(".").at(-1) ?? path;
                const label = fieldLabels[fieldKey] ?? fieldKey;

                if (isFilePath(path)) {
                  // ── Campo de archivo ──
                  const currentValue = readPath(correctionDraft, path);
                  const currentUrl = extractUrl(currentValue);
                  const isUploading = uploadingField[path] ?? false;

                  const preview = localPreview[path];
                  const origUrl = extractUrl(readPath(originalDraft, path));
                  const newUrl = extractUrl(readPath(correctionDraft, path));
                  const isNewFile = newUrl && newUrl !== origUrl;
                  const isImage = preview
                    ? preview.type.startsWith("image/")
                    : typeof currentValue === "object" && currentValue?.type?.startsWith("image/");

                  return (
                    <div key={path} className="col-span-1 sm:col-span-2 space-y-2">
                      <span className="text-xs font-semibold text-slate-700 block">{label}</span>

                      {/* Archivo actualmente guardado — se abre vía URL pre-firmada */}
                      {currentUrl ? (
                        <button
                          type="button"
                          onClick={() => openCurrentFile(path, currentUrl)}
                          disabled={openingFile[path]}
                          className="inline-flex items-center gap-1.5 text-[11px] text-blue-600 hover:text-blue-800 font-medium underline disabled:opacity-50 disabled:cursor-wait"
                        >
                          <ExternalLink className="w-3 h-3" />
                          {openingFile[path] ? "Abriendo..." : "Ver archivo actual"}
                          {typeof currentValue === "object" && currentValue?.name
                            ? ` (${currentValue.name})`
                            : ""}
                        </button>
                      ) : (
                        <p className="text-[11px] text-slate-400">Sin archivo cargado.</p>
                      )}

                      {/* Input para subir nuevo archivo */}
                      <label className="cursor-pointer block">
                        <div
                          className={`border-2 border-dashed rounded-xl p-4 text-center transition-colors ${
                            isUploading
                              ? "border-amber-400 bg-amber-50"
                              : "border-slate-200 hover:border-amber-400 hover:bg-amber-50/20"
                          }`}
                        >
                          <input
                            type="file"
                            accept={
                              fieldKey === "photo"
                                ? ".jpg,.jpeg,.png"
                                : ".pdf,.jpg,.jpeg,.png"
                            }
                            disabled={isUploading}
                            onChange={(e) =>
                              uploadCorrectionFile(path, e.target.files?.[0])
                            }
                            className="hidden"
                          />
                          <CloudUpload className="w-5 h-5 text-amber-600 mx-auto mb-1" />
                          <p className="text-[11px] font-medium text-slate-600">
                            {isUploading
                              ? "Subiendo archivo..."
                              : currentUrl
                              ? "Seleccionar nuevo archivo para reemplazar"
                              : "Seleccionar archivo (PDF, JPG, PNG)"}
                          </p>
                        </div>
                      </label>

                      {/* Miniatura / confirmación del archivo recién cargado */}
                      {isNewFile && preview && (
                        <div className="flex items-center gap-3 p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl">
                          {/* Miniatura */}
                          {isImage ? (
                            <img
                              src={preview.objectUrl}
                              alt="Vista previa"
                              className="w-14 h-14 object-cover rounded-lg border border-emerald-300 shrink-0"
                            />
                          ) : (
                            <div className="w-14 h-14 flex flex-col items-center justify-center bg-red-100 rounded-lg border border-red-200 shrink-0 text-red-500">
                              <svg xmlns="http://www.w3.org/2000/svg" className="w-7 h-7" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zm-1 1.5L18.5 9H13V3.5zM8.5 15h7v1h-7v-1zm0-2h7v1h-7v-1zm0-2h4v1h-4v-1z" />
                              </svg>
                              <span className="text-[8px] font-bold mt-0.5">PDF</span>
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-[11px] text-emerald-700 font-bold flex items-center gap-1">
                              ✅ Archivo nuevo cargado y listo para guardar.
                            </p>
                            <p className="text-[10px] text-slate-500 truncate mt-0.5">{preview.name}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                }

                // ── Campo de texto ──
                const fieldType = fieldKey.includes("Email")
                  ? "email"
                  : fieldKey.includes("Date")
                  ? "date"
                  : "text";
                return (
                  <label key={path} className="text-xs font-semibold text-slate-700 col-span-1">
                    <span className="block mb-1">{label}</span>
                    <input
                      type={fieldType}
                      value={String(readPath(correctionDraft, path) ?? "")}
                      onChange={(e) =>
                        setCorrectionDraft((prev) => writePath(prev, path, e.target.value))
                      }
                      className="w-full h-10 px-3 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#C5A059]"
                    />
                  </label>
                );
              })}
            </div>

            <button
              type="button"
              onClick={saveCorrection}
              disabled={savingCorrection || !hasPendingChanges}
              className="w-full h-11 bg-[#C5A059] hover:bg-[#b08e4b] text-white font-bold text-xs rounded-xl disabled:opacity-50 transition-colors"
            >
              {savingCorrection ? "Guardando..." : "Guardar correcciones"}
            </button>

            {!hasPendingChanges && !savingCorrection && (
              <p className="text-center text-[11px] text-slate-400">
                Suba o modifique los campos indicados para poder guardar.
              </p>
            )}
          </div>
        )}

        {/* ── Módulo: Reemplazar Aval Rechazado ── */}
        {isSponsorRejected && (
          <div className="p-5 bg-white border border-slate-200 rounded-2xl space-y-4 shadow-sm">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
              {observedFields.length > 0 ? "2." : "1."} Reemplazar Aval Rechazado
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
          </div>
        )}
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
