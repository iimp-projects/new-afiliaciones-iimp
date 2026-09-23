"use client";
import React, { useState } from "react";
import Link from "next/link";
import { ConsultationQuery } from "../Models/ApplicationStatus";

interface Props {
  onSubmit: (query: ConsultationQuery) => void;
  loading?: boolean;
}

export const ConsultationForm: React.FC<Props> = ({ onSubmit, loading = false }) => {
  const [form, setForm] = useState<ConsultationQuery>({
    documentType: "DNI",
    documentNumber: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.documentNumber.trim()) return;
    onSubmit(form);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Tipo de Documento */}
      <div>
        <label className="block text-sm font-bold text-on-surface-variant mb-2 ml-1">
          Tipo de Documento
        </label>
        <div className="relative group">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-secondary group-focus-within:text-primary transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" />
            </svg>
          </div>
          <select
            value={form.documentType}
            onChange={(e) => setForm({ ...form, documentType: e.target.value })}
            className="w-full h-12 pl-11 pr-10 bg-surface border border-outline-variant rounded-xl text-sm text-on-surface focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all font-medium appearance-none cursor-pointer"
          >
            <option value="DNI">DNI - Doc. Nacional de Identidad</option>
            <option value="CE">Carnet de Extranjería</option>
            <option value="PASSPORT">Pasaporte</option>
          </select>
          <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none text-secondary">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
          </div>
        </div>
      </div>

      {/* Número de Documento */}
      <div>
        <label className="block text-sm font-bold text-on-surface-variant mb-2 ml-1">
          Número de Documento
        </label>
        <div className="relative group">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-secondary group-focus-within:text-primary transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <input
            type="text"
            placeholder="Ingrese su número de documento"
            value={form.documentNumber}
            onChange={(e) => setForm({ ...form, documentNumber: e.target.value })}
            className="w-full h-12 pl-11 pr-4 bg-surface border border-outline-variant rounded-xl text-sm text-on-surface focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all font-medium placeholder-secondary/50"
            required
            minLength={4}
            maxLength={20}
            pattern="[A-Za-z0-9]+"
            disabled={loading}
          />
        </div>
      </div>

      {/* Botón Consultar */}
      <div className="pt-2">
        <button
          type="submit"
          disabled={loading}
          className="w-full h-12 rounded-xl text-on-primary bg-primary font-bold text-sm tracking-wide hover:brightness-90 transition-all duration-300 flex items-center justify-center gap-2 shadow-lg shadow-primary/20 disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer"
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-on-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Validando...
            </span>
          ) : (
            <>
              Consultar Estado
              <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </>
          )}
        </button>
      </div>

      <div className="mt-6 text-center">
         <Link href="/postulacion" className="text-sm font-bold text-secondary hover:text-primary transition-colors">
            Volver al inicio de postulación
         </Link>
      </div>
    </form>
  );
};
