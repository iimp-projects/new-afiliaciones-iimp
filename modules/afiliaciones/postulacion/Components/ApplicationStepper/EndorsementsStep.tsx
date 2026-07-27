"use client";

import { useEffect, useState, forwardRef, useImperativeHandle } from "react";
import { Users, Search, CheckCircle2, BookOpen, Coffee, Save } from "lucide-react";
import type { ApplicationDraft } from "../../Models/ApplicationDraft";
import type { Endorsements } from "../../Models/Endorsements";
import { applicationApi } from "../../Services/ApplicationApi";

export interface StepRef {
  submit: () => Promise<void>;
}

interface EndorsementsStepProps {
  value?: ApplicationDraft["endorsements"];
  saving?: boolean;
  onSave(endorsements: ApplicationDraft["endorsements"]): Promise<void>;
  onNext(): void;
  onBack(): void;
  onValidityChange?: (isValid: boolean) => void;
}

const emptyEndorsements: Endorsements = {
  firstEndorsement: { sponsorDocumentNumber: "", sponsorFullName: "", sponsorEmail: "", sponsorCode: "", sponsorPersonId: undefined },
  secondEndorsement: { sponsorDocumentNumber: "", sponsorFullName: "", sponsorEmail: "", sponsorCode: "", sponsorPersonId: undefined },
  declarationAccepted: false,
  declarationDocumentId: undefined,
};

const EndorsementsStep = forwardRef<StepRef, EndorsementsStepProps>(
  ({ value, saving = false, onSave, onNext, onBack, onValidityChange }, ref) => {
    
    const [form, setForm] = useState<Endorsements>(value ?? emptyEndorsements);
    const [touched, setTouched] = useState<Record<string, boolean>>({});
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [globalError, setGlobalError] = useState<string | null>(null);

    const [isSearching1, setIsSearching1] = useState(false);
    const [isSearching2, setIsSearching2] = useState(false);

    useEffect(() => {
      if (value) setForm(value);
    }, [value]);

    useEffect(() => {
      const isValid = !!form.firstEndorsement?.sponsorFullName && !!form.secondEndorsement?.sponsorFullName;
      onValidityChange?.(isValid);
    }, [form, onValidityChange]);

    function updateField(field: string, rawValue: string) {
      const sanitizedValue = rawValue.replace(/\D/g, "").slice(0, 8);
      const newForm = { ...form };

      if (field === "firstEndorsement.sponsorDocumentNumber") {
        newForm.firstEndorsement = { 
          sponsorDocumentNumber: sanitizedValue, 
          sponsorFullName: "", 
          sponsorEmail: "", 
          sponsorCode: "",
          sponsorPersonId: undefined
        };
      } else if (field === "secondEndorsement.sponsorDocumentNumber") {
        newForm.secondEndorsement = { 
          sponsorDocumentNumber: sanitizedValue, 
          sponsorFullName: "", 
          sponsorEmail: "", 
          sponsorCode: "",
          sponsorPersonId: undefined
        };
      }

      setTouched((prev) => ({ ...prev, [field]: true }));
      setForm(newForm);
      
      const fieldError = sanitizedValue.length > 0 && sanitizedValue.length < 8 ? "El DNI debe tener 8 dígitos." : "";
      setErrors((prev) => ({ ...prev, [field]: fieldError }));
    }

    const handleSearchAval = async (avalNum: 1 | 2) => {
      const documentNumber = avalNum === 1 ? form.firstEndorsement?.sponsorDocumentNumber : form.secondEndorsement?.sponsorDocumentNumber;
      
      if (!documentNumber || documentNumber.length !== 8) return;

      setGlobalError(null);

      const otherDocumentNumber = avalNum === 1 ? form.secondEndorsement?.sponsorDocumentNumber : form.firstEndorsement?.sponsorDocumentNumber;
      if (documentNumber === otherDocumentNumber) {
        setGlobalError(`El Aval ${avalNum} no puede ser la misma persona que el otro Aval.`);
        return;
      }

      if (avalNum === 1) setIsSearching1(true);
      else setIsSearching2(true);

      try {
        const data = await applicationApi.validateSponsor(documentNumber);
        
        const newForm = { ...form };
        if (avalNum === 1) {
          newForm.firstEndorsement = { 
            sponsorPersonId: data.id,
            sponsorDocumentNumber: documentNumber,
            sponsorFullName: data.fullName, 
            sponsorEmail: data.email, 
            sponsorCode: data.sponsorCode 
          };
        } else {
          newForm.secondEndorsement = { 
            sponsorPersonId: data.id,
            sponsorDocumentNumber: documentNumber,
            sponsorFullName: data.fullName, 
            sponsorEmail: data.email, 
            sponsorCode: data.sponsorCode 
          };
        }
        setForm(newForm);
      } catch (error: any) {
        const newForm = { ...form };
        if (avalNum === 1) {
          newForm.firstEndorsement = { sponsorDocumentNumber: form.firstEndorsement?.sponsorDocumentNumber || "", sponsorFullName: "", sponsorEmail: "", sponsorCode: "", sponsorPersonId: undefined };
        } else {
          newForm.secondEndorsement = { sponsorDocumentNumber: form.secondEndorsement?.sponsorDocumentNumber || "", sponsorFullName: "", sponsorEmail: "", sponsorCode: "", sponsorPersonId: undefined };
        }
        setForm(newForm);
        setGlobalError(`Aval ${avalNum}: ${error.message}`);
      } finally {
        if (avalNum === 1) setIsSearching1(false);
        else setIsSearching2(false);
      }
    };

    useImperativeHandle(ref, () => ({
      submit: async () => {
        setGlobalError(null);
        if (!form.firstEndorsement?.sponsorFullName || !form.secondEndorsement?.sponsorFullName) {
          setGlobalError("Debe buscar y validar los DNI de ambos avales antes de continuar.");
          return;
        }
        try {
          await onSave(form);
          onNext();
        } catch (error: any) {
          setGlobalError(error.message || "Error al guardar avales.");
        }
      },
    }));

    const getInputClass = (field: string) => `w-full h-11 px-3 rounded-l-xl border-y border-l focus:outline-none focus:ring-2 font-medium text-sm transition-colors ${touched[field] && errors[field] ? "border-red-500 focus:ring-red-200 bg-red-50/30 text-red-900" : "border-gray-300 focus:border-[#C5A059] focus:ring-[#C5A059]/20 bg-white text-slate-700"}`;

    return (
      <div className="space-y-8">
        {globalError && (
          <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-600 font-bold text-sm flex items-center gap-3 shadow-sm">
            <CheckCircle2 className="w-5 h-5 shrink-0" /> {globalError}
          </div>
        )}

        <section className="bg-white rounded-3xl border border-gray-200 overflow-hidden shadow-sm">
          <div className="px-8 py-5 border-b border-gray-100 flex items-center gap-4 bg-gray-50/50">
            <div className="w-10 h-10 rounded-xl bg-[#C5A059]/10 flex items-center justify-center">
              <Users className="w-5 h-5 text-[#C5A059]" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#2F3136] tracking-tight">Avales Institucionales</h2>
              <p className="text-xs text-gray-500 font-medium">Respaldo de su trayectoria profesional.</p>
            </div>
          </div>

          <div className="p-8">
            
            <div className="bg-[#FCFAF6] border border-[#E8D09E] rounded-xl p-6 mb-8 flex items-start gap-5 shadow-sm">
              <div className="w-12 h-12 rounded-full bg-[#C5A059]/10 flex items-center justify-center shrink-0">
                <BookOpen className="w-6 h-6 text-[#C5A059]" />
              </div>
              <div>
                <h4 className="text-sm font-black text-[#4a2d00] mb-2 uppercase tracking-wide">Estatuto del IIMP - Art. 11</h4>
                <p className="text-sm text-[#7f561e] leading-relaxed">
                  Toda solicitud de incorporación a la categoría de <strong>Asociado Activo</strong> debe estar respaldada por dos (2) Asociados Activos que se encuentren hábiles en la institución. Ellos dan fe de su trayectoria profesional y ética para pertenecer a nuestra comunidad.
                </p>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6 mb-10">
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-5 flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                  <Coffee className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-blue-900 mb-1">¿No conoce a ningún Asociado?</h4>
                  <p className="text-xs text-blue-800 leading-relaxed">
                    ¡No hay problema! Lo invitamos cordialmente a nuestros tradicionales <strong>Jueves Mineros</strong>. Es el espacio ideal para hacer networking, conocer a líderes del sector y conseguir el respaldo necesario.
                  </p>
                </div>
              </div>

              <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-5 flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                  <Save className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-emerald-900 mb-1">Su progreso está seguro</h4>
                  <p className="text-xs text-emerald-800 leading-relaxed">
                    Toda la información ingresada en los pasos anteriores se ha guardado automáticamente. Si aún no cuenta con sus avales, puede cerrar sesión sin inconvenientes y regresar pronto.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
              
              {/* AVAL 1 */}
              <div className="p-6 rounded-2xl border border-gray-200 bg-gray-50/50">
                <h3 className="text-sm font-bold text-[#2F3136] mb-5 border-b border-gray-200 pb-3 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-[#C5A059] text-white flex items-center justify-center text-xs">1</span>
                  Primer Aval Institucional <span className="text-red-500">*</span>
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-bold text-slate-700 mb-1.5 block uppercase tracking-wide">DNI del Aval</label>
                    <div className="flex">
                      <input
                        type="text"
                        placeholder="Ingrese DNI (8 dígitos)"
                        value={form.firstEndorsement?.sponsorDocumentNumber || ""}
                        onChange={(e) => updateField("firstEndorsement.sponsorDocumentNumber", e.target.value)}
                        className={getInputClass("firstEndorsement.sponsorDocumentNumber")}
                      />
                      <button 
                        type="button" 
                        onClick={() => handleSearchAval(1)}
                        disabled={isSearching1 || (form.firstEndorsement?.sponsorDocumentNumber || "").length !== 8}
                        className={`h-11 px-5 rounded-r-xl transition-colors flex items-center justify-center ${isSearching1 || (form.firstEndorsement?.sponsorDocumentNumber || "").length !== 8 ? "bg-gray-200 text-gray-400 cursor-not-allowed" : "bg-[#2F3136] hover:bg-black text-white shadow-sm"}`}
                      >
                        {isSearching1 ? (
                          <svg className="animate-spin h-5 w-5 text-white/70" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                        ) : (
                          <Search size={16} />
                        )}
                      </button>
                    </div>
                    {errors["firstEndorsement.sponsorDocumentNumber"] && <span className="text-red-500 text-xs mt-1.5 font-bold block">{errors["firstEndorsement.sponsorDocumentNumber"]}</span>}
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 mb-1.5 block uppercase tracking-wide">Nombre Completo</label>
                    <input type="text" disabled value={form.firstEndorsement?.sponsorFullName || ""} placeholder="Nombre validado por el sistema" className="w-full h-11 px-3 rounded-xl border border-gray-200 bg-white text-gray-700 font-bold text-sm shadow-sm" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-bold text-slate-500 mb-1.5 block uppercase tracking-wide">Cód. IIMP</label>
                      <input type="text" disabled value={form.firstEndorsement?.sponsorCode || ""} placeholder="---" className="w-full h-11 px-3 rounded-xl border border-gray-200 bg-white text-gray-600 font-medium text-sm shadow-sm" />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-500 mb-1.5 block uppercase tracking-wide">Correo Electrónico</label>
                      <input type="email" disabled value={form.firstEndorsement?.sponsorEmail || ""} placeholder="---" className="w-full h-11 px-3 rounded-xl border border-gray-200 bg-white text-gray-600 font-medium text-sm shadow-sm" />
                    </div>
                  </div>
                </div>
              </div>

              {/* AVAL 2 */}
              <div className="p-6 rounded-2xl border border-gray-200 bg-gray-50/50">
                <h3 className="text-sm font-bold text-[#2F3136] mb-5 border-b border-gray-200 pb-3 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-[#C5A059] text-white flex items-center justify-center text-xs">2</span>
                  Segundo Aval Institucional <span className="text-red-500">*</span>
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-bold text-slate-700 mb-1.5 block uppercase tracking-wide">DNI del Aval</label>
                    <div className="flex">
                      <input
                        type="text"
                        placeholder="Ingrese DNI (8 dígitos)"
                        value={form.secondEndorsement?.sponsorDocumentNumber || ""}
                        onChange={(e) => updateField("secondEndorsement.sponsorDocumentNumber", e.target.value)}
                        className={getInputClass("secondEndorsement.sponsorDocumentNumber")}
                      />
                      <button 
                        type="button" 
                        onClick={() => handleSearchAval(2)}
                        disabled={isSearching2 || (form.secondEndorsement?.sponsorDocumentNumber || "").length !== 8}
                        className={`h-11 px-5 rounded-r-xl transition-colors flex items-center justify-center ${isSearching2 || (form.secondEndorsement?.sponsorDocumentNumber || "").length !== 8 ? "bg-gray-200 text-gray-400 cursor-not-allowed" : "bg-[#2F3136] hover:bg-black text-white shadow-sm"}`}
                      >
                        {isSearching2 ? (
                          <svg className="animate-spin h-5 w-5 text-white/70" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                        ) : (
                          <Search size={16} />
                        )}
                      </button>
                    </div>
                    {errors["secondEndorsement.sponsorDocumentNumber"] && <span className="text-red-500 text-xs mt-1.5 font-bold block">{errors["secondEndorsement.sponsorDocumentNumber"]}</span>}
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 mb-1.5 block uppercase tracking-wide">Nombre Completo</label>
                    <input type="text" disabled value={form.secondEndorsement?.sponsorFullName || ""} placeholder="Nombre validado por el sistema" className="w-full h-11 px-3 rounded-xl border border-gray-200 bg-white text-gray-700 font-bold text-sm shadow-sm" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-bold text-slate-500 mb-1.5 block uppercase tracking-wide">Cód. IIMP</label>
                      <input type="text" disabled value={form.secondEndorsement?.sponsorCode || ""} placeholder="---" className="w-full h-11 px-3 rounded-xl border border-gray-200 bg-white text-gray-600 font-medium text-sm shadow-sm" />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-500 mb-1.5 block uppercase tracking-wide">Correo Electrónico</label>
                      <input type="email" disabled value={form.secondEndorsement?.sponsorEmail || ""} placeholder="---" className="w-full h-11 px-3 rounded-xl border border-gray-200 bg-white text-gray-600 font-medium text-sm shadow-sm" />
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </section>
      </div>
    );
  }
);

EndorsementsStep.displayName = "EndorsementsStep";
export default EndorsementsStep;