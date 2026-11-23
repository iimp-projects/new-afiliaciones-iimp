"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { CreditCard, FileText, History, Info, ShieldCheck, UserCircle2, X } from "lucide-react";

function Row({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3 rounded-xl border border-slate-100 bg-slate-50 p-4">
      <span className="mt-0.5 shrink-0 text-[#b48a37]">{icon}</span>
      <div className="min-w-0">
        <p className="text-sm font-bold text-slate-800">{title}</p>
        <div className="mt-1 space-y-1 text-xs leading-5 text-slate-500">{children}</div>
      </div>
    </div>
  );
}

export function AssociateInfoButton({ isHistorical }: { isHistorical: boolean }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Información de la ficha"
        aria-label="Información de la ficha"
        className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm transition-all hover:border-[#E6C982] hover:bg-[#FFF8E8] hover:text-[#936B2E]"
      >
        <Info size={15} strokeWidth={2.5} />
      </button>

      {open && typeof document !== "undefined" && createPortal(
        <div role="dialog" aria-modal="true" aria-labelledby="associate-info-title" className="fixed inset-0 z-[1000001] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-[2px]" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
          <div className="flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
            <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-100 px-6 py-4">
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#ead9b8] bg-[#fbf4e7] text-[#b48a37]"><Info size={19} /></span>
                <div>
                  <h2 id="associate-info-title" className="font-black text-slate-800">Información de la ficha</h2>
                  <p className="mt-0.5 text-xs font-medium text-slate-500">Qué información contiene cada pestaña y cómo interpretarla.</p>
                </div>
              </div>
              <button type="button" onClick={() => setOpen(false)} aria-label="Cerrar" className="rounded-full p-1.5 text-slate-500 transition hover:bg-slate-100"><X size={18} /></button>
            </div>

            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-6 py-4">
              <Row icon={<UserCircle2 size={17} />} title="Información">
                <p>Datos personales, académicos y laborales registrados durante la afiliación.</p>
                {isHistorical && <p>Asociado histórico migrado desde SIE: no hay postulación V2 asociada y los datos provienen del padrón institucional.</p>}
              </Row>
              <Row icon={<ShieldCheck size={17} />} title="Membresía">
                <p>Consulta la categoría, la fecha de afiliación y la situación institucional actual del asociado.</p>
              </Row>
              <Row icon={<Info size={17} />} title="Cuenta y acceso">
                <p>Muestra el estado de la cuenta de acceso asociada a esta persona.</p>
                <p>La ficha no muestra ni gestiona contraseñas; la creación automática de cuentas y los enlaces seguros de acceso corresponden a otra fase.</p>
              </Row>
              <Row icon={<FileText size={17} />} title="Documentos">
                <p>Documentos conservados del proceso de afiliación.</p>
                <p>Obligatorios: documento de identidad y fotografía. Para estudiantes, además constancia de estudios.</p>
              </Row>
              <Row icon={<History size={17} />} title="Historial">
                <p>Principales eventos y cambios de estado relacionados con el asociado.</p>
              </Row>
              <Row icon={<CreditCard size={17} />} title="Cuotas y pagos SIE">
                <p>La consulta se realiza directamente contra SIE y no modifica la ficha del asociado.</p>
                <p>La información de SIE es solo informativa y no cambia pagos, estados ni integraciones.</p>
                <p>La inscripción y las cuotas facturadas por SIE no representan una deuda pendiente. El sistema no registra cambios de categoría ni estados institucionales.</p>
              </Row>
            </div>

            <div className="flex shrink-0 justify-end border-t border-slate-100 px-6 py-4">
              <button type="button" onClick={() => setOpen(false)} className="rounded-xl bg-[#C5A059] px-5 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-[#b08d47]">Entendido</button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
