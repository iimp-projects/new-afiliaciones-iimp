"use client";
import { useState, useEffect, useRef } from "react";
import { Search, FileText, Info, Building2, Fingerprint, User, CheckCircle2, XCircle, ChevronDown, Check, X } from "lucide-react";
import { ApplicationStatusData } from "@/modules/afiliaciones/consulta/Models/ApplicationStatus";
import { applicationApi } from "@/modules/afiliaciones/postulacion/Services/ApplicationApi";
import { isLegalEntityRuc, isValidBillingDocument, sanitizeBillingDocumentNumber } from "@/modules/afiliaciones/payments/Rules/BillingDocumentRules";

const DOCUMENT_TYPE_OPTIONS = [
  { value: "DNI", label: "DNI" },
  { value: "CE", label: "Carné de Extranjería" },
  { value: "PASSPORT", label: "Pasaporte" },
  { value: "RUC", label: "RUC" },
] as const;

function DocumentTypeSelect({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  const selected = DOCUMENT_TYPE_OPTIONS.find((option) => option.value === value);

  return (
    <div className="relative w-full" ref={containerRef} onKeyDown={(event) => { if (event.key === "Escape") setOpen(false); }}>
      <button
        type="button"
        aria-label="Tipo de documento"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="flex h-12 w-full items-center justify-between rounded-xl border border-slate-300 bg-white px-4 text-left text-sm font-bold text-slate-700 outline-none transition-colors hover:border-[#C5A059] focus-visible:border-[#C5A059] focus-visible:ring-2 focus-visible:ring-[#C5A059]/20"
      >
        <span className="truncate">{selected?.label ?? "Seleccione documento"}</span>
        <ChevronDown size={18} className={`shrink-0 text-slate-400 transition-transform duration-200 ${open ? "rotate-180 text-[#C5A059]" : ""}`} />
      </button>

      {open && (
        <div role="listbox" aria-label="Tipo de documento" className="absolute z-[110] mt-2 w-full overflow-hidden rounded-xl border border-gray-200 bg-white shadow-[0_10px_40px_-15px_rgba(0,0,0,0.15)] animate-in fade-in slide-in-from-top-2">
          <div className="p-1">
            {DOCUMENT_TYPE_OPTIONS.map((option) => {
              const active = option.value === value;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm transition-colors ${active ? "bg-[#C5A059]/10 font-bold text-[#C5A059]" : "font-medium text-slate-700 hover:bg-gray-50"}`}
                >
                  {option.label}
                  {active && <Check size={16} />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

interface Props {
  data: ApplicationStatusData;
  billingData: {
    tipoDocumento: string;
    numeroDocumento: string;
    razonSocial: string;
    direccionFiscal: string;
    responsable: string;
    emailFacturacion: string;
  };
  setBillingData: React.Dispatch<React.SetStateAction<any>>;
}

export default function BillingDetailsStep({ data, billingData, setBillingData }: Props) {
  const [showModal, setShowModal] = useState(true);
  const [showRucNotice, setShowRucNotice] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [isFormEnabled, setIsFormEnabled] = useState(() => isValidBillingDocument(billingData.tipoDocumento as "DNI" | "CE" | "PASSPORT" | "RUC", billingData.numeroDocumento));
  const [searchFeedback, setSearchFeedback] = useState<{ type: 'success' | 'warning' | 'error', message: string } | null>(null);
  const [isOfficialRuc20, setIsOfficialRuc20] = useState(false);

  const isRuc = billingData.tipoDocumento === "RUC";
  const isCe = billingData.tipoDocumento === "CE";
  const isPassport = billingData.tipoDocumento === "PASSPORT";
  const documentType = billingData.tipoDocumento as "DNI" | "CE" | "PASSPORT" | "RUC";
  const documentNumberMaxLength = documentType === "DNI" ? 8 : documentType === "RUC" ? 11 : documentType === "PASSPORT" ? 12 : 15;

  useEffect(() => {
    if (showModal) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = 'auto';
    return () => { document.body.style.overflow = 'auto'; };
  }, [showModal]);

  const handleSearchDocument = async () => {
    if (!billingData.numeroDocumento) return;
    
    setIsSearching(true);
    setSearchFeedback(null);

    try {
      if (isRuc) {
        const lookup = await applicationApi.lookupRuc(billingData.numeroDocumento);
        if (lookup.status === "VERIFIED" && lookup.data?.razonSocial) {
          const response = lookup.data;
          setBillingData({
            ...billingData,
            razonSocial: response.razonSocial,
            direccionFiscal: response.direccion || "",
          });
          setSearchFeedback({ type: 'success', message: 'Empresa validada correctamente en SUNAT.' });
          setIsOfficialRuc20(isLegalEntityRuc(billingData.numeroDocumento));
          setIsFormEnabled(true);
        } else if (lookup.status === "NOT_FOUND") {
          setSearchFeedback({ type: 'warning', message: 'RUC no encontrado. Puede ingresar datos manuales no verificados.' });
          setBillingData({ ...billingData, razonSocial: "", direccionFiscal: "" });
          setIsOfficialRuc20(false);
          setIsFormEnabled(true);
        } else {
          setSearchFeedback({ type: 'error', message: 'SUNAT no está disponible temporalmente. Intente nuevamente.' });
          setIsOfficialRuc20(false);
        }
      } else {
          const docNumberPostulante = data.draftData?.personalInformation?.documentNumber;
          if (docNumberPostulante === billingData.numeroDocumento && data.applicantName) {
            setBillingData({
              ...billingData,
              razonSocial: data.applicantName,
              direccionFiscal: data.draftData?.personalInformation?.address || "",
            });
            setSearchFeedback({ type: 'success', message: 'Datos recuperados del expediente actual.' });
            setIsFormEnabled(true);
          } else {
            throw new Error("No se encontraron resultados");
          }
      }
    } catch (error: any) {
      setSearchFeedback({ type: 'warning', message: 'No se encontró el documento. Por favor, ingrese los datos manualmente.' });
      setBillingData({ ...billingData, razonSocial: "", direccionFiscal: "" });
    } finally {
      setIsSearching(false);
      setIsFormEnabled(isValidBillingDocument(documentType, billingData.numeroDocumento));
    }
  };

  return (
    <div className="space-y-8 animate-in slide-in-from-right-4 duration-500 mb-8 relative">
      {showModal && (
        <div className="fixed inset-0 z-[200] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="relative w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-[24px] bg-white shadow-2xl animate-in zoom-in-95 duration-300">
            <div className="h-1.5 w-full bg-gradient-to-r from-[#C5A059] via-[#E8D09E] to-[#C5A059]" />
            <div className="p-6 sm:p-8">
              <header className="flex items-start gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#F4E9D8] text-[#C5A059]">
                  <Info className="h-7 w-7" />
                </div>
                <div className="flex-1">
                  <p className="text-[10px] font-black uppercase tracking-widest text-[#A67C00]">Aviso informativo</p>
                  <h3 className="text-xl font-black tracking-tight text-slate-800 sm:text-2xl">Facturación de su afiliación</h3>
                </div>
                <button onClick={() => setShowModal(false)} aria-label="Cerrar aviso informativo" className="rounded-xl p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700">
                  <XCircle size={20} />
                </button>
              </header>

              <p className="mt-5 text-sm font-medium leading-relaxed text-slate-600">
                <strong className="text-slate-800">Estimado(a) postulante:</strong> tenga en cuenta que el tipo de comprobante electrónico se procesará de acuerdo con el documento y los datos de facturación que registre en el formulario correspondiente.
              </p>
              <p className="mt-3 text-center text-xs font-black uppercase tracking-[0.18em] text-[#A67C00]">Afiliaciones IIMP</p>

              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <article className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-slate-500 shadow-sm" aria-hidden="true">
                    <User size={22} />
                  </span>
                  <h4 className="mt-3 text-base font-black text-slate-800">Boleta de venta</h4>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Personas naturales</p>
                  <p className="mt-2 text-xs font-medium leading-relaxed text-slate-600">
                    Si registra DNI, carné de extranjería o pasaporte, podrá solicitar una boleta electrónica. El comprobante se emitirá con los datos personales y de facturación registrados.
                  </p>
                  <p className="mt-3 rounded-lg bg-white px-3 py-2 text-[11px] font-medium leading-relaxed text-slate-500">
                    Verifique que sus nombres y documento sean correctos.
                  </p>
                </article>

                <article className="rounded-2xl border border-[#E8D09E] bg-[#FFFDF8] p-5">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-[#C5A059] shadow-sm" aria-hidden="true">
                    <Building2 size={22} />
                  </span>
                  <h4 className="mt-3 text-base font-black text-[#8C622C]">Factura comercial</h4>
                  <p className="text-[10px] font-black uppercase tracking-widest text-[#A1743B]">Empresas e instituciones</p>
                  <p className="mt-2 text-xs font-medium leading-relaxed text-[#A1743B]">
                    Si necesita una factura a nombre de una empresa o institución, deberá registrar su RUC y razón social. El comprobante se emitirá con los datos fiscales proporcionados en el formulario.
                  </p>
                  <p className="mt-3 rounded-lg bg-white/80 px-3 py-2 text-[11px] font-medium leading-relaxed text-[#A1743B]">
                    Verifique el RUC, la razón social y la dirección fiscal.
                  </p>
                </article>
              </div>

              <div className="mt-4 rounded-2xl border border-[#E8D09E] bg-[#FFFCF5] p-4 text-xs font-medium leading-relaxed text-[#7f561e]">
                <strong className="text-[#8C622C]">Nota importante:</strong> el comprobante definitivo se emitirá conforme a los datos proporcionados durante el proceso de afiliación y a las condiciones de facturación vigentes. Cualquier modificación posterior estará sujeta a validación administrativa y a la normativa tributaria aplicable.
              </div>

              <button onClick={() => setShowModal(false)} className="mt-5 flex h-12 w-full items-center justify-center rounded-xl bg-[#1E293B] text-sm font-bold text-white shadow-lg shadow-slate-900/20 transition-all hover:bg-black">
                Entendido, continuar con la facturación
              </button>
            </div>
          </div>
        </div>
      )}

      {searchFeedback && (
        <div className={`p-4 rounded-xl border font-bold text-sm flex items-center gap-3 shadow-sm ${searchFeedback.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-amber-50 border-amber-200 text-amber-700'}`}>
          {searchFeedback.type === 'success' ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <Info className="w-5 h-5 shrink-0" />}
          {searchFeedback.message}
        </div>
      )}

      <section className="bg-[#FCFAF6] rounded-3xl p-6 sm:p-8 shadow-sm border border-[#E8D09E]/50 relative z-30">
        <div className="flex flex-col md:flex-row justify-between md:items-start gap-6 border-b border-[#E8D09E]/30 pb-6 mb-8">
          <div className="flex items-start gap-5">
            <div className="w-14 h-14 shrink-0 rounded-full border-2 border-[#D6A84A] flex items-center justify-center bg-white shadow-sm">
              {isRuc ? <Building2 size={28} className="text-[#C5A059]" /> : <Fingerprint size={28} className="text-[#C5A059]" />}
            </div>
            <div>
              <span className="inline-block px-3 py-1 rounded-full bg-[#F4E9D8] text-[#A67C00] text-[10px] font-bold uppercase tracking-widest mb-2">
                Integración {isRuc ? "SUNAT" : "RENIEC"}
              </span>
              <h2 className="text-xl sm:text-2xl font-black text-[#1E293B]">
                {isRuc ? "Validación de Empresa" : "Verificación de Identidad"}
              </h2>
              <p className="text-sm text-gray-500 font-medium mt-1">
                Para habilitar los campos de facturación, consulte el documento {isRuc ? "en SUNAT" : "en RENIEC"}.
              </p>
            </div>
          </div>
        </div>

        {isRuc && showRucNotice && <div className="relative mb-7 rounded-xl border border-sky-200 bg-sky-50 p-4 pr-12 text-sm text-slate-700"><button type="button" onClick={() => setShowRucNotice(false)} aria-label="Cerrar aviso de facturación" className="absolute right-3 top-3 rounded-full p-1.5 text-sky-700 transition-colors hover:bg-sky-100"><X size={16} /></button><div className="flex items-center gap-2 font-black text-slate-800"><Info size={18} className="text-sky-700" />Antes de emitir tu factura</div><p className="mt-2">Ingresa el RUC que utilizarás para la facturación y presiona “Consultar”. Validaremos los datos registrados en SUNAT antes de continuar con el pago.</p><p className="mt-2 text-sm font-semibold text-slate-600">RUC de 11 dígitos. La razón social y dirección fiscal verificadas por SUNAT no podrán modificarse.</p><ol className="mt-3 list-decimal space-y-1 pl-5 text-sm"><li>Ingresa los 11 dígitos del RUC.</li><li>Presiona “Consultar”.</li><li>Verifica los datos fiscales.</li><li>Completa el contacto y correo de facturación.</li></ol></div>}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 w-full max-w-2xl mx-auto">
          <div>
            <label className="mb-2 block text-sm font-bold uppercase tracking-wide text-slate-700">
              Tipo de documento <span className="text-red-500">*</span>
            </label>
            <DocumentTypeSelect
              value={billingData.tipoDocumento}
              onChange={(value) => {
                setBillingData({ tipoDocumento: value, numeroDocumento: "", razonSocial: "", direccionFiscal: "", responsable: "", emailFacturacion: "" });
                setIsFormEnabled(false);
                setSearchFeedback(null);
                setIsOfficialRuc20(false);
                setShowRucNotice(true);
              }}
            />
          </div>
          <div>
            <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">
              Número de Documento <button type="button" title="El RUC es el número de 11 dígitos que identifica a una persona o empresa ante SUNAT." aria-label="Ayuda sobre RUC" className="ml-1 inline-flex text-[#A67C00]"><Info size={14} /></button><span className="text-red-500">*</span>
            </label>
            <div className="flex shadow-sm">
              <input 
                type="text" 
                maxLength={documentNumberMaxLength}
                value={billingData.numeroDocumento} 
                onChange={(e) => {
                  const nextNumber = sanitizeBillingDocumentNumber(documentType, e.target.value);
                  setBillingData({ ...billingData, numeroDocumento: nextNumber });
                  setIsFormEnabled(isValidBillingDocument(documentType, nextNumber));
                  setSearchFeedback(null);
                  setIsOfficialRuc20(false);
                }} 
                placeholder={documentType === "DNI" ? "8 dígitos" : documentType === "RUC" ? "11 dígitos" : documentType === "PASSPORT" ? "6 a 12 caracteres" : "Letras y números"}
                className="h-12 w-full rounded-l-xl border border-r-0 border-slate-300 bg-white px-4 text-base font-bold text-slate-700 outline-none focus:border-[#C5A059]" 
              />
              <button 
                onClick={handleSearchDocument} 
                disabled={isSearching || !isValidBillingDocument(documentType, billingData.numeroDocumento)} 
                className="flex h-12 items-center justify-center rounded-r-xl bg-[#C5A059] px-5 text-sm font-bold text-white transition-colors hover:bg-[#A67C00] disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
              >
                {isSearching ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <Search size={20} />}
              </button>
            </div>
            {isCe && <p className="mt-1 text-[11px] font-medium text-slate-500">El Carnet de Extranjería admite letras y números (máx. 15).</p>}
            {isPassport && <p className="mt-1 text-[11px] font-medium text-slate-500">El Pasaporte debe ser alfanumérico y tener entre 6 y 12 caracteres.</p>}
            {isRuc && <p className="mt-1 text-[11px] font-medium text-slate-500">El RUC debe tener 11 dígitos y un dígito verificador válido.</p>}
          </div>
        </div>
      </section>

      <section className={`bg-white rounded-3xl border border-gray-200 shadow-sm relative z-20 transition-opacity duration-300 ${!isFormEnabled ? 'opacity-50 pointer-events-none' : ''}`}>
        <div className="px-8 py-5 border-b border-gray-100 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-[#C5A059]/10 flex items-center justify-center">
            <FileText className="w-5 h-5 text-[#C5A059]" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-[#2F3136] tracking-tight">Detalles de Facturación</h2>
            <p className="text-xs text-gray-500 font-medium">Complete los datos para el comprobante electrónico.</p>
          </div>
        </div>
        <div className="p-8">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-5 sm:gap-6">
            <div className="md:col-span-6">
              <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">{isRuc ? "Razón Social" : "Nombre Completo"} <span className="text-red-500">*</span></label>
              <input type="text" readOnly={isOfficialRuc20} value={billingData.razonSocial} onChange={(e) => setBillingData({...billingData, razonSocial: e.target.value})} className="w-full h-11 px-4 rounded-xl border border-slate-300 focus:ring-2 focus:ring-[#C5A059]/20 focus:border-[#C5A059] outline-none font-bold text-sm text-slate-700 read-only:bg-slate-50" />
            </div>
            <div className="md:col-span-6">
              <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">Dirección Fiscal <span className="text-red-500">*</span></label>
              <input type="text" readOnly={isOfficialRuc20} value={billingData.direccionFiscal} onChange={(e) => setBillingData({...billingData, direccionFiscal: e.target.value})} className="w-full h-11 px-4 rounded-xl border border-slate-300 focus:ring-2 focus:ring-[#C5A059]/20 focus:border-[#C5A059] outline-none font-bold text-sm text-slate-700 read-only:bg-slate-50" />
            </div>
            <div className="md:col-span-6">
              <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">Responsable de Facturación <span className="text-red-500">*</span></label>
              <input type="text" value={billingData.responsable} onChange={(e) => setBillingData({...billingData, responsable: e.target.value})} placeholder="Nombre de contacto" className="w-full h-11 px-4 rounded-xl border border-slate-300 focus:ring-2 focus:ring-[#C5A059]/20 focus:border-[#C5A059] outline-none font-bold text-sm text-slate-700" />
            </div>
            <div className="md:col-span-6">
              <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">Email de Facturación <span className="text-red-500">*</span></label>
              <input type="email" value={billingData.emailFacturacion} onChange={(e) => setBillingData({...billingData, emailFacturacion: e.target.value})} placeholder="Donde se enviará el comprobante" className="w-full h-11 px-4 rounded-xl border border-slate-300 focus:ring-2 focus:ring-[#C5A059]/20 focus:border-[#C5A059] outline-none font-bold text-sm text-slate-700" />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
