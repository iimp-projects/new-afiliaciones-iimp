"use client";

import React, { useState } from "react";
import { ConsultationQuery } from "../Models/ApplicationStatus";

interface Props {
  onSubmit: (query: ConsultationQuery) => void;
  loading?: boolean;
}

export const ConsultationForm: React.FC<Props> = ({ onSubmit, loading = false }) => {
  const [form, setForm] = useState<ConsultationQuery>({
    documentType: "DNI",
    documentNumber: "",
    verificationCode: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.documentNumber.trim() || !form.verificationCode.trim()) return;
    onSubmit(form);
  };

  return (
    <div className="w-full bg-white/95 backdrop-blur-xl rounded-3xl p-6 sm:p-8 shadow-2xl border border-white/20">
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="text-xs font-bold text-slate-700 mb-1.5 block uppercase tracking-wider">
            Tipo de Documento
          </label>
          <select
            value={form.documentType}
            onChange={(e) => setForm({ ...form, documentType: e.target.value })}
            className="w-full h-12 px-4 rounded-xl border border-slate-200 bg-slate-50/50 text-slate-800 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-600 focus:bg-white transition-all cursor-pointer"
          >
            <option value="DNI">DNI - Doc. Nacional de Identidad</option>
            <option value="CE">Carnet de Extranjería</option>
            <option value="PASSPORT">Pasaporte</option>
          </select>
        </div>

        <div>
          <label className="text-xs font-bold text-slate-700 mb-1.5 block uppercase tracking-wider">
            Número de Documento
          </label>
          <input
            type="text"
            placeholder="Ingrese su número de documento"
            value={form.documentNumber}
            onChange={(e) => setForm({ ...form, documentNumber: e.target.value })}
            className="w-full h-12 px-4 rounded-xl border border-slate-200 bg-slate-50/50 text-slate-800 placeholder:text-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-600 focus:bg-white transition-all"
            required
          />
        </div>

        <div>
          <div className="flex justify-between items-center mb-1.5">
            <label className="text-xs font-bold text-slate-700 block uppercase tracking-wider">
              Código de Verificación
            </label>
            <span className="text-[11px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded">
              Requerido
            </span>
          </div>
          <input
            type="text"
            placeholder="Ej. APP-1786118277804"
            value={form.verificationCode}
            onChange={(e) => setForm({ ...form, verificationCode: e.target.value })}
            className="w-full h-12 px-4 rounded-xl border border-slate-200 bg-slate-50/50 text-slate-800 placeholder:text-slate-400 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-600 focus:bg-white transition-all"
            required
          />
          <p className="text-[11px] text-slate-500 mt-1.5 flex items-center gap-1">
            <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Código enviado previamente a su correo institucional/personal.
          </p>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full h-13 mt-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-slate-900/20 transition-all transform active:scale-[0.99] disabled:opacity-50"
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Consultando...
            </span>
          ) : (
            <>
              Consultar Estado
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </>
          )}
        </button>
      </form>
    </div>
  );
};