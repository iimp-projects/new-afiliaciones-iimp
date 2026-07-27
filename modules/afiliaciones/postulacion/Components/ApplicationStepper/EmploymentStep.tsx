"use client";

import { useEffect, useState, forwardRef, useImperativeHandle } from "react";
import { Briefcase, PlusCircle, CheckCircle2, Search, Building2, Info, XCircle } from "lucide-react";
import type { ApplicationDraft } from "../../Models/ApplicationDraft";
import type { EmploymentInformation } from "../../Models/EmploymentInformation";
import { EmploymentInformationValidator } from "../../Validators/EmploymentInformationValidator";
import { applicationApi } from "../../Services/ApplicationApi";

export interface StepRef {
  submit: () => Promise<void>;
}

interface EmploymentStepProps {
  value?: ApplicationDraft["employmentInformation"];
  saving?: boolean;
  onSave(employmentInfo: ApplicationDraft["employmentInformation"]): Promise<void>;
  onNext(): void;
  onBack(): void;
  onValidityChange?: (isValid: boolean) => void;
}

const emptyEmployment: EmploymentInformation = {
  isIndependent: false,
  isUnemployed: false,
  companyId: undefined,
  companyName: "",
  area: "",
  positionId: undefined,
  positionName: "",
  companyTaxId: "",
  workPhone: "",
  workExtension: "",
  workEmail: "",
  workingAddress: "",
};

const EmploymentStep = forwardRef<StepRef, EmploymentStepProps>(
  ({ value, saving = false, onSave, onNext, onBack, onValidityChange }, ref) => {
    
    const [form, setForm] = useState<EmploymentInformation>(value ?? emptyEmployment);
    
    // Estados visuales y errores
    const [touched, setTouched] = useState<Record<string, boolean>>({});
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [globalError, setGlobalError] = useState<string | null>(null);
    
    // Estado fundamental: Controla si los campos inferiores están habilitados
    const [isFormEnabled, setIsFormEnabled] = useState(false);

    // Estados para la Búsqueda en SUNAT
    const [isSearchingRuc, setIsSearchingRuc] = useState(false);
    const [rucFeedback, setRucFeedback] = useState<{ type: 'success' | 'warning', message: string } | null>(null);

    useEffect(() => {
      if (value) {
        setForm(value);
        // Si ya hay data precargada (borrador), habilitamos el formulario inferior
        if (value.companyName || value.companyTaxId) {
          setIsFormEnabled(true);
        }
      }
    }, [value]);

    // Validación continua en tiempo real
    useEffect(() => {
      const validator = new EmploymentInformationValidator();
      const result = validator.validate(form);
      onValidityChange?.(result.valid);
    }, [form, onValidityChange]);

    // ========================================================
    // LÓGICA DE BÚSQUEDA EN SUNAT
    // ========================================================
    const handleSearchRuc = async () => {
      setTouched((prev) => ({ ...prev, companyTaxId: true }));
      
      const currentRuc = form.companyTaxId || "";
      
      if (currentRuc.length !== 11) {
        setGlobalError("Ingrese un RUC válido de 11 dígitos para consultar.");
        return;
      }

      setIsSearchingRuc(true);
      setGlobalError(null);
      setRucFeedback(null);

      try {
        const data = await applicationApi.validateRuc(currentRuc);
        
        if (data && data.razonSocial) {
          setRucFeedback({ type: 'success', message: 'Empresa identificada exitosamente desde SUNAT. Ya puede completar los demás campos.' });
          setForm(prev => ({
            ...prev,
            companyName: data.razonSocial,
            workingAddress: data.direccion || prev.workingAddress,
          }));
          setIsFormEnabled(true); // Se habilitan los campos
        } else {
          setRucFeedback({ type: 'warning', message: 'RUC no encontrado o inactivo. Hemos habilitado el formulario para que ingrese los datos manualmente.' });
          setIsFormEnabled(true); // Se habilitan los campos para ingreso manual
        }
      } catch (err: any) {
        setGlobalError("Ocurrió un error al consultar el RUC. Hemos habilitado el formulario para que ingrese los datos manualmente.");
        setIsFormEnabled(true); // Se habilitan los campos para ingreso manual
      } finally {
        setIsSearchingRuc(false);
      }
    };

    // Controlador de inputs y enmascaramiento estricto
    function updateField<K extends keyof EmploymentInformation>(
      field: K, 
      rawValue: EmploymentInformation[K]
    ) {
      let sanitizedValue: any = rawValue;
      let instantWarning = "";

      if (typeof rawValue === "string") {
        if (["companyName", "area", "positionName", "workingAddress"].includes(field)) {
          sanitizedValue = rawValue.replace(/[^A-Za-zÁÉÍÓÚáéíóúÑñ0-9\s.,\-#°/]/g, "").slice(0, 250);
          if (rawValue !== sanitizedValue) instantWarning = "Caracteres especiales no permitidos.";
        } else if (field === "companyTaxId") {
          sanitizedValue = rawValue.replace(/\D/g, "").slice(0, 11);
          if (rawValue !== sanitizedValue) instantWarning = "El RUC solo debe contener números.";
        } else if (field === "workPhone") {
          sanitizedValue = rawValue.replace(/[^0-9+\s\-()]/g, "").slice(0, 20);
          if (rawValue !== sanitizedValue) instantWarning = "Formato de teléfono inválido.";
        } else if (field === "workExtension") {
          sanitizedValue = rawValue.replace(/\D/g, "").slice(0, 10);
          if (rawValue !== sanitizedValue) instantWarning = "Solo números en el anexo.";
        }
      }

      const newForm = { ...form, [field]: sanitizedValue };

      setTouched((prev) => ({ ...prev, [field]: true }));
      setGlobalError(null);
      
      // Si el usuario edita el RUC después de buscar, quitamos el mensaje de éxito
      if (field === "companyTaxId") {
        setRucFeedback(null);
        setIsFormEnabled(false); // Volvemos a bloquear hasta que busque de nuevo
      }

      setForm(newForm);

      const validator = new EmploymentInformationValidator();
      const result = validator.validate(newForm);
      const fieldError = result.errors.find((err) => err.field === field);

      setErrors((prev) => ({
        ...prev,
        [field]: instantWarning || (fieldError ? fieldError.message : ""),
      }));
    }

    function handleBlur(field: keyof EmploymentInformation) {
      setTouched((prev) => ({ ...prev, [field]: true }));
    }

    useImperativeHandle(ref, () => ({
      submit: async () => {
        setGlobalError(null);

        const allTouched: Record<string, boolean> = {};
        Object.keys(emptyEmployment).forEach((key) => (allTouched[key] = true));
        setTouched(allTouched);

        const validator = new EmploymentInformationValidator();
        const result = validator.validate(form);

        if (!result.valid) {
          const newErrors: Record<string, string> = {};
          result.errors.forEach((err) => { newErrors[err.field] = err.message; });
          setErrors(newErrors);
          return;
        }

        try {
          await onSave(form);
          onNext();
        } catch (error: any) {
          setGlobalError(error.message || "Error al conectar con el servidor.");
        }
      },
    }));

    const getInputClass = (field: keyof EmploymentInformation) => {
      const disabled = !isFormEnabled;
      const hasError = touched[field] && errors[field];
      
      if (disabled) {
        return "w-full h-11 px-3 rounded-xl border border-gray-200 bg-gray-50 text-slate-400 cursor-not-allowed focus:outline-none transition-colors";
      }

      return `w-full h-11 px-3 rounded-xl border focus:outline-none focus:ring-2 font-medium text-sm transition-colors ${
        hasError
          ? "border-red-500 focus:ring-red-200 bg-red-50/30 text-red-900"
          : "border-gray-300 focus:border-[#C5A059] focus:ring-[#C5A059]/20 bg-white text-slate-700"
      }`;
    };

    const getSearchInputClass = (field: keyof EmploymentInformation) => {
      const hasError = touched[field] && errors[field];
      return `w-full h-12 px-4 text-sm focus:outline-none focus:ring-2 relative focus:z-10 font-medium transition-colors rounded-l-xl border-r-0 ${
        hasError
          ? "border border-red-500 focus:ring-red-200 bg-red-50/30 text-red-900 placeholder:text-red-400"
          : "border border-gray-300 focus:border-[#C5A059] focus:ring-[#C5A059]/20 bg-white text-slate-700"
      }`;
    };

    const getErrorText = (field: keyof EmploymentInformation) => {
      return touched[field] && errors[field] ? (
        <span className="text-red-500 text-xs mt-1.5 font-bold block animate-in fade-in slide-in-from-top-1">{errors[field]}</span>
      ) : null;
    };

    return (
      <div className="space-y-8">
        
        {globalError && (
          <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-600 font-bold text-sm flex items-center gap-3 shadow-sm">
            <XCircle className="w-5 h-5 shrink-0" /> {globalError}
          </div>
        )}

        {rucFeedback && (
          <div className={`p-4 rounded-xl border font-bold text-sm flex items-center gap-3 shadow-sm ${rucFeedback.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-amber-50 border-amber-200 text-amber-700'}`}>
            {rucFeedback.type === 'success' ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <Info className="w-5 h-5 shrink-0" />}
            {rucFeedback.message}
          </div>
        )}

        {/* ==========================================
            TARJETA 1: INTEGRACIÓN SUNAT
        ========================================== */}
        <section className="bg-[#FCFAF6] rounded-3xl p-6 sm:p-8 shadow-sm border border-[#E8D09E]/50">
          <div className="flex flex-col md:flex-row justify-between md:items-start gap-6 border-b border-[#E8D09E]/30 pb-6 mb-8">
            <div className="flex items-start gap-5">
              <div className="w-14 h-14 shrink-0 rounded-full border-2 border-[#D6A84A] flex items-center justify-center bg-white shadow-sm">
                <Building2 size={28} className="text-[#C5A059]" />
              </div>
              <div>
                <span className="inline-block px-3 py-1 rounded-full bg-[#F4E9D8] text-[#A67C00] text-[10px] font-bold uppercase tracking-widest mb-2">
                  Integración SUNAT
                </span>
                <h2 className="text-2xl font-black text-[#1E293B]">
                  Validación de Empresa
                </h2>
                <p className="text-sm text-gray-500 font-medium mt-1">
                  Consulte automáticamente la información de su centro de trabajo por RUC.
                </p>
              </div>
            </div>

            <div className="hidden md:flex items-center gap-3 opacity-90">
              <Search size={36} className="text-[#C5A059]" />
              <div>
                <h3 className="font-black text-[#C5A059] text-2xl leading-none">
                  SUNAT
                </h3>
                <p className="text-[9px] text-[#C5A059] font-bold uppercase leading-tight mt-1">
                  Consulta de RUC
                  <br />en línea
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-col md:flex-row justify-center items-start gap-6 max-w-2xl mx-auto">
            <div className="w-full">
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5 tracking-wide">
                RUC de la Empresa <span className="text-red-500">*</span>
              </label>
              <div className="flex w-full">
                <input
                  type="text"
                  placeholder="Ingrese el RUC de 11 dígitos"
                  disabled={isSearchingRuc}
                  value={form.companyTaxId || ""}
                  onChange={(e) => updateField("companyTaxId", e.target.value)}
                  onBlur={() => handleBlur("companyTaxId")}
                  className={getSearchInputClass("companyTaxId")}
                />
                <button
                  type="button"
                  onClick={handleSearchRuc}
                  disabled={isSearchingRuc || (form.companyTaxId || "").length !== 11}
                  className={`h-12 px-6 flex items-center justify-center rounded-r-xl transition-all duration-300 border-y border-r shadow-sm z-0 ${
                    isSearchingRuc || (form.companyTaxId || "").length !== 11
                      ? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed shadow-none"
                      : "bg-gray-100 hover:bg-gray-200 text-slate-700 border-gray-300 font-bold"
                  }`}
                >
                  {isSearchingRuc ? (
                    <svg className="animate-spin h-5 w-5 text-slate-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  ) : (
                    <span className="font-bold text-sm tracking-wide flex items-center gap-2">
                      <Search size={18} strokeWidth={2.5} className="text-slate-500" />
                      Consultar
                    </span>
                  )}
                </button>
              </div>
              {getErrorText("companyTaxId")}
            </div>
          </div>
        </section>

        {/* ==========================================
            TARJETA 2: INFORMACIÓN LABORAL
        ========================================== */}
        <section className="bg-white rounded-3xl border border-gray-200 overflow-hidden shadow-sm relative z-20">
          <div className="px-8 py-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-[#C5A059]/10 flex items-center justify-center">
                <Briefcase className="w-5 h-5 text-[#C5A059]" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-[#2F3136] tracking-tight">Datos del Empleo</h2>
                <p className="text-xs text-gray-500 font-medium">Complete la información de su puesto laboral.</p>
              </div>
            </div>
            <div className="hidden sm:flex px-4 py-1.5 rounded-xl bg-[#C5A059]/10 text-[#C5A059] text-xs font-bold uppercase tracking-wider">
              Perfil Laboral
            </div>
          </div>

          <div className="p-8">

            {/* GRID DE INPUTS (Se habilitan solo si isFormEnabled es true) */}
            <div className={`grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 transition-opacity duration-300 ${!isFormEnabled ? 'opacity-60 pointer-events-none' : ''}`}>

              <div className="xl:col-span-2">
                <label className="text-xs font-bold text-slate-700 mb-1.5 block uppercase tracking-wide">
                  Empresa o Institución <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Razón social o nombre comercial"
                  disabled={!isFormEnabled}
                  value={form.companyName || ""}
                  onChange={(e) => updateField("companyName", e.target.value)}
                  onBlur={() => handleBlur("companyName")}
                  className={getInputClass("companyName")}
                />
                {getErrorText("companyName")}
              </div>

              <div className="xl:col-span-2">
                <label className="text-xs font-bold text-slate-700 mb-1.5 block uppercase tracking-wide">
                  Área o Departamento
                </label>
                <input
                  type="text"
                  placeholder="Ej. Gerencia de Operaciones"
                  disabled={!isFormEnabled}
                  value={form.area || ""}
                  onChange={(e) => updateField("area", e.target.value)}
                  onBlur={() => handleBlur("area")}
                  className={getInputClass("area")}
                />
                {getErrorText("area")}
              </div>

              <div className="xl:col-span-2">
                <label className="text-xs font-bold text-slate-700 mb-1.5 block uppercase tracking-wide">
                  Cargo <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Ej. Ingeniero Senior"
                  disabled={!isFormEnabled}
                  value={form.positionName || ""}
                  onChange={(e) => updateField("positionName", e.target.value)}
                  onBlur={() => handleBlur("positionName")}
                  className={getInputClass("positionName")}
                />
                {getErrorText("positionName")}
              </div>

              <div className="xl:col-span-4">
                <label className="text-xs font-bold text-slate-700 mb-1.5 block uppercase tracking-wide">
                  Dirección de la Empresa <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Dirección exacta de la oficina o planta"
                  disabled={!isFormEnabled}
                  value={form.workingAddress || ""}
                  onChange={(e) => updateField("workingAddress", e.target.value)}
                  onBlur={() => handleBlur("workingAddress")}
                  className={getInputClass("workingAddress")}
                />
                {getErrorText("workingAddress")}
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 mb-1.5 block uppercase tracking-wide">
                  Teléfono <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Ej. (01) 123-4567"
                  disabled={!isFormEnabled}
                  value={form.workPhone || ""}
                  onChange={(e) => updateField("workPhone", e.target.value)}
                  onBlur={() => handleBlur("workPhone")}
                  className={getInputClass("workPhone")}
                />
                {getErrorText("workPhone")}
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 mb-1.5 block uppercase tracking-wide">
                  Anexo <span className="text-gray-400 font-normal capitalize">(Opcional)</span>
                </label>
                <input
                  type="text"
                  placeholder="Ej. 101"
                  disabled={!isFormEnabled}
                  value={form.workExtension || ""}
                  onChange={(e) => updateField("workExtension", e.target.value)}
                  className={getInputClass("workExtension")}
                />
                {getErrorText("workExtension")}
              </div>

              <div className="xl:col-span-2">
                <label className="text-xs font-bold text-slate-700 mb-1.5 block uppercase tracking-wide">
                  Correo Corporativo <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  placeholder="nombre@empresa.com"
                  disabled={!isFormEnabled}
                  value={form.workEmail || ""}
                  onChange={(e) => updateField("workEmail", e.target.value)}
                  onBlur={() => handleBlur("workEmail")}
                  className={getInputClass("workEmail")}
                />
                {getErrorText("workEmail")}
              </div>

            </div>

            <div className="mt-8 flex justify-end pt-6 border-t border-gray-100">
              <button
                type="button"
                className="h-11 px-6 rounded-xl border-2 border-[#C5A059] text-[#C5A059] hover:bg-[#C5A059] hover:text-white font-bold text-sm shadow-sm transition-all flex items-center gap-2"
              >
                <PlusCircle size={18} /> Agregar Experiencia
              </button>
            </div>

          </div>
        </section>
      </div>
    );
  }
);

EmploymentStep.displayName = "EmploymentStep";

export default EmploymentStep;