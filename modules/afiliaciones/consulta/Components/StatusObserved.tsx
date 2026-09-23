"use client";

import React, { useState, useEffect } from "react";
import { Search, CheckCircle2, AlertTriangle, CloudUpload, ExternalLink, BriefcaseBusiness, Building2, UserMinus, Info } from "lucide-react";
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
  motherLastName: "Apellido mamterno",
  birthDate: "Fecha de nacimiento",
  gender: "Género",
  phone: "Celular",
  primaryEmail: "Correo principal",
  secondaryEmail: "Correo secundario",
  address: "Dirección",
  countryId: "País",
  departmentId: "Departamento / Región",
  provinceId: "Provincia",
  districtId: "Distrito",
  companyTaxId: "RUC / Situación laboral",
  companyName: "Empresa",
  area: "Área",
  positionName: "Cargo",
  workPhone: "Teléfono laboral",
  workEmail: "Correo laboral",
  workingAddress: "Dirección laboral",
  degreeId: "Grado Académico",
  degreeTitle: "Título obtenido",
  specialty: "Especialidad",
  professionalAssociation: "Colegio profesional",
  registrationNumber: "Número de colegiatura",
  sponsorDocumentNumber: "DNI del aval",
  declarationDocumentId: "Declaración jurada firmada",
  identityDocument: "Documento de Identidad",
  photo: "Fotografía",
  universityLetter: "Carta / Certificado universitario",
};

/** Campos geográficos que deben renderizarse como selects en cascada */
const GEO_FIELDS = ["countryId", "departmentId", "provinceId", "districtId"] as const;
type GeoField = typeof GEO_FIELDS[number];
const isGeoField = (key: string): key is GeoField => (GEO_FIELDS as readonly string[]).includes(key);

interface CatalogItem { id: number; name: string; }

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

  // ── Catálogos geográficos en cascada ──────────────────────────────────
  const [countries, setCountries] = useState<CatalogItem[]>([]);
  const [departments, setDepartments] = useState<CatalogItem[]>([]);
  const [provinces, setProvinces] = useState<CatalogItem[]>([]);
  const [districts, setDistricts] = useState<CatalogItem[]>([]);

  const geoCountryId: number | undefined = correctionDraft?.personalInformation?.countryId;
  const geoDepartmentId: number | undefined = correctionDraft?.personalInformation?.departmentId;
  const geoProvinceId: number | undefined = correctionDraft?.personalInformation?.provinceId;

  useEffect(() => {
    fetch("/api/catalogs/countries")
      .then((r) => r.json())
      .then(setCountries)
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (geoCountryId) {
      fetch(`/api/catalogs/${geoCountryId}/departments`)
        .then((r) => r.json())
        .then((d: CatalogItem[]) => { setDepartments(d); if (!d.length) { setProvinces([]); setDistricts([]); } })
        .catch(() => {});
    } else { setDepartments([]); setProvinces([]); setDistricts([]); }
  }, [geoCountryId]);

  useEffect(() => {
    if (geoDepartmentId) {
      fetch(`/api/catalogs/${geoDepartmentId}/provinces`)
        .then((r) => r.json())
        .then((d: CatalogItem[]) => { setProvinces(d); if (!d.length) setDistricts([]); })
        .catch(() => {});
    } else { setProvinces([]); setDistricts([]); }
  }, [geoDepartmentId]);

  useEffect(() => {
    if (geoProvinceId) {
      fetch(`/api/catalogs/${geoProvinceId}/districts`)
        .then((r) => r.json())
        .then(setDistricts)
        .catch(() => {});
    } else { setDistricts([]); }
  }, [geoProvinceId]);
  // ─────────────────────────────────────────────────────────────────────────

  // ── Catálogo de grados académicos ─────────────────────────────────────
  const [degrees, setDegrees] = useState<CatalogItem[]>([]);
  useEffect(() => {
    fetch("/api/catalogs/degrees")
      .then((r) => r.json())
      .then((d) => setDegrees(d.data ?? d))
      .catch(() => {});
  }, []);
  // ─────────────────────────────────────────────────────────────────────────

  // ── RUC / Situación laboral ───────────────────────────────────────────
  type RucState = "IDLE" | "LOADING" | "VERIFIED" | "NOT_FOUND" | "SERVICE_ERROR";
  const [rucState, setRucState] = useState<RucState>("IDLE");
  const [rucFeedback, setRucFeedback] = useState<string | null>(null);
  const [isSearchingRuc, setIsSearchingRuc] = useState(false);

  const searchRucInCorrection = async () => {
    const ruc = correctionDraft?.employmentInformation?.companyTaxId ?? "";
    if (ruc.length !== 11) return;
    setIsSearchingRuc(true); setRucState("LOADING"); setRucFeedback(null);
    try {
      const res = await fetch("/api/afiliaciones/postulacion/validate-ruc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ruc }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setRucState("VERIFIED");
        setRucFeedback("RUC verificado correctamente por SUNAT.");
        setCorrectionDraft((prev) => writePath(writePath(prev,
          "employmentInformation.companyName", json.data?.razonSocial ?? ""),
          "employmentInformation.workingAddress", json.data?.direccion ?? ""
        ));
      } else if (res.status === 404) {
        setRucState("NOT_FOUND");
        setRucFeedback("No encontramos info para este RUC. Puedes completar los datos manualmente.");
      } else {
        setRucState("SERVICE_ERROR");
        setRucFeedback("El servicio SUNAT no está disponible. Puedes continuar manualmente.");
      }
    } catch { setRucState("SERVICE_ERROR"); setRucFeedback("Error al consultar SUNAT."); }
    finally { setIsSearchingRuc(false); }
  };
  // ─────────────────────────────────────────────────────────────────────────

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
      if (!patchRes.ok) throw new Error(patchResult.message || patchResult.error || "No se pudo guardar la corrección.");

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
        fullName: "Aval hábil validado",
        email: "",
        iimpCode: "",
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
          dni: foundSponsor.dni,
          status: "PENDING",
        }),
      });
      const resData = await response.json();
      if (!response.ok || !resData.success)
        throw new Error(resData.message || resData.error || "Error al guardar el nuevo aval.");
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
    if (path.endsWith("companyTaxId")) {
      const origEmp = originalDraft?.employmentInformation ?? {};
      const currEmp = correctionDraft?.employmentInformation ?? {};
      if (
        currEmp.companyTaxId !== origEmp.companyTaxId ||
        currEmp.companyName !== origEmp.companyName ||
        currEmp.employmentStatus !== origEmp.employmentStatus ||
        currEmp.isIndependent !== origEmp.isIndependent ||
        currEmp.isUnemployed !== origEmp.isUnemployed
      ) {
        return true;
      }
    }
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
                  <span className="inline-block whitespace-pre-wrap align-top">{obs}</span>
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

                // ── Campo geográfico (select en cascada) ──
                if (isGeoField(fieldKey)) {
                  const geoOptions: Record<GeoField, CatalogItem[]> = {
                    countryId: countries,
                    departmentId: departments,
                    provinceId: provinces,
                    districtId: districts,
                  };

                  // El campo padre aún no fue seleccionado
                  const parentNotSelected =
                    (fieldKey === "departmentId" && !geoCountryId) ||
                    (fieldKey === "provinceId" && !geoDepartmentId) ||
                    (fieldKey === "districtId" && !geoProvinceId);

                  // El padre fue seleccionado pero su catálogo está vacío
                  const parentSelectedButEmpty =
                    (fieldKey === "departmentId" && geoCountryId && departments.length === 0) ||
                    (fieldKey === "provinceId" && geoDepartmentId && provinces.length === 0) ||
                    (fieldKey === "districtId" && geoProvinceId && districts.length === 0);

                  const noApplyLabels: Record<GeoField, string> = {
                    countryId: "",
                    departmentId: "El país seleccionado no requiere seleccionar departamento.",
                    provinceId: "El departamento seleccionado no requiere seleccionar provincia.",
                    districtId: "La provincia seleccionada no requiere seleccionar distrito.",
                  };

                  const options = geoOptions[fieldKey];
                  const currentVal = readPath(correctionDraft, path);

                  // Si el catálogo está vacío y el padre sí fue seleccionado,
                  // mostrar un mensaje y asegurar que el valor sea null
                  if (parentSelectedButEmpty) {
                    return (
                      <div key={path} className="text-xs text-slate-700 col-span-1">
                        <span className="block font-semibold mb-1">{label}</span>
                        <div className="flex items-center gap-2 px-3 py-2.5 bg-blue-50 border border-blue-100 rounded-xl text-blue-600 text-[11px]">
                          <span>ℹ️</span>
                          <span>{noApplyLabels[fieldKey]}</span>
                        </div>
                      </div>
                    );
                  }

                  if (parentNotSelected) {
                    return (
                      <div key={path} className="text-xs text-slate-700 col-span-1">
                        <span className="block font-semibold mb-1">{label}</span>
                        <div className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-gray-50 flex items-center text-slate-400 text-sm">
                          Seleccione...
                        </div>
                        <p className="text-[10px] text-slate-400 mt-1">Seleccione primero el campo anterior.</p>
                      </div>
                    );
                  }

                  return (
                    <label key={path} className="text-xs font-semibold text-slate-700 col-span-1">
                      <span className="block mb-1.5">{label}</span>
                      <select
                        value={currentVal ?? ""}
                        onChange={(e) => {
                          const newVal = e.target.value ? Number(e.target.value) : null;
                          if (fieldKey === "countryId") {
                            setCorrectionDraft((prev) => {
                              let next = writePath(prev, path, newVal);
                              next = writePath(next, "personalInformation.departmentId", null);
                              next = writePath(next, "personalInformation.provinceId", null);
                              next = writePath(next, "personalInformation.districtId", null);
                              return next;
                            });
                          } else if (fieldKey === "departmentId") {
                            setCorrectionDraft((prev) => {
                              let next = writePath(prev, path, newVal);
                              next = writePath(next, "personalInformation.provinceId", null);
                              next = writePath(next, "personalInformation.districtId", null);
                              return next;
                            });
                          } else if (fieldKey === "provinceId") {
                            setCorrectionDraft((prev) => {
                              let next = writePath(prev, path, newVal);
                              next = writePath(next, "personalInformation.districtId", null);
                              return next;
                            });
                          } else {
                            setCorrectionDraft((prev) => writePath(prev, path, newVal));
                          }
                        }}
                        className="w-full h-10 px-3 rounded-xl border border-slate-300 bg-white text-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-[#C5A059]"
                      >
                        <option value="">Seleccione...</option>
                        {options.map((opt) => (
                          <option key={opt.id} value={opt.id}>{opt.name}</option>
                        ))}
                      </select>
                    </label>
                  );
                }

                // ── Campo de grado académico (select con catálogo) ──
                if (fieldKey === "degreeId") {
                  const currentVal = readPath(correctionDraft, path);
                  return (
                    <label key={path} className="text-xs font-semibold text-slate-700 col-span-1">
                      <span className="block mb-1.5">{label}</span>
                      <select
                        value={currentVal ?? ""}
                        onChange={(e) => {
                          const val = e.target.value ? Number(e.target.value) : null;
                          setCorrectionDraft((prev) => writePath(prev, path, val));
                        }}
                        className="w-full h-10 px-3 rounded-xl border border-slate-300 bg-white text-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-[#C5A059]"
                      >
                        <option value="">Seleccione grado académico...</option>
                        {degrees.map((deg) => (
                          <option key={deg.id} value={deg.id}>
                            {deg.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  );
                }

                // ── Campo de RUC / Situación laboral ──
                if (fieldKey === "companyTaxId") {
                  const empInfo = correctionDraft?.employmentInformation ?? {};
                  const currentStatus =
                    empInfo.employmentStatus ||
                    (empInfo.isUnemployed
                      ? "NOT_WORKING"
                      : empInfo.isIndependent
                      ? "SELF_EMPLOYED"
                      : "EMPLOYED");
                  const rucVal = empInfo.companyTaxId ?? "";
                  const companyNameVal = empInfo.companyName ?? "";

                  const setEmploymentMode = (mode: "EMPLOYED" | "SELF_EMPLOYED" | "NOT_WORKING") => {
                    setCorrectionDraft((prev) => {
                      let next = writePath(prev, "employmentInformation.employmentStatus", mode);
                      if (mode === "EMPLOYED") {
                        next = writePath(next, "employmentInformation.isIndependent", false);
                        next = writePath(next, "employmentInformation.isUnemployed", false);
                      } else if (mode === "SELF_EMPLOYED") {
                        next = writePath(next, "employmentInformation.isIndependent", true);
                        next = writePath(next, "employmentInformation.isUnemployed", false);
                      } else {
                        next = writePath(next, "employmentInformation.isIndependent", false);
                        next = writePath(next, "employmentInformation.isUnemployed", true);
                        next = writePath(next, "employmentInformation.companyTaxId", "");
                        next = writePath(next, "employmentInformation.companyName", "");
                        next = writePath(next, "employmentInformation.workingAddress", "");
                      }
                      return next;
                    });
                    setRucFeedback(null);
                    setRucState("IDLE");
                  };

                  return (
                    <div
                      key={path}
                      className="col-span-1 sm:col-span-2 space-y-4 rounded-2xl border border-slate-200 bg-slate-50/50 p-4"
                    >
                      <div>
                        <span className="text-xs font-bold uppercase tracking-wider text-[#A67C00] block mb-1">
                          Situación Laboral
                        </span>
                        <p className="text-xs text-slate-500">
                          Seleccione su condición laboral y actualice la información requerida.
                        </p>
                      </div>

                      {/* Selector de situación laboral */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <button
                          type="button"
                          onClick={() => setEmploymentMode("EMPLOYED")}
                          className={`flex items-center gap-2 p-3 rounded-xl border text-left text-xs font-semibold transition ${
                            currentStatus === "EMPLOYED"
                              ? "border-[#C5A059] bg-[#FFF9EC] text-slate-900 shadow-sm"
                              : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                          }`}
                        >
                          <Building2
                            className={`w-4 h-4 shrink-0 ${
                              currentStatus === "EMPLOYED" ? "text-[#C5A059]" : "text-slate-400"
                            }`}
                          />
                          <span>En una empresa</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setEmploymentMode("SELF_EMPLOYED")}
                          className={`flex items-center gap-2 p-3 rounded-xl border text-left text-xs font-semibold transition ${
                            currentStatus === "SELF_EMPLOYED"
                              ? "border-[#C5A059] bg-[#FFF9EC] text-slate-900 shadow-sm"
                              : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                          }`}
                        >
                          <BriefcaseBusiness
                            className={`w-4 h-4 shrink-0 ${
                              currentStatus === "SELF_EMPLOYED" ? "text-[#C5A059]" : "text-slate-400"
                            }`}
                          />
                          <span>Independiente</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setEmploymentMode("NOT_WORKING")}
                          className={`flex items-center gap-2 p-3 rounded-xl border text-left text-xs font-semibold transition ${
                            currentStatus === "NOT_WORKING"
                              ? "border-emerald-500 bg-emerald-50 text-emerald-900 shadow-sm"
                              : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                          }`}
                        >
                          <UserMinus
                            className={`w-4 h-4 shrink-0 ${
                              currentStatus === "NOT_WORKING" ? "text-emerald-600" : "text-slate-400"
                            }`}
                          />
                          <span>No laborando</span>
                        </button>
                      </div>

                      {currentStatus === "NOT_WORKING" ? (
                        <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 font-medium">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span>
                            Ha indicado que actualmente no se encuentra laborando. No requiere registrar RUC ni empresa.
                          </span>
                        </div>
                      ) : (
                        <div className="space-y-3 pt-1">
                          {/* Input RUC con botón Consultar */}
                          <div>
                            <label className="text-xs font-semibold text-slate-700 block mb-1">
                              {currentStatus === "EMPLOYED" ? "RUC de la Empresa" : "RUC (Opcional)"}
                            </label>
                            <div className="flex gap-2">
                              <input
                                type="text"
                                maxLength={11}
                                value={rucVal}
                                placeholder="Ingrese RUC de 11 dígitos"
                                onChange={(e) => {
                                  const val = e.target.value.replace(/\D/g, "").slice(0, 11);
                                  setCorrectionDraft((prev) =>
                                    writePath(prev, "employmentInformation.companyTaxId", val)
                                  );
                                  setRucState("IDLE");
                                  setRucFeedback(null);
                                }}
                                className="flex-1 h-10 px-3 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#C5A059] bg-white"
                              />
                              <button
                                type="button"
                                onClick={searchRucInCorrection}
                                disabled={isSearchingRuc || rucVal.length !== 11}
                                className="h-10 px-4 rounded-xl bg-[#C5A059] hover:bg-[#A67C00] text-white text-xs font-bold transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
                              >
                                <Search className="w-3.5 h-3.5" />
                                {isSearchingRuc ? "Buscando..." : "Consultar SUNAT"}
                              </button>
                            </div>
                            {rucFeedback && (
                              <p
                                className={`mt-1.5 text-xs font-medium ${
                                  rucState === "VERIFIED" ? "text-emerald-700" : "text-amber-700"
                                }`}
                              >
                                {rucFeedback}
                              </p>
                            )}
                          </div>

                          {/* Nombre de la empresa vinculado */}
                          <div>
                            <label className="text-xs font-semibold text-slate-700 block mb-1">
                              {currentStatus === "EMPLOYED"
                                ? "Nombre / Razón Social de la Empresa"
                                : "Nombre Comercial / Razón Social"}
                            </label>
                            <input
                              type="text"
                              value={companyNameVal}
                              onChange={(e) =>
                                setCorrectionDraft((prev) =>
                                  writePath(prev, "employmentInformation.companyName", e.target.value)
                                )
                              }
                              placeholder="Nombre de la empresa"
                              className="w-full h-10 px-3 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#C5A059] bg-white"
                            />
                            {rucState === "VERIFIED" && (
                              <p className="mt-1 text-[11px] text-emerald-600 font-medium">
                                ✓ Obtenido desde SUNAT
                              </p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                }

                // Si se observó companyName pero ya está integrado en companyTaxId, lo omitimos para no duplicar
                if (fieldKey === "companyName" && observedFields.some((p) => p.endsWith("companyTaxId"))) {
                  return null;
                }

                // ── Campo de texto general ──
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
