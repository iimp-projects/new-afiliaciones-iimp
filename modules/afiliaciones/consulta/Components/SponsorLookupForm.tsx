"use client";

import React, { useState } from "react";

export interface MemberData {
  personId?: number;
  dni: string;
  fullName: string;
  iimpCode: string;
  email: string;
  isActive: boolean;
}

interface SponsorLookupFormProps {
  excludedDnis?: string[];
  onSubmitSponsor: (sponsor: MemberData) => Promise<void> | void;
  onCancel?: () => void;
}

export const SponsorLookupForm: React.FC<SponsorLookupFormProps> = ({
  excludedDnis = [],
  onSubmitSponsor,
  onCancel,
}) => {
  const [dniInput, setDniInput] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [foundMember, setFoundMember] = useState<MemberData | null>(null);

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMessage(null);
    setFoundMember(null);

    const cleanDni = dniInput.trim();

    if (cleanDni.length !== 8 || !/^\d+$/.test(cleanDni)) {
      setErrorMessage("Por favor ingrese un DNI válido de 8 dígitos.");
      return;
    }

    // Verificación previa en cliente si se enviaron DNIs excluidos
    if (excludedDnis.includes(cleanDni)) {
      setErrorMessage("Este asociado ya fue registrado previamente como aval en esta solicitud.");
      return;
    }

    setIsSearching(true);

    try {
      const res = await fetch(`/api/asociados/consulta-habil?dni=${cleanDni}`);
      const data = await res.json();

      if (res.ok && data && !data.error) {
        setFoundMember({
          personId: data.personId,
          dni: data.dni || cleanDni,
          fullName: data.fullName,
          iimpCode: data.iimpCode || "---",
          email: data.email || "---",
          isActive: true,
        });
      } else {
        // Muestra el mensaje exacto de la API (Ej: "El DNI ingresado no corresponde a un Asociado Activo hábil.")
        setErrorMessage(data.error || "No se pudo validar el DNI del asociado.");
      }
    } catch (err) {
      console.error("Error al consultar DNI:", err);
      setErrorMessage("Ocurrió un error al verificar el DNI del asociado.");
    } finally {
      setIsSearching(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!foundMember) return;

    setIsSubmitting(true);
    try {
      await onSubmitSponsor(foundMember);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Banner de Mensaje de Error */}
      {errorMessage && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 flex items-center gap-3 text-xs text-rose-700 font-medium">
          <div className="w-5 h-5 rounded-full bg-rose-100 border border-rose-300 flex items-center justify-center shrink-0">
            <svg className="w-3 h-3 text-rose-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Formulario */}
      <div className="border border-slate-200 rounded-2xl p-5 bg-white shadow-xs space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
          <span className="w-6 h-6 rounded-full bg-[#C39254] text-white text-xs font-bold flex items-center justify-center">
            ↺
          </span>
          <h4 className="text-sm font-bold text-slate-800">
            Reemplazar Aval Institucional
          </h4>
        </div>

        {/* Campo DNI */}
        <div>
          <label className="block text-[11px] font-extrabold text-slate-600 tracking-wider uppercase mb-1">
            DNI DEL AVAL *
          </label>
          <div className="flex gap-0">
            <input
              type="text"
              maxLength={8}
              placeholder="Ingrese DNI (8 dígitos)"
              value={dniInput}
              onChange={(e) => {
                setDniInput(e.target.value);
                setFoundMember(null);
                setErrorMessage(null);
              }}
              onKeyDown={(e) => e.key === "Enter" && handleSearch(e)}
              className="flex-1 px-3 py-2 text-xs border border-slate-300 rounded-l-xl focus:outline-none focus:ring-1 focus:ring-[#C39254] bg-white text-slate-800"
            />
            <button
              type="button"
              onClick={handleSearch}
              disabled={isSearching}
              className="bg-black hover:bg-slate-800 text-white px-4 rounded-r-xl flex items-center justify-center transition-colors disabled:opacity-50"
            >
              {isSearching ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Nombre Completo */}
        <div>
          <label className="block text-[11px] font-extrabold text-slate-600 tracking-wider uppercase mb-1">
            NOMBRE COMPLETO
          </label>
          <input
            type="text"
            readOnly
            value={foundMember?.fullName || ""}
            placeholder="Nombre validado por el sistema"
            className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-slate-50 text-slate-700 font-semibold focus:outline-none cursor-not-allowed"
          />
        </div>

        {/* Cód IIMP y Correo */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-extrabold text-slate-600 tracking-wider uppercase mb-1">
              CÓD. IIMP
            </label>
            <input
              type="text"
              readOnly
              value={foundMember?.iimpCode || "---"}
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-slate-50 text-slate-700 font-medium focus:outline-none cursor-not-allowed"
            />
          </div>
          <div>
            <label className="block text-[11px] font-extrabold text-slate-600 tracking-wider uppercase mb-1">
              CORREO ELECTRÓNICO
            </label>
            <input
              type="text"
              readOnly
              value={foundMember?.email || "---"}
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-slate-50 text-slate-700 font-medium focus:outline-none cursor-not-allowed text-ellipsis overflow-hidden"
            />
          </div>
        </div>

        {/* Botones */}
        {foundMember && (
          <div className="pt-2 flex justify-end gap-2">
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="px-3 py-1.5 text-xs text-slate-600 font-semibold hover:bg-slate-100 rounded-lg"
              >
                Cancelar
              </button>
            )}
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs bg-[#C39254] hover:bg-[#A1743B] text-white font-bold rounded-xl shadow-xs transition-all disabled:opacity-50"
            >
              {isSubmitting ? "Registrando..." : "Confirmar y Solicitar Aval"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};