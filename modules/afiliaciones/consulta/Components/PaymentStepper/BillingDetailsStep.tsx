"use client";
import { useState, useEffect } from "react";
import { Search, FileText, Info, Building2, Fingerprint, User, AlertCircle, CheckCircle2, XCircle } from "lucide-react";
import { ApplicationStatusData } from "@/modules/afiliaciones/consulta/Models/ApplicationStatus";
import { applicationApi } from "@/modules/afiliaciones/postulacion/Services/ApplicationApi";
import { isLegalEntityRuc, isValidBillingDocument } from "@/modules/afiliaciones/payments/Rules/BillingDocumentRules";

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
  const [isSearching, setIsSearching] = useState(false);
  const [isFormEnabled, setIsFormEnabled] = useState(false);
  const [searchFeedback, setSearchFeedback] = useState<{ type: 'success' | 'warning' | 'error', message: string } | null>(null);
  const [isOfficialRuc20, setIsOfficialRuc20] = useState(false);

  const isRuc = billingData.tipoDocumento === "RUC";

  useEffect(() => {
    if (showModal) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = 'auto';
    return () => { document.body.style.overflow = 'auto'; };
  }, [showModal]);

  const handleSearchDocument = async () => {
    if (!billingData.numeroDocumento) return;
    
    setIsSearching(true);
    setSearchFeedback(null);
    setIsFormEnabled(false);

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
      setIsFormEnabled(false);
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="space-y-8 animate-in slide-in-from-right-4 duration-500 mb-8 relative">
      {showModal && (
        <div className="fixed inset-0 z-[200] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-[24px] p-8 max-w-lg w-full shadow-2xl animate-in zoom-in-95 duration-300 relative">
            <button onClick={() => setShowModal(false)} className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-700 bg-slate-50 hover:bg-slate-100 rounded-full transition-colors">
              <XCircle size={20} />
            </button>
            <div className="w-16 h-16 bg-[#F4E9D8] rounded-full flex items-center justify-center mb-6 mx-auto">
              <AlertCircle className="w-8 h-8 text-[#C5A059]" />
            </div>
            <h3 className="text-xl font-black text-center text-slate-800 mb-3 uppercase tracking-tight">
              Aviso Informativo de<br/>Facturación
            </h3>
            <p className="text-sm text-slate-600 text-center mb-8 leading-relaxed font-medium">
              Estimado participante, tenga en cuenta que el tipo de comprobante electrónico se procesará de forma automática según el documento que usted registre en el formulario inferior:
            </p>
            <div className="flex flex-col sm:flex-row gap-4 mb-6">
              <div className="flex-1 bg-slate-50 border border-slate-200 rounded-xl p-4 text-center">
                <User className="mx-auto text-slate-500 mb-2" size={24} />
                <h4 className="text-xs font-black text-slate-700 uppercase tracking-widest mb-1">Si registra DNI / CE</h4>
                <p className="text-[11px] text-slate-500 font-medium italic">El sistema generará una<br/>Boleta de Venta.</p>
              </div>
              <div className="flex-1 bg-[#FFFDF8] border border-[#E8D09E] rounded-xl p-4 text-center">
                <Building2 className="mx-auto text-[#C5A059] mb-2" size={24} />
                <h4 className="text-xs font-black text-[#8C622C] uppercase tracking-widest mb-1">Si registra RUC</h4>
                <p className="text-[11px] text-[#A1743B] font-medium italic">El sistema generará una<br/>Factura Comercial.</p>
              </div>
            </div>
            <button onClick={() => setShowModal(false)} className="w-full h-12 bg-[#1E293B] hover:bg-black text-white rounded-xl font-bold text-sm shadow-lg shadow-slate-900/20 transition-all flex items-center justify-center">
              Entendido, ir al formulario
            </button>
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

        {isRuc && <div className="mb-7 rounded-xl border border-sky-200 bg-sky-50 p-4 text-sm text-slate-700"><div className="flex items-center gap-2 font-black text-slate-800"><Info size={18} className="text-sky-700" />Antes de emitir tu factura</div><p className="mt-2">Ingresa el RUC que utilizarás para la facturación y presiona “Consultar”. Validaremos los datos registrados en SUNAT antes de continuar con el pago.</p><p className="mt-2 text-sm font-semibold text-slate-600">RUC de 11 dígitos. La razón social y dirección fiscal verificadas por SUNAT no podrán modificarse.</p><ol className="mt-3 list-decimal space-y-1 pl-5 text-sm"><li>Ingresa los 11 dígitos del RUC.</li><li>Presiona “Consultar”.</li><li>Verifica los datos fiscales.</li><li>Completa el contacto y correo de facturación.</li></ol></div>}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 w-full max-w-2xl mx-auto">
          <div>
            <label className="mb-2 block text-sm font-bold uppercase tracking-wide text-slate-700">
              Tipo de Documento <span className="text-red-500">*</span>
            </label>
            <select 
              value={billingData.tipoDocumento} 
              onChange={(e) => {
                setBillingData({ tipoDocumento: e.target.value, numeroDocumento: "", razonSocial: "", direccionFiscal: "", responsable: "", emailFacturacion: "" });
                setIsFormEnabled(false);
                setSearchFeedback(null);
                setIsOfficialRuc20(false);
              }} 
              className="w-full h-12 px-4 rounded-xl border border-slate-300 bg-white text-slate-700 font-bold text-sm focus:ring-2 focus:ring-[#C5A059]/20 focus:border-[#C5A059] outline-none cursor-pointer"
            >
              <option value="DNI">DNI (Boleta)</option>
              <option value="CE">Carnet de Extranjería (Boleta)</option>
              <option value="RUC">RUC (Factura)</option>
            </select>
          </div>
          <div>
            <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">
              Número de Documento <button type="button" title="El RUC es el número de 11 dígitos que identifica a una persona o empresa ante SUNAT." aria-label="Ayuda sobre RUC" className="ml-1 inline-flex text-[#A67C00]"><Info size={14} /></button><span className="text-red-500">*</span>
            </label>
            <div className="flex shadow-sm">
              <input 
                type="text" 
                maxLength={isRuc ? 11 : 12}
                value={billingData.numeroDocumento} 
                onChange={(e) => setBillingData({...billingData, numeroDocumento: e.target.value.replace(/\D/g, '')})} 
                placeholder="Ingrese número" 
                className="h-12 w-full rounded-l-xl border border-r-0 border-slate-300 bg-white px-4 text-base font-bold text-slate-700 outline-none focus:border-[#C5A059]" 
              />
              <button 
                onClick={handleSearchDocument} 
                disabled={isSearching || !isValidBillingDocument(billingData.tipoDocumento as "DNI" | "CE" | "RUC", billingData.numeroDocumento)} 
                className="flex h-12 items-center justify-center rounded-r-xl bg-[#C5A059] px-5 text-sm font-bold text-white transition-colors hover:bg-[#A67C00] disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
              >
                {isSearching ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <Search size={20} />}
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className={`bg-white rounded-3xl border border-slate-200 shadow-sm relative z-20 overflow-hidden transition-opacity duration-300 ${!isFormEnabled ? 'opacity-50 pointer-events-none' : ''}`}>
        <div className="px-6 py-4 border-b border-slate-200 bg-[#f4f5f7] text-center">
          <h3 className="text-sm font-bold text-slate-800 tracking-tight">Detalles de Facturación</h3>
        </div>
        
        <div className="p-6 md:p-8">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-5 sm:gap-6">
            <div className="md:col-span-6">
              <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">Nombre o Razón Social <span className="text-red-500">*</span></label>
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
