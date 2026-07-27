"use client";

import { useEffect, useState, forwardRef, useImperativeHandle, ChangeEvent } from "react";
import { ShieldCheck, FileText, Download, UploadCloud, CheckCircle2, Info, XCircle, AlertTriangle } from "lucide-react";
import type { ApplicationDraft } from "../../Models/ApplicationDraft";
import type { Endorsements } from "../../Models/Endorsements";
import { EndorsementsValidator } from "../../Validators/EndorsementsValidator";
import { applicationApi } from "../../Services/ApplicationApi";

export interface StepRef {
  submit: () => Promise<void>;
}

interface DeclarationStepProps {
  value?: ApplicationDraft["endorsements"];
  draftContext?: ApplicationDraft;
  saving?: boolean;
  onSave(endorsements: ApplicationDraft["endorsements"]): Promise<void>;
  onNext(): void;
  onBack(): void;
  onValidityChange?: (isValid: boolean) => void;
  onFinalSubmit?: () => Promise<void>; // 👈 Se agrega este prop
}

const DeclarationStep = forwardRef<StepRef, DeclarationStepProps>(
  ({ value, draftContext, saving = false, onSave, onNext, onBack, onValidityChange, onFinalSubmit }, ref) => {
    
    const [form, setForm] = useState<Endorsements>(value as Endorsements);
    const [touched, setTouched] = useState<Record<string, boolean>>({});
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [globalError, setGlobalError] = useState<string | null>(null);
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
    
    const [declaracionFile, setDeclaracionFile] = useState<{ name: string; url: string; type: string } | null>(null);
    const [rawFile, setRawFile] = useState<File | null>(null);
    const [isUploading, setIsUploading] = useState(false);

    // 👇 Estado para el Modal de Confirmación
    const [showConfirmModal, setShowConfirmModal] = useState(false);

    useEffect(() => {
      const validator = new EndorsementsValidator();
      const result = validator.validate(form);
      onValidityChange?.(result.valid);
    }, [form, onValidityChange]);

    useEffect(() => {
      const fetchSecureUrl = async () => {
        if (value?.declarationDocumentId && value.declarationDocumentId.startsWith("http")) {
          try {
            const secureUrl = await applicationApi.getSecureFileUrl(value.declarationDocumentId);
            setDeclaracionFile({ name: "Declaracion_Jurada_Firmada.pdf", url: secureUrl, type: "application/pdf" });
          } catch (e) { console.error("Error al cargar la Declaración de S3"); }
        }
      };
      fetchSecureUrl();
    }, [value?.declarationDocumentId]);

    const handleGeneratePdf = async () => {
      if (!draftContext) return;
      setIsGeneratingPdf(true);
      setGlobalError(null);
      try {
        const payloadToPrint = { ...draftContext, endorsements: form };
        const blob = await applicationApi.generatePdf(payloadToPrint);
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `Declaracion_Jurada_IIMP.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
      } catch (error: any) {
        setGlobalError("Hubo un error al generar su documento PDF.");
        window.scrollTo({ top: 0, behavior: "smooth" });
      } finally {
        setIsGeneratingPdf(false);
      }
    };

    const handleDeclaracionChange = (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        const objectUrl = URL.createObjectURL(file);
        setDeclaracionFile({ name: file.name, url: objectUrl, type: file.type });
        setRawFile(file); 
        setForm(prev => ({ ...prev, declarationDocumentId: "PENDIENTE_SUBIDA" }));
      }
    };

    // 👇 PRIMERA FASE: EL BOTÓN INFERIOR VALIDA Y MUESTRA EL MODAL
    useImperativeHandle(ref, () => ({
      submit: async () => {
        setGlobalError(null);
        setTouched({ declarationAccepted: true, declarationDocumentId: true });

        const validator = new EndorsementsValidator();
        const result = validator.validate(form);

        if (!result.valid) {
          const newErrors: Record<string, string> = {};
          result.errors.forEach((err) => { newErrors[err.field] = err.message; });
          setErrors(newErrors);
          return;
        }

        // En lugar de enviar directo, abrimos la alerta:
        setShowConfirmModal(true);
      },
    }));

    // 👇 SEGUNDA FASE: EL MODAL SUBE A S3 Y EJECUTA EL ENVÍO FINAL
    const handleConfirmSubmit = async () => {
      setShowConfirmModal(false);
      try {
        setIsUploading(true);
        let updatedForm = { ...form };

        if (rawFile) {
          const uploaded = await applicationApi.uploadFile(rawFile, "afiliaciones/declaraciones");
          updatedForm.declarationDocumentId = uploaded.url; 
        }

        await onSave(updatedForm); // Guarda el borrador
        
        // Llamada al Orquestador para enviar a BD definitivamente
        if (onFinalSubmit) {
          await onFinalSubmit();
        }
      } catch (error: any) {
        setGlobalError(error.message || "Error al enviar la solicitud.");
      } finally {
        setIsUploading(false);
      }
    };

    return (
      <div className="space-y-8">
        
        {/* 👇 MODAL EMERGENTE DE CONFIRMACIÓN */}
        {showConfirmModal && (
          <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl animate-in zoom-in-95">
              <div className="w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center mb-6 mx-auto">
                <AlertTriangle className="w-8 h-8 text-amber-600" />
              </div>
              <h3 className="text-xl font-bold text-center text-[#2F3136] mb-3">¿Enviar Postulación?</h3>
              <p className="text-sm text-gray-500 text-center mb-8 leading-relaxed">
                Está a punto de enviar su solicitud para que pueda ser revisada y procesada sin problema alguno. <strong>Ya no podrá realizar modificaciones.</strong>
              </p>
              <div className="flex flex-col gap-3">
                <button onClick={handleConfirmSubmit} className="w-full h-12 bg-gradient-to-r from-[#C5A059] to-[#9E7832] text-white rounded-xl font-bold text-sm shadow-md hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2">
                  Sí, enviar solicitud
                </button>
                <button onClick={() => setShowConfirmModal(false)} className="w-full h-12 bg-white border border-gray-200 text-gray-600 rounded-xl font-bold text-sm hover:bg-gray-50 transition-colors">
                  Cancelar y revisar datos
                </button>
              </div>
            </div>
          </div>
        )}

        {isUploading && (
          <div className="fixed inset-0 z-[200] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl p-8 flex flex-col items-center shadow-2xl animate-in zoom-in-95">
              <svg className="animate-spin h-12 w-12 text-[#C5A059] mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <h3 className="text-lg font-bold text-[#2F3136]">Procesando su solicitud...</h3>
              <p className="text-sm text-gray-500 mt-2">Asegurando documentos y enviando expediente.</p>
            </div>
          </div>
        )}

        {globalError && (
          <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-600 font-bold text-sm flex items-center gap-3">
            <XCircle className="w-5 h-5 shrink-0" /> {globalError}
          </div>
        )}

        {/* --- Formulario Normal --- */}
        <section className="bg-white rounded-3xl border border-gray-200 overflow-hidden shadow-sm">
          <div className="px-8 py-5 border-b border-gray-100 flex items-center gap-4 bg-gray-50/50">
            <div className="w-10 h-10 rounded-xl bg-[#C5A059]/10 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-[#C5A059]" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#2F3136] tracking-tight">Declaración Jurada y Firmas</h2>
              <p className="text-xs text-gray-500 font-medium">Paso final antes de enviar su expediente al IIMP.</p>
            </div>
          </div>

          <div className="p-8">
            <div className="bg-[#FFFDF8] border border-[#E8D09E] rounded-xl p-5 mb-8 flex items-start gap-4">
              <Info className="w-6 h-6 text-[#C5A059] shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-bold text-[#4a2d00] mb-1">Último Paso</h4>
                <p className="text-sm text-[#7f561e] leading-relaxed">
                  Haga clic en el botón inferior para generar un documento PDF con todos sus datos recopilados. Revíselo, fírmelo (física o digitalmente) y vuelva a subirlo para completar su postulación.
                </p>
              </div>
            </div>

            <div className="flex flex-col md:flex-row items-center gap-8 border-b border-gray-100 pb-8 mb-8">
              <div className="w-full md:w-1/2">
                <button 
                  type="button" 
                  onClick={handleGeneratePdf}
                  disabled={isGeneratingPdf}
                  className="w-full h-12 rounded-xl bg-gradient-to-r from-[#C5A059] to-[#9E7832] text-white font-bold text-sm flex items-center justify-center gap-2 shadow-[0_8px_20px_-6px_rgba(197,160,89,0.6)] hover:-translate-y-0.5 transition-all disabled:opacity-70"
                >
                  {isGeneratingPdf ? "Generando Documento Oficial..." : <><Download size={18} /> Generar y Descargar Declaración</>}
                </button>
              </div>

              <div className="w-full md:w-1/2">
                <label className="flex items-start gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={form?.declarationAccepted || false}
                    onChange={(e) => setForm(prev => ({ ...prev, declarationAccepted: e.target.checked }))}
                    className="mt-0.5 w-5 h-5 rounded border-gray-300 text-[#C5A059] focus:ring-[#C5A059]"
                  />
                  <span className="text-sm text-gray-600 font-medium group-hover:text-[#2F3136] transition-colors">
                    Declaro haber verificado mis datos y acepto firmar la Solicitud y la Declaración Jurada conforme a ley. <span className="text-red-500">*</span>
                  </span>
                </label>
                {touched.declarationAccepted && errors.declarationAccepted && (
                  <p className="text-red-500 text-xs font-bold mt-2 ml-8">{errors.declarationAccepted}</p>
                )}
              </div>
            </div>

            <div>
              <label className={`group cursor-pointer relative overflow-hidden h-[260px] w-full border-2 border-dashed rounded-2xl p-6 transition-all duration-300 flex flex-col items-center justify-center text-center ${touched.declarationDocumentId && errors.declarationDocumentId ? "border-red-400 bg-red-50/30" : "border-gray-300 hover:border-[#C5A059] hover:bg-gray-50"}`}>
                <input type="file" accept=".pdf" onChange={handleDeclaracionChange} className="hidden" />
                
                {declaracionFile ? (
                  <div className="w-full h-full absolute inset-0 bg-white flex flex-col items-center justify-center overflow-hidden">
                    <iframe src={`${declaracionFile.url}#toolbar=0&navpanes=0&scrollbar=0`} className="w-full h-full pointer-events-none" />
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40 backdrop-blur-sm cursor-pointer">
                      <span className="bg-white/90 px-4 py-2 rounded-xl text-sm font-bold text-[#2F3136] flex items-center gap-2 shadow-lg"><UploadCloud size={16} /> Cambiar Documento Firmado</span>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="w-14 h-14 rounded-full bg-gray-100 text-gray-400 flex items-center justify-center mb-4 group-hover:bg-[#C5A059]/10 group-hover:text-[#C5A059] transition-colors"><FileText className="w-6 h-6" /></div>
                    <h3 className="text-sm font-bold text-[#2F3136] mb-1">Adjuntar Solicitud Firmada <span className="text-red-500">*</span></h3>
                    <p className="text-xs text-gray-500 mb-4 max-w-[200px]">Solo archivos PDF. Peso máximo: 3MB.</p>
                    <div className="inline-flex items-center gap-2 text-[#C5A059] font-bold text-xs uppercase tracking-wider"><UploadCloud size={16} /> Seleccionar Archivo PDF</div>
                  </>
                )}
              </label>
              {touched.declarationDocumentId && errors.declarationDocumentId && (
                <p className="text-red-500 text-xs font-bold mt-2 text-center">{errors.declarationDocumentId}</p>
              )}
            </div>
          </div>
        </section>
      </div>
    );
  }
);

DeclarationStep.displayName = "DeclarationStep";

export default DeclarationStep;