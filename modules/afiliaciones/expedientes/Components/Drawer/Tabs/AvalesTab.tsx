import React, { useState } from 'react';
import { CheckCircle2, XCircle, Clock, RefreshCcw, User, Mail, ShieldAlert, IdCard, Phone, Copy, Check } from 'lucide-react';

interface AvalesTabProps {
  payload: any;
  onReplaceAval?: (avalId: number) => void;
}

// Mini-componente para los textos que se pueden copiar al portapapeles
const CopyableField = ({ label, value, icon: Icon }: { label: string, value?: string | null, icon: any }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (value) {
      navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
        <Icon size={12} className="text-slate-300" /> {label}
      </span>
      <div className="flex items-center gap-2 group">
        <span className="text-sm font-bold text-slate-700 truncate">{value || "No registrado"}</span>
        {value && (
          <button 
            onClick={handleCopy} 
            className="text-slate-300 hover:text-[#C5A059] opacity-0 group-hover:opacity-100 transition-all focus:outline-none relative"
            title={`Copiar ${label}`}
          >
            {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
            {copied && (
              <span className="absolute -top-7 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[9px] font-bold px-2 py-0.5 rounded shadow whitespace-nowrap animate-in fade-in zoom-in">
                Copiado
              </span>
            )}
          </button>
        )}
      </div>
    </div>
  );
};

export function AvalesTab({ payload, onReplaceAval }: AvalesTabProps) {
  const avales = payload?.approvals || [];

  if (!avales || avales.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-48 bg-white border border-slate-200 border-dashed rounded-2xl">
        <ShieldAlert size={32} className="text-slate-300 mb-2" />
        <h3 className="text-sm font-bold text-slate-700">Sin Avales</h3>
        <p className="text-xs text-slate-500">Este expediente no requiere avales o no han sido registrados.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-500">
      
      {/* Título de la sección */}
      <div className="flex items-center gap-2 mb-2 px-1">
        <User size={18} className="text-[#C5A059]" />
        <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Respaldo Institucional</h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {avales.map((aval: any, index: number) => {
          const person = aval.sponsorPerson;
          const status = aval.status;
          
          const isApproved = status === "APPROVED";
          const isRejected = status === "REJECTED";
          const isPending = status === "PENDING";

          // Color del borde superior
          const topBorderColor = isApproved ? 'bg-emerald-500' : isRejected ? 'bg-red-500' : 'bg-amber-400';
          
          // Badge dinámico
          const badgeClass = isApproved 
            ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
            : isRejected 
            ? 'bg-red-50 text-red-700 border-red-200' 
            : 'bg-amber-50 text-amber-700 border-amber-200';

          return (
            <div key={aval.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 hover:shadow-md hover:border-[#C5A059]/40 transition-all relative overflow-hidden group flex flex-col">
              {/* Línea superior de color */}
              <div className={`absolute top-0 left-0 w-full h-1.5 ${topBorderColor}`}></div>
              
              {/* HEADER DE LA TARJETA DEL AVAL */}
              <div className="flex items-start justify-between mb-5 mt-1">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-full bg-[#fdfaf5] border border-[#E8D09E] text-[#C5A059] flex items-center justify-center text-sm font-black shadow-sm shrink-0">
                    {person?.firstName?.charAt(0)}{person?.paternalLastName?.charAt(0)}
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-0.5">
                      Aval N° {index + 1}
                    </span>
                    <h4 className="text-[13px] font-extrabold text-slate-800 leading-tight uppercase line-clamp-1">
                      {person?.firstName} {person?.paternalLastName}
                    </h4>
                  </div>
                </div>

                {/* Badge de Estado */}
                <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-black tracking-widest uppercase border shrink-0 ${badgeClass}`}>
                  {isApproved && <CheckCircle2 size={12} strokeWidth={2.5} />}
                  {isRejected && <XCircle size={12} strokeWidth={2.5} />}
                  {isPending && <Clock size={12} strokeWidth={2.5} />}
                  {isApproved ? 'Aprobado' : isRejected ? 'Rechazado' : 'Pendiente'}
                </div>
              </div>

              {/* BODY DE LA TARJETA: Datos de Contacto */}
              <div className="flex-1 bg-slate-50 border border-slate-100 rounded-xl p-4 grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-2">
                <CopyableField label="N° Documento" value={person?.documentNumber} icon={IdCard} />
                <CopyableField label="Teléfono / Celular" value={person?.contacts?.find((c:any) => c.phoneType === 'MOBILE' || c.phoneType === 'WORK')?.phoneNumber} icon={Phone} />
                <div className="sm:col-span-2">
                  <CopyableField label="Correo Electrónico" value={person?.contacts?.[0]?.email} icon={Mail} />
                </div>
              </div>

              {/* FOOTER: Acciones (Reemplazar) */}
              {isRejected && (
                <div className="mt-4 pt-4 border-t border-slate-100 flex justify-end">
                  <button 
                    onClick={() => onReplaceAval && onReplaceAval(aval.id)}
                    className="flex items-center gap-1.5 text-xs font-bold text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 border border-red-100 px-4 py-2 rounded-lg transition-colors focus:outline-none"
                  >
                    <RefreshCcw size={14} strokeWidth={2.5} /> Solicitar Reemplazo
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}