"use client";

import { useEffect, useState, forwardRef, useImperativeHandle, useRef, ChangeEvent } from "react";
import { GraduationCap, PlusCircle, CheckCircle2, Search, ChevronDown, FileText, Info, UploadCloud, AlertTriangle, XCircle } from "lucide-react";
import type { ApplicationDraft } from "../../Models/ApplicationDraft";
import type { AcademicStudy } from "../../Models/AcademicStudy";
import { AcademicStudyValidator } from "../../Validators/AcademicStudyValidator";
import { MembershipType } from "../../Types/MembershipType";
import { applicationApi } from "../../Services/ApplicationApi";

export interface StepRef {
  submit: () => Promise<void>;
}

interface EducationStepProps {
  membershipType: MembershipType;
  value?: ApplicationDraft["academicStudies"];
  saving?: boolean;
  onSave(studies: ApplicationDraft["academicStudies"]): Promise<void>;
  onNext(): void;
  onBack(): void;
  onValidityChange?: (isValid: boolean) => void;
  onFinalSubmit?: () => Promise<void>; // 👈 Se agrega para el envío del estudiante
}

interface CatalogItem {
  id: number | string;
  name: string;
}

const emptyStudy: AcademicStudy = {
  institutionId: undefined,
  otherInstitution: "",
  degreeTitle: "",
  specialty: "",
  professionalAssociation: "",
  registrationNumber: "",
  admissionYear: undefined,
  graduationYear: undefined,
  sectorExperience: "",
  observations: "",
  universityLetter: null,
  studentTermsAccepted: false,
};

// ========================================================
// COMPONENTE: SELECT CON BÚSQUEDA INTEGRADA 
// ========================================================
const SearchableSelect = ({ options, value, onChange, onBlur, disabled, placeholder, hasError, emptyMessage = "No se encontraron resultados" }: any) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        if (isOpen && onBlur) {
            onBlur();
        }
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [isOpen, onBlur]);

  const selectedOption = options.find((o: any) => o.id === value);
  const filteredOptions = options.filter((o: any) => o.name.toLowerCase().includes(searchTerm.toLowerCase()));
  const baseClass = disabled ? "bg-gray-50 border-gray-200 text-slate-400 cursor-not-allowed" : hasError ? "border-red-500 bg-red-50/30 text-red-900" : "border-gray-300 bg-white text-slate-700 hover:border-[#C5A059]";

  return (
    // 👇 FIX 1: Agregamos z-index dinámico para que no se esconda detrás de otros inputs
    <div className={`relative w-full ${isOpen ? "z-[100]" : "z-10"}`} ref={containerRef}>
      <div className={`w-full h-11 px-3 rounded-xl border flex items-center justify-between transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[#C5A059]/20 font-medium text-sm ${baseClass} ${!disabled ? "cursor-pointer" : ""}`} onClick={() => { if (!disabled) { setIsOpen(!isOpen); setSearchTerm(""); } }}>
        <span className={`truncate ${!selectedOption ? "text-gray-400 font-normal" : ""}`}>{selectedOption ? selectedOption.name : placeholder}</span>
        <ChevronDown size={16} className={`transition-transform duration-200 ${isOpen ? "rotate-180 text-[#C5A059]" : "text-gray-400"}`} />
      </div>
      {isOpen && !disabled && (
        <div className="absolute z-[110] w-full mt-2 bg-white border border-gray-200 rounded-xl shadow-[0_10px_40px_-15px_rgba(0,0,0,0.15)] flex flex-col overflow-hidden animate-in fade-in slide-in-from-top-2">
          <div className="p-2 border-b border-gray-100 bg-gray-50/50">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input type="text" className="w-full bg-white border border-gray-200 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-[#C5A059] focus:ring-1 focus:ring-[#C5A059]/30 transition-all placeholder:text-gray-400" placeholder="Buscar..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} onClick={(e) => e.stopPropagation()} autoFocus />
            </div>
          </div>
          <div className="overflow-y-auto max-h-56 p-1 scrollbar-thin scrollbar-thumb-gray-200 scrollbar-track-transparent">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((option: any) => (
                <div key={option.id} className={`px-3 py-2.5 text-sm rounded-lg cursor-pointer transition-colors flex items-center justify-between ${value === option.id ? "bg-[#C5A059]/10 text-[#C5A059] font-bold" : "hover:bg-gray-50 text-slate-700 font-medium"}`} onClick={() => { onChange(option.id); setIsOpen(false); }}>
                  <span className="truncate pr-2">{option.name}</span>
                  {value === option.id && <CheckCircle2 size={14} className="shrink-0" />}
                </div>
              ))
            ) : (
              <div className="px-3 py-4 text-sm text-gray-400 text-center flex flex-col items-center gap-2"><Search size={20} className="opacity-20" />{emptyMessage}</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const EducationStep = forwardRef<StepRef, EducationStepProps>(
  ({ membershipType, value, saving = false, onSave, onNext, onBack, onValidityChange, onFinalSubmit }, ref) => {
    
    const [form, setForm] = useState<AcademicStudy>(value && value.length > 0 ? value[0] : emptyStudy);
    const [touched, setTouched] = useState<Record<string, boolean>>({});
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [globalError, setGlobalError] = useState<string | null>(null);

    const [universities, setUniversities] = useState<CatalogItem[]>([]);
    const [specialties, setSpecialties] = useState<CatalogItem[]>([]);

    // Estados para Estudiantes
    const isStudent = membershipType === MembershipType.STUDENT;
    const [cartaFilePreview, setCartaFilePreview] = useState<{ name: string; url: string; type: string } | null>(null);
    const [rawFile, setRawFile] = useState<File | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [showConfirmModal, setShowConfirmModal] = useState(false);

    useEffect(() => {
      if (value && value.length > 0) setForm(value[0]);
    }, [value]);

    useEffect(() => {
      fetch("/api/catalogs/universities").then(res => res.json()).then(data => setUniversities([...data, { id: 0, name: "Otra" }]));
      fetch("/api/catalogs/specialties").then(res => res.json()).then(data => setSpecialties(data));
    }, []);

    // Cargar preview de S3 si ya existía
   // Cargar preview de S3 si ya existía
    useEffect(() => {
      const fetchSecureUrl = async () => {
        const fileUrl = (form.universityLetter as any)?.url;
        
        // 👇 SOLUCIÓN: Solo consultar S3 si la URL empieza con http (ignorando "PENDIENTE")
        if (form.universityLetter && !(form.universityLetter instanceof File) && fileUrl && fileUrl.startsWith("http")) {
          try {
            const secureUrl = await applicationApi.getSecureFileUrl(fileUrl);
            setCartaFilePreview({
              name: (form.universityLetter as any).name || "Constancia.pdf",
              url: secureUrl,
              type: (form.universityLetter as any).type || "application/pdf"
            });
          } catch (e) { console.error("Error al cargar carta de S3"); }
        }
      };
      fetchSecureUrl();
    }, [form.universityLetter]);

    
    useEffect(() => {
      const validator = new AcademicStudyValidator();
      const result = validator.validate(form, membershipType);
      onValidityChange?.(result.valid);
    }, [form, membershipType, onValidityChange]);

    function updateField<K extends keyof AcademicStudy>(field: K, rawValue: AcademicStudy[K]) {
      let sanitizedValue: any = rawValue;
      let instantWarning = "";

      if (typeof rawValue === "string") {
        if (field === "degreeTitle" || field === "otherInstitution" || field === "sectorExperience") {
          sanitizedValue = rawValue.replace(/[^A-Za-z 0-9\s.,\-()]/g, "").slice(0, 200);
        } else if (field === "professionalAssociation") {
          sanitizedValue = rawValue.replace(/[^A-Za-z \s.-]/g, "").slice(0, 100);
        } else if (field === "registrationNumber") {
          sanitizedValue = rawValue.replace(/\D/g, "").slice(0, 15);
        }
      }
      if (field === "admissionYear" || field === "graduationYear") {
        const cleaned = String(rawValue ?? "").replace(/\D/g, "").slice(0, 4);
        sanitizedValue = cleaned === "" ? undefined : Number(cleaned);
      }

      const newForm = { ...form, [field]: sanitizedValue };
      if (field === "institutionId" && rawValue !== 0) newForm.otherInstitution = "";
      
      setTouched((prev) => ({ ...prev, [field]: true }));
      setGlobalError(null);
      setForm(newForm);

      const validator = new AcademicStudyValidator();
      const result = validator.validate(newForm, membershipType);
      const fieldError = result.errors.find((err) => err.field === field);
      setErrors((prev) => ({ ...prev, [field]: instantWarning || (fieldError ? fieldError.message : "") }));
    }

    function handleBlur(field: keyof AcademicStudy) {
        setTouched((prev) => ({ ...prev, [field]: true }));
    }

    const handleCartaChange = (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        const objectUrl = URL.createObjectURL(file);
        setCartaFilePreview({ name: file.name, url: objectUrl, type: file.type });
        setRawFile(file);
        updateField("universityLetter", { name: file.name, type: file.type, url: "PENDIENTE" } as any);
      }
    };

    useImperativeHandle(ref, () => ({
      submit: async () => {
        setGlobalError(null);
        const allTouched: Record<string, boolean> = {};
        Object.keys(emptyStudy).forEach((key) => (allTouched[key] = true));
        setTouched(allTouched);

        const validator = new AcademicStudyValidator();
        const result = validator.validate(form, membershipType);

        if (!result.valid) {
          const newErrors: Record<string, string> = {};
          result.errors.forEach((err) => { newErrors[err.field] = err.message; });
          setErrors(newErrors);
          return;
        }

        if (isStudent && onFinalSubmit) {
          setShowConfirmModal(true);
        } else {
          try {
            await onSave([form]);
            onNext();
          } catch (error: any) {
            setGlobalError(error.message || "Error al guardar los datos.");
          }
        }
      },
    }));

    const handleConfirmSubmit = async () => {
      setShowConfirmModal(false);
      try {
        setIsUploading(true);
        let updatedForm = { ...form };

        if (rawFile) {
          const uploaded = await applicationApi.uploadFile(rawFile, "afiliaciones/estudiantes");
          updatedForm.universityLetter = uploaded as any; 
        }

        await onSave([updatedForm]);
        if (onFinalSubmit) await onFinalSubmit();
      } catch (error: any) {
        setGlobalError(error.message || "Error al enviar la solicitud.");
      } finally {
        setIsUploading(false);
      }
    };

    const getInputClass = (field: keyof AcademicStudy) => {
      const hasError = touched[field] && errors[field];
      return `w-full h-11 px-3 rounded-xl border focus:outline-none focus:ring-2 font-medium text-sm transition-colors ${hasError ? "border-red-500 focus:ring-red-200 bg-red-50/30 text-red-900" : "border-gray-300 focus:border-[#C5A059] focus:ring-[#C5A059]/20 bg-white text-slate-700"}`;
    };

    const getErrorText = (field: keyof AcademicStudy) => {
      return touched[field] && errors[field] ? <span className="text-red-500 text-xs mt-1.5 font-bold block">{errors[field]}</span> : null;
    };

    return (
      <div className="space-y-8">
        
        {showConfirmModal && (
          <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl animate-in zoom-in-95">
              <div className="w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center mb-6 mx-auto">
                <AlertTriangle className="w-8 h-8 text-amber-600" />
              </div>
              <h3 className="text-xl font-bold text-center text-[#2F3136] mb-3">¿Enviar Postulación?</h3>
              <p className="text-sm text-gray-500 text-center mb-8 leading-relaxed">
                Está a punto de enviar su solicitud como Estudiante para que sea revisada. <strong>Ya no podrá realizar modificaciones.</strong>
              </p>
              <div className="flex flex-col gap-3">
                <button onClick={handleConfirmSubmit} className="w-full h-12 bg-gradient-to-r from-[#C5A059] to-[#9E7832] text-white rounded-xl font-bold text-sm shadow-md hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2">
                  Sí, enviar solicitud
                </button>
                <button onClick={() => setShowConfirmModal(false)} className="w-full h-12 bg-white border border-gray-200 text-gray-600 rounded-xl font-bold text-sm hover:bg-gray-50 transition-colors">
                  Cancelar y revisar
                </button>
              </div>
            </div>
          </div>
        )}

        {isUploading && (
          <div className="fixed inset-0 z-[200] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl p-8 flex flex-col items-center shadow-2xl animate-in zoom-in-95">
              <svg className="animate-spin h-12 w-12 text-[#C5A059] mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
              <h3 className="text-lg font-bold text-[#2F3136]">Procesando solicitud...</h3>
              <p className="text-sm text-gray-500 mt-2">Asegurando documentos y enviando expediente.</p>
            </div>
          </div>
        )}

        {globalError && (
          <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-600 font-bold text-sm flex items-center gap-3 shadow-sm">
            <XCircle className="w-5 h-5 shrink-0" /> {globalError}
          </div>
        )}

        {/* SECCIÓN 1: DATOS ACADÉMICOS */}
        {/* 👇 FIX 2: Quitamos overflow-hidden para que el menú pueda salir de la tarjeta */}
        <section className="bg-white rounded-3xl border border-gray-200 shadow-sm relative z-20">
          {/* 👇 FIX 3: Agregamos rounded-t-3xl a la cabecera gris para mantener los bordes redondos */}
          <div className="px-8 py-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50 rounded-t-3xl">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-[#C5A059]/10 flex items-center justify-center">
                <GraduationCap className="w-5 h-5 text-[#C5A059]" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-[#2F3136] tracking-tight">{isStudent ? "Centro de Estudios" : "Estudios Académicos"}</h2>
                <p className="text-xs text-gray-500 font-medium">Ingrese su {isStudent ? "universidad y especialidad" : "grado, especialidad y universidad"}.</p>
              </div>
            </div>
          </div>
          <div className="p-8">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
              
              <div className="xl:col-span-2">
                <label className="text-xs font-bold text-slate-700 mb-1.5 block uppercase tracking-wide">
                  Universidad / Instituto <span className="text-red-500">*</span>
                </label>
                <SearchableSelect options={universities} placeholder="Seleccione institución" value={form.institutionId} onChange={(val: any) => updateField("institutionId", val === "" ? undefined : Number(val))} onBlur={() => handleBlur("institutionId")} hasError={touched.institutionId && !!errors.institutionId} />
                {getErrorText("institutionId")}
              </div>

              <div className="xl:col-span-2">
                <label className="text-xs font-bold text-slate-700 mb-1.5 block uppercase tracking-wide">
                  Otra Institución {form.institutionId === 0 && <span className="text-red-500">*</span>}
                </label>
                <input type="text" placeholder="Especifique institución si eligió 'Otra'" disabled={form.institutionId !== 0} value={form.otherInstitution || ""} onChange={(e) => updateField("otherInstitution", e.target.value)} onBlur={() => handleBlur("otherInstitution")} className={getInputClass("otherInstitution")} />
                {getErrorText("otherInstitution")}
              </div>

              {/* Título (Solo para Activos) */}
              {!isStudent && (
                <div className="xl:col-span-2">
                  <label className="text-xs font-bold text-slate-700 mb-1.5 block uppercase tracking-wide">
                    Título o Grado <span className="text-red-500">*</span>
                  </label>
                  <input type="text" placeholder="Ej. Título de Ingeniero de Minas" value={form.degreeTitle} onChange={(e) => updateField("degreeTitle", e.target.value)} onBlur={() => handleBlur("degreeTitle")} className={getInputClass("degreeTitle")} />
                  {getErrorText("degreeTitle")}
                </div>
              )}

              <div className="xl:col-span-2">
                <label className="text-xs font-bold text-slate-700 mb-1.5 block uppercase tracking-wide">
                  Especialidad <span className="text-red-500">*</span>
                </label>
                <SearchableSelect options={specialties.map(s => ({ id: s.name, name: s.name }))} placeholder="Seleccione especialidad" value={form.specialty} onChange={(val: any) => updateField("specialty", val)} onBlur={() => handleBlur("specialty")} hasError={touched.specialty && !!errors.specialty} />
                {getErrorText("specialty")}
              </div>

              {/* Campos Exclusivos de Profesionales */}
              {!isStudent && (
                <>
                  <div>
                    <label className="text-xs font-bold text-slate-700 mb-1.5 block uppercase tracking-wide">Colegio Profesional <span className="text-red-500">*</span></label>
                    <input type="text" placeholder="Ej. CIP" value={form.professionalAssociation || ""} onChange={(e) => updateField("professionalAssociation", e.target.value)} onBlur={() => handleBlur("professionalAssociation")} className={getInputClass("professionalAssociation")} />
                    {getErrorText("professionalAssociation")}
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-700 mb-1.5 block uppercase tracking-wide">Nro Colegiatura <span className="text-red-500">*</span></label>
                    <input type="text" placeholder="N° de Registro" value={form.registrationNumber || ""} onChange={(e) => updateField("registrationNumber", e.target.value)} onBlur={() => handleBlur("registrationNumber")} className={getInputClass("registrationNumber")} />
                    {getErrorText("registrationNumber")}
                  </div>
                </>
              )}

              {/* Años (Común, pero adaptado visualmente) */}
              <div>
                <label className="text-xs font-bold text-slate-700 mb-1.5 block uppercase tracking-wide">
                  Año de {isStudent ? 'Ingreso' : 'Ingreso'} {isStudent && <span className="text-red-500">*</span>}
                </label>
                <input type="text" placeholder="YYYY" value={form.admissionYear ?? ""} onChange={(e) => updateField("admissionYear", e.target.value as any)} onBlur={() => handleBlur("admissionYear")} className={getInputClass("admissionYear")} />
                {getErrorText("admissionYear")}
              </div>

              {!isStudent && (
                <div>
                  <label className="text-xs font-bold text-slate-700 mb-1.5 block uppercase tracking-wide">Año de Egreso</label>
                  <input type="text" placeholder="YYYY" value={form.graduationYear ?? ""} onChange={(e) => updateField("graduationYear", e.target.value as any)} onBlur={() => handleBlur("graduationYear")} className={getInputClass("graduationYear")} />
                  {getErrorText("graduationYear")}
                </div>
              )}

            </div>
          </div>
        </section>

        {/* SECCIÓN 2: EXCLUSIVA PARA ESTUDIANTES (Carga de constancia) */}
        {isStudent && (
          /* 👇 FIX 4: Al igual que arriba, quitamos overflow-hidden aquí por consistencia */
          <section className="bg-white rounded-3xl border border-gray-200 shadow-sm relative z-10">
            {/* 👇 FIX 5: Añadido rounded-t-3xl a la cabecera */}
            <div className="px-8 py-5 border-b border-gray-100 flex items-center gap-4 bg-gray-50/50 rounded-t-3xl">
              <div className="w-10 h-10 rounded-xl bg-[#C5A059]/10 flex items-center justify-center">
                <FileText className="w-5 h-5 text-[#C5A059]" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-[#2F3136] tracking-tight">Carta de la Universidad y Beneficios</h2>
                <p className="text-xs text-gray-500 font-medium">Adjunte el documento que acredite su condición de estudiante.</p>
              </div>
            </div>

            <div className="p-8">
              <div className="bg-[#FFFDF8] border border-[#E8D09E] rounded-xl p-5 mb-8 flex items-start gap-4">
                <Info className="w-6 h-6 text-[#C5A059] shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-bold text-[#4a2d00] mb-1">Sobre la Membresía Estudiantil</h4>
                  <p className="text-sm text-[#7f561e] leading-relaxed">
                    La afiliación estudiantil es <strong>gratuita durante su periodo de pregrado</strong>. Para renovar su membresía anual, deberá presentar una constancia emitida por su centro de estudios.
                  </p>
                </div>
              </div>

              <div className="mb-8 pl-1">
                <label className="flex items-start gap-3 cursor-pointer group">
                  <input 
                    type="checkbox" 
                    checked={form.studentTermsAccepted || false}
                    onChange={(e) => updateField("studentTermsAccepted", e.target.checked as any)}
                    className="mt-0.5 w-5 h-5 rounded border-gray-300 text-[#C5A059] focus:ring-[#C5A059]"
                  />
                  <span className="text-sm text-[#2F3136] font-medium transition-colors">
                    He leído y acepto las condiciones de la afiliación estudiantil gratuita. <span className="text-red-500">*</span>
                  </span>
                </label>
                {getErrorText("studentTermsAccepted")}
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 mb-3 block uppercase tracking-wide">
                  Adjuntar constancia o carta de la universidad <span className="text-red-500">*</span>
                </label>
                <label className={`group cursor-pointer relative overflow-hidden h-[260px] w-full border-2 border-dashed rounded-2xl p-6 transition-all duration-300 flex flex-col items-center justify-center text-center ${touched.universityLetter && errors.universityLetter ? "border-red-400 bg-red-50/30" : "border-gray-300 hover:border-[#C5A059] hover:bg-gray-50"}`}>
                  <input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={handleCartaChange} className="hidden" />
                  
                  {cartaFilePreview ? (
                    cartaFilePreview.type.startsWith('image/') ? (
                      <div className="w-full h-full absolute inset-0 bg-black/5 flex items-center justify-center">
                        <img src={cartaFilePreview.url} alt="Carta Preview" className="w-full h-full object-cover opacity-90 group-hover:opacity-60 transition-opacity" />
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40 backdrop-blur-sm cursor-pointer">
                          <span className="bg-white/90 px-4 py-2 rounded-xl text-sm font-bold text-[#2F3136] flex items-center gap-2 shadow-lg">
                            <UploadCloud size={16} /> Cambiar Documento
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="w-full h-full absolute inset-0 bg-white flex flex-col items-center justify-center overflow-hidden">
                        <iframe src={`${cartaFilePreview.url}#toolbar=0&navpanes=0&scrollbar=0`} className="w-full h-full pointer-events-none" />
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40 backdrop-blur-sm cursor-pointer">
                          <span className="bg-white/90 px-4 py-2 rounded-xl text-sm font-bold text-[#2F3136] flex items-center gap-2 shadow-lg">
                            <UploadCloud size={16} /> Cambiar Documento (PDF)
                          </span>
                        </div>
                      </div>
                    )
                  ) : (
                    <>
                      <div className="w-14 h-14 rounded-full bg-gray-100 text-gray-400 flex items-center justify-center mb-4 group-hover:bg-[#C5A059]/10 group-hover:text-[#C5A059] transition-colors">
                        <FileText className="w-6 h-6" />
                      </div>
                      <h3 className="text-sm font-bold text-[#2F3136] mb-1">Adjuntar Constancia</h3>
                      <p className="text-xs text-gray-500 mb-4 max-w-[200px]">Archivos PDF, JPG o PNG. Peso máximo: 3MB.</p>
                      <div className="inline-flex items-center gap-2 text-[#C5A059] font-bold text-xs uppercase tracking-wider">
                        <UploadCloud size={16} /> Seleccionar Archivo
                      </div>
                    </>
                  )}
                </label>
                {getErrorText("universityLetter")}
              </div>
            </div>
          </section>
        )}

      </div>
    );
  }
);

EducationStep.displayName = "EducationStep";

export default EducationStep;